from django.conf import settings
from google import genai

from .models import UserRole


PATIENT_INSTRUCTIONS = """
You are a rehabilitation exercise companion for an older adult.

Use short, clear and supportive language.
Never diagnose conditions or modify prescriptions.
Movement corrections must come from the tracking engine.
Ask about pain before and after exercise.
Never claim movement is correct when tracking confidence is insufficient.
"""

CLINICIAN_INSTRUCTIONS = """
You assist an authenticated physiotherapist.

Summarise measured exercise sessions, pain reports and movement trends.
Separate measured facts from AI interpretation.
Only discuss patients returned by authorised backend tools.
You may prepare drafts, but never approve prescriptions.
"""

ROLE_INSTRUCTIONS = {
    UserRole.PATIENT: PATIENT_INSTRUCTIONS,
    UserRole.CLINICIAN: CLINICIAN_INSTRUCTIONS,
}


def generate_agent_reply(user, message):
    """Return a role-specific Gemini response for an authenticated user."""
    instructions = ROLE_INSTRUCTIONS.get(user.role)

    if not instructions:
        raise ValueError("Unsupported user role.")
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    interaction = client.interactions.create(
        model=settings.GEMINI_MODEL,
        system_instruction=instructions,
        input=message,
    )

    return interaction.output_text
