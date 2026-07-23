from rest_framework.viewsets import ModelViewSet

from api.core.models import UserRole
from .models import PainCheckin, Session
from .serializers import PainCheckinSerializer, SessionSerializer


class SessionViewSet(ModelViewSet):
    serializer_class = SessionSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == UserRole.CLINICIAN:
            patient_id = self.request.query_params.get('patient')
            if not patient_id:
                return Session.objects.none()
            return (
                Session.objects
                .filter(patient__id=patient_id, patient__primary_clinician=user.clinician_profile)
                .select_related('exercise')
                .order_by('-started_at')
            )
        return (
            Session.objects
            .filter(patient=user.patient_profile)
            .select_related('exercise')
            .order_by('-started_at')
        )

    def perform_create(self, serializer):
        serializer.save(patient=self.request.user.patient_profile)


class PainCheckinViewSet(ModelViewSet):
    serializer_class = PainCheckinSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == UserRole.CLINICIAN:
            patient_id = self.request.query_params.get('patient')
            if not patient_id:
                return PainCheckin.objects.none()
            return (
                PainCheckin.objects
                .filter(patient__id=patient_id, patient__primary_clinician=user.clinician_profile)
                .order_by('-checked_at')
            )
        return PainCheckin.objects.filter(patient=user.patient_profile).order_by('-checked_at')

    def perform_create(self, serializer):
        serializer.save(patient=self.request.user.patient_profile)
