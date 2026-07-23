from django.core.management.base import BaseCommand

from api.slack_bot.services import send_daily_digest


class Command(BaseCommand):
    help = 'Send the daily PhysioVision digest to Slack'

    def handle(self, *args, **options):
        self.stdout.write("Sending daily digest to Slack…")
        send_daily_digest()
        self.stdout.write(self.style.SUCCESS("Done."))
