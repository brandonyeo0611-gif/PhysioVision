import logging

from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai import generate_agent_reply
from .models import UserRole
from .serializers import (
    ClinicianProfileSerializer,
    LoginSerializer,
    PatientProfileSerializer,
    RegisterSerializer,
)

logger = logging.getLogger(__name__)


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
