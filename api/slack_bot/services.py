import logging
import re
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _get_slack_client():
    from slack_sdk import WebClient
    return WebClient(token=settings.SLACK_BOT_TOKEN)


def _get_gemini_model():
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel("gemini-1.5-flash")


TRIGGER_LABELS = {
    'quality_decline':   'Quality decline',
    'symmetry_concern':  'Symmetry concern',
    'missed_sessions':   'Missed sessions',
    'pain_increase':     'Pain increase',
    'manual':            'Manual flag',
}


# ── Proactive alerts ──────────────────────────────────────────

def on_escalation_created(sender, instance, created, **kwargs):
    if not created or instance.status != 'open':
        return
    try:
        _post_escalation_alert(instance)
    except Exception:
        logger.exception("Slack alert failed for escalation %s", instance.id)


def _post_escalation_alert(escalation):
    if not getattr(settings, 'SLACK_BOT_TOKEN', ''):
        return

    patient    = escalation.patient
    name       = f"{patient.user.first_name} {patient.user.last_name}".strip()
    trigger    = TRIGGER_LABELS.get(escalation.trigger_type, escalation.trigger_type)
    frontend   = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":rotating_light: *New escalation — {name}*\n*Trigger:* {trigger}\n{escalation.description}",
            },
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Open dashboard"},
                    "url": frontend,
                    "style": "primary",
                }
            ],
        },
    ]

    client = _get_slack_client()
    client.chat_postMessage(
        channel=getattr(settings, 'SLACK_CHANNEL_ID', '#physiovision-alerts'),
        blocks=blocks,
        text=f"New escalation for {name}: {trigger}",
    )


# ── Daily digest ──────────────────────────────────────────────

def send_daily_digest():
    from api.consultations.models import Escalation
    from api.sessions.models import PainCheckin, Session

    if not getattr(settings, 'SLACK_BOT_TOKEN', ''):
        logger.warning("SLACK_BOT_TOKEN not configured — skipping digest")
        return

    yesterday = timezone.now() - timedelta(hours=24)

    open_escalations   = Escalation.objects.filter(status='open').select_related('patient__user')
    sessions_yesterday = Session.objects.filter(started_at__gte=yesterday).select_related('patient__user', 'exercise')
    high_pain          = PainCheckin.objects.filter(checked_at__gte=yesterday, pain_level__gte=7).select_related('patient__user')

    lines = [f":sun_with_face: *PhysioVision daily digest — {timezone.now().strftime('%A, %d %B')}*\n"]

    lines.append(f"*Open escalations:* {open_escalations.count()}")
    for esc in open_escalations[:5]:
        name = f"{esc.patient.user.first_name} {esc.patient.user.last_name}".strip()
        lines.append(f"  • {name} — {TRIGGER_LABELS.get(esc.trigger_type, esc.trigger_type)}")

    lines.append(f"\n*Sessions in last 24h:* {sessions_yesterday.count()}")
    for s in sessions_yesterday[:5]:
        name = f"{s.patient.user.first_name} {s.patient.user.last_name}".strip()
        lines.append(f"  • {name} — {s.exercise.name} ({s.reps_completed}/{s.reps_target} reps)")

    if high_pain.exists():
        lines.append(f"\n*:warning: High pain reports (≥7):*")
        for pc in high_pain[:5]:
            name = f"{pc.patient.user.first_name} {pc.patient.user.last_name}".strip()
            lines.append(f"  • {name} — {pc.pain_level}/10{(' · ' + pc.location_notes) if pc.location_notes else ''}")

    client = _get_slack_client()
    client.chat_postMessage(
        channel=getattr(settings, 'SLACK_CHANNEL_ID', '#physiovision-alerts'),
        text="\n".join(lines),
    )
    logger.info("Daily digest sent")


# ── On-demand patient summary blocks ─────────────────────────

def build_patient_summary_blocks(patient):
    from api.sessions.models import Session

    name       = f"{patient.user.first_name} {patient.user.last_name}".strip()
    last_7d    = timezone.now() - timedelta(days=7)
    sessions   = Session.objects.filter(patient=patient, started_at__gte=last_7d).order_by('-started_at')[:5]
    pain_log   = patient.pain_checkins.order_by('-checked_at').first()

    lines = [f"*Patient summary: {name}*"]
    lines.append(f"Goal: {patient.goal or '—'} | Care path: {patient.care_path or '—'}")

    if sessions:
        lines.append(f"\n*Last {sessions.count()} session(s) this week:*")
        for s in sessions:
            lines.append(f"  • {s.exercise.name}: {s.reps_completed}/{s.reps_target} reps, quality {s.quality_score or '—'}/100")
    else:
        lines.append("\nNo sessions in the last 7 days.")

    if pain_log:
        lines.append(f"\n*Latest pain check-in:* {pain_log.pain_level}/10 ({pain_log.checked_at.strftime('%d %b')})")

    open_escs = patient.escalations.filter(status='open')
    if open_escs.exists():
        lines.append(f"\n:rotating_light: *{open_escs.count()} open escalation(s)*")

    return [{"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(lines)}}]


def find_patient_by_name(name_query):
    from api.core.models import PatientProfile
    parts = name_query.strip().split()
    qs = PatientProfile.objects.select_related('user', 'escalations').prefetch_related('sessions', 'pain_checkins', 'escalations')
    for part in parts:
        qs = qs.filter(user__first_name__icontains=part) | qs.filter(user__last_name__icontains=part)
    return qs.first()


# ── Draft clinical note via Claude ────────────────────────────

def generate_clinical_note(session):
    if not getattr(settings, 'GEMINI_API_KEY', ''):
        return "GEMINI_API_KEY not configured — cannot generate note."

    prompt = f"""Draft a structured physiotherapy session note from this data.

Exercise: {session.exercise.name}
Date: {session.started_at.strftime('%Y-%m-%d')}
Sets completed: {session.sets_completed}/{session.sets_target}
Reps completed: {session.reps_completed}/{session.reps_target}
Quality score: {session.quality_score}/100
Pain level reported: {session.pain_level}/10
Movement angle summaries: {session.angle_summaries}
Coaching cues triggered: {session.cues_triggered}
Symmetry warnings: {session.symmetry_warnings_count}

Write a concise SOAP-format note (Subjective, Objective, Assessment, Plan) \
suitable for a clinical record. Be specific about angles and quality metrics. \
Keep it under 200 words."""

    model = _get_gemini_model()
    resp  = model.generate_content(prompt)
    return resp.text
