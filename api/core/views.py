import hashlib
import logging
import secrets
import string
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import PatientProfile, UserRole
from .ai import generate_agent_reply
from .models import (
    CareInvitation,
    CarePath,
    UserRole,
    WellnessScreeningStatus,
)
from .serializers import (
    CareInvitationAcceptSerializer,
    CareInvitationSerializer,
    ClinicianProfileSerializer,
    LoginSerializer,
    PatientListSerializer,
    PatientProfileSerializer,
    RegisterSerializer,
    WellnessScreeningSerializer,
)

logger = logging.getLogger(__name__)


class IsClinician(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.CLINICIAN)


class PatientViewSet(ReadOnlyModelViewSet):
    serializer_class   = PatientListSerializer
    permission_classes = [IsAuthenticated, IsClinician]

    def get_queryset(self):
        return (
            PatientProfile.objects
            .filter(primary_clinician=self.request.user.clinician_profile)
            .select_related('user')
            .prefetch_related('sessions', 'escalations', 'prescriptions', 'prescriptions__exercise', 'pain_checkins')
        )


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user  = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'role': user.role}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user  = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'role': user.role})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == UserRole.PATIENT and hasattr(user, 'patient_profile'):
            from api.catalogue.services import sync_patient_care_path
            sync_patient_care_path(user.patient_profile)
        data = {
            'id':         str(user.id),
            'email':      user.email,
            'first_name': user.first_name,
            'last_name':  user.last_name,
            'role':       user.role,
        }
        if user.role == UserRole.PATIENT and hasattr(user, 'patient_profile'):
            data['profile'] = PatientProfileSerializer(user.patient_profile).data
        elif user.role == UserRole.CLINICIAN and hasattr(user, 'clinician_profile'):
            data['profile'] = ClinicianProfileSerializer(user.clinician_profile).data
        return Response(data)

    def patch(self, request):
        user = request.user
        if user.role == UserRole.PATIENT and hasattr(user, 'patient_profile'):
            serializer = PatientProfileSerializer(user.patient_profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        elif user.role == UserRole.CLINICIAN and hasattr(user, 'clinician_profile'):
            serializer = ClinicianProfileSerializer(user.clinician_profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response({'detail': 'No profile found.'}, status=status.HTTP_404_NOT_FOUND)


class AgentChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = str(request.data.get('message', '')).strip()

        if not message:
            return Response(
                {'detail': 'Message is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(message) > 2000:
            return Response(
                {'detail': 'Message is too long.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reply = generate_agent_reply(request.user, message)
        except Exception:
            logger.exception('Gemini request failed')
            return Response(
                {'detail': 'The assistant is unavailable.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({
            'reply': reply,
            'role': request.user.role,
        })


class WellnessScreeningView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if (
            request.user.role != UserRole.PATIENT
            or not hasattr(request.user, 'patient_profile')
        ):
            return Response(
                {'detail': 'A patient profile is required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = WellnessScreeningSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        answers = serializer.validated_data
        profile = request.user.patient_profile
        if profile.primary_clinician_id:
            return Response(
                {
                    'detail': (
                        'This patient is linked to a clinician. The clinician '
                        'programme must be completed or removed before changing pathways.'
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        eligible = all(answers.values())
        screening_status = (
            WellnessScreeningStatus.ELIGIBLE
            if eligible
            else WellnessScreeningStatus.NEEDS_REVIEW
        )

        profile.wellness_screening_status = screening_status
        profile.wellness_screening_answers = answers
        profile.wellness_screened_at = timezone.now()
        profile.low_risk_acknowledged = eligible
        profile.care_path = (
            CarePath.WELLNESS if eligible else CarePath.NEEDS_REVIEW
        )
        profile.save(update_fields=[
            'wellness_screening_status',
            'wellness_screening_answers',
            'wellness_screened_at',
            'low_risk_acknowledged',
            'care_path',
            'updated_at',
        ])

        return Response({
            'status': screening_status,
            'care_path': profile.care_path,
            'screened_at': profile.wellness_screened_at,
        })


INVITE_ALPHABET = string.ascii_uppercase.replace("I", "").replace("O", "") + "23456789"


def _invitation_digest(code):
    return hashlib.sha256(code.strip().upper().encode("utf-8")).hexdigest()


class CareInvitationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def _clinician(self, request):
        if (
            request.user.role != UserRole.CLINICIAN
            or not hasattr(request.user, "clinician_profile")
        ):
            return None
        return request.user.clinician_profile

    def get(self, request):
        clinician = self._clinician(request)
        if not clinician:
            return Response(
                {"detail": "A clinician account is required."},
                status=status.HTTP_403_FORBIDDEN,
            )
        invitations = CareInvitation.objects.filter(
            clinician=clinician,
        ).select_related("clinician__user")[:20]
        return Response(CareInvitationSerializer(invitations, many=True).data)

    def post(self, request):
        clinician = self._clinician(request)
        if not clinician:
            return Response(
                {"detail": "A clinician account is required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        raw_code = None
        for _ in range(10):
            candidate = "".join(
                secrets.choice(INVITE_ALPHABET) for _ in range(8)
            )
            if not CareInvitation.objects.filter(
                code_digest=_invitation_digest(candidate)
            ).exists():
                raw_code = candidate
                break
        if not raw_code:
            return Response(
                {"detail": "Could not create an invitation code."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        invitation = CareInvitation.objects.create(
            clinician=clinician,
            code_digest=_invitation_digest(raw_code),
            code_hint=raw_code[-4:],
            expires_at=timezone.now() + timedelta(days=7),
        )
        data = CareInvitationSerializer(invitation).data
        data["code"] = raw_code
        return Response(data, status=status.HTTP_201_CREATED)


class CareInvitationAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if (
            request.user.role != UserRole.PATIENT
            or not hasattr(request.user, "patient_profile")
        ):
            return Response(
                {"detail": "A patient account is required."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CareInvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        digest = _invitation_digest(serializer.validated_data["code"])

        with transaction.atomic():
            invitation = (
                CareInvitation.objects.select_for_update()
                .select_related("clinician__user")
                .filter(
                    code_digest=digest,
                    is_active=True,
                    accepted_by__isnull=True,
                    expires_at__gt=timezone.now(),
                )
                .first()
            )
            if not invitation:
                return Response(
                    {"detail": "This invitation is invalid, expired, or already used."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            patient = request.user.patient_profile
            if (
                patient.primary_clinician_id
                and patient.primary_clinician_id != invitation.clinician_id
            ):
                return Response(
                    {"detail": "This patient is already linked to another clinician."},
                    status=status.HTTP_409_CONFLICT,
                )

            patient.primary_clinician = invitation.clinician
            patient.care_path = CarePath.NEEDS_REVIEW
            patient.save(update_fields=[
                "primary_clinician", "care_path", "updated_at",
            ])
            invitation.accepted_by = patient
            invitation.accepted_at = timezone.now()
            invitation.is_active = False
            invitation.save(update_fields=[
                "accepted_by", "accepted_at", "is_active", "updated_at",
            ])

        return Response({
            "clinician": invitation.clinician.user.get_full_name().strip()
                or invitation.clinician.user.email,
            "care_path": patient.care_path,
            "detail": "Linked successfully. Your clinician can now assign a programme.",
        })


class ClinicianPatientsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if (
            request.user.role != UserRole.CLINICIAN
            or not hasattr(request.user, "clinician_profile")
        ):
            return Response(
                {"detail": "A clinician account is required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        clinician = request.user.clinician_profile
        patients = (
            clinician.patients.select_related("user")
            .prefetch_related("prescriptions")
            .order_by("user__last_name", "user__first_name")
        )
        today = timezone.localdate()
        data = []
        for patient in patients:
            active_count = sum(
                1 for prescription in patient.prescriptions.all()
                if (
                    prescription.clinician_id == clinician.id
                    and prescription.is_active
                    and prescription.valid_from <= today
                    and (
                        prescription.valid_until is None
                        or prescription.valid_until >= today
                    )
                )
            )
            data.append({
                "id": str(patient.id),
                "name": patient.user.get_full_name().strip() or patient.user.email,
                "email": patient.user.email,
                "care_path": patient.care_path,
                "active_prescriptions": active_count,
            })
        return Response(data)
