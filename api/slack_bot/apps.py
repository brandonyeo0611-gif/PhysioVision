from django.apps import AppConfig


class SlackBotConfig(AppConfig):
    name  = 'api.slack_bot'
    label = 'slack_bot'

    def ready(self):
        from django.db.models.signals import post_save
        from api.consultations.models import Escalation
        from .services import on_escalation_created

        post_save.connect(
            on_escalation_created,
            sender=Escalation,
            dispatch_uid='slack_alert_on_escalation',
        )
