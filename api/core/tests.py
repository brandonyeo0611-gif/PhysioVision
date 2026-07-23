from unittest.mock import patch

from rest_framework.test import APITestCase

from .models import User, UserRole


class AgentChatViewTests(APITestCase):
    endpoint = '/api/auth/agent/chat/'

    def make_user(self, role):
        email = f'{role}@example.com'
        return User.objects.create_user(
            username=email,
            email=email,
            password='test-password',
            role=role,
        )

    def test_authentication_is_required(self):
        response = self.client.post(
            self.endpoint,
            {'message': 'Hello'},
            format='json',
        )

        self.assertEqual(response.status_code, 401)

    def test_message_is_required(self):
        self.client.force_authenticate(self.make_user(UserRole.PATIENT))

        response = self.client.post(
            self.endpoint,
            {'message': '   '},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'Message is required.')

    @patch('api.core.views.generate_agent_reply')
    def test_patient_role_is_selected_from_authenticated_user(self, generate_reply):
        user = self.make_user(UserRole.PATIENT)
        self.client.force_authenticate(user)
        generate_reply.return_value = 'Patient reply'

        response = self.client.post(
            self.endpoint,
            {'message': 'How should I exercise?'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['role'], UserRole.PATIENT)
        self.assertEqual(response.data['reply'], 'Patient reply')
        generate_reply.assert_called_once_with(user, 'How should I exercise?')

    @patch('api.core.views.generate_agent_reply')
    def test_clinician_role_is_selected_from_authenticated_user(self, generate_reply):
        user = self.make_user(UserRole.CLINICIAN)
        self.client.force_authenticate(user)
        generate_reply.return_value = 'Clinician reply'

        response = self.client.post(
            self.endpoint,
            {'message': 'Summarise recent trends.'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['role'], UserRole.CLINICIAN)
        self.assertEqual(response.data['reply'], 'Clinician reply')

    @patch('api.core.views.generate_agent_reply')
    def test_provider_failure_returns_safe_error(self, generate_reply):
        self.client.force_authenticate(self.make_user(UserRole.PATIENT))
        generate_reply.side_effect = RuntimeError('provider detail')

        response = self.client.post(
            self.endpoint,
            {'message': 'Hello'},
            format='json',
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['detail'], 'The assistant is unavailable.')
