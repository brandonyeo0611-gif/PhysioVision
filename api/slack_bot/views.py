import re

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt

try:
    from slack_bolt import App
    from slack_bolt.adapter.django import SlackRequestHandler

    slack_app = App(
        token=getattr(settings, 'SLACK_BOT_TOKEN', 'dummy'),
        signing_secret=getattr(settings, 'SLACK_SIGNING_SECRET', 'dummy'),
        token_verification_enabled=False,
    )
    handler = SlackRequestHandler(slack_app)

    @slack_app.event("app_mention")
    def handle_mention(event, say):
        text = event.get("text", "").lower()

        name_match = re.search(r'(?:for|show)\s+([a-z ]+?)(?:\s+(?:progress|note|summary)|\s*$)', text)
        name_query = name_match.group(1).strip() if name_match else None

        if "note" in text or "draft" in text:
            if not name_query:
                say("Please specify a patient name, e.g. `@workbuddy draft note for Sarah`")
                return
            from .services import find_patient_by_name, generate_clinical_note
            from api.sessions.models import Session
            patient = find_patient_by_name(name_query)
            if not patient:
                say(f"Could not find a patient matching '{name_query}'.")
                return
            session = Session.objects.filter(patient=patient).order_by('-started_at').first()
            if not session:
                say(f"No sessions found for {patient.user.first_name}.")
                return
            say(f"Drafting note for {patient.user.first_name}'s last session…")
            note = generate_clinical_note(session)
            say(f"*Draft clinical note:*\n```{note}```")

        elif "progress" in text or "show" in text or "summary" in text:
            if not name_query:
                say("Please specify a patient name, e.g. `@workbuddy show Sarah progress`")
                return
            from .services import build_patient_summary_blocks, find_patient_by_name
            patient = find_patient_by_name(name_query)
            if not patient:
                say(f"Could not find a patient matching '{name_query}'.")
                return
            say(blocks=build_patient_summary_blocks(patient))

        else:
            say(
                "Hi! I'm workbuddy. I can help with:\n"
                "• `@workbuddy show [name] progress` — patient summary\n"
                "• `@workbuddy draft note for [name]` — draft clinical note from last session"
            )

    @csrf_exempt
    def slack_events(request):
        import logging
        logging.getLogger(__name__).debug(
            "Slack event received — headers: %s",
            {k: v for k, v in request.headers.items() if 'slack' in k.lower()}
        )
        resp = handler.handle(request)
        logging.getLogger(__name__).debug("Bolt response status: %s", resp.status_code)
        return resp

except ImportError:
    from django.http import JsonResponse

    def slack_events(request):
        return JsonResponse({"error": "slack-bolt not installed"}, status=503)
