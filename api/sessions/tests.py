from django.test import SimpleTestCase

from .serializers import PainCheckinSerializer


class PainCheckinSerializerTests(SimpleTestCase):
    def test_accepts_structured_pre_exercise_checkin(self):
        serializer = PainCheckinSerializer(data={
            "pain_level": 4,
            "timing": "before",
            "recovery_status": "better",
            "checked_at": "2026-07-23T10:00:00Z",
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_rejects_invalid_spoken_checkin_values(self):
        serializer = PainCheckinSerializer(data={
            "pain_level": 11,
            "timing": "during",
            "recovery_status": "excellent",
            "checked_at": "2026-07-23T10:00:00Z",
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn("pain_level", serializer.errors)
        self.assertIn("timing", serializer.errors)
        self.assertIn("recovery_status", serializer.errors)
