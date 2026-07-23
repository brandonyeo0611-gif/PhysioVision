from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("physio_sessions", "0002_session_angle_summaries"),
    ]

    operations = [
        migrations.AddField(
            model_name="paincheckin",
            name="timing",
            field=models.CharField(
                choices=[
                    ("before", "Before exercise"),
                    ("after", "After exercise"),
                    ("general", "General check-in"),
                ],
                default="general",
                help_text="Whether this report was collected before or after exercise.",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="paincheckin",
            name="recovery_status",
            field=models.CharField(
                blank=True,
                choices=[
                    ("better", "Better"),
                    ("same", "About the same"),
                    ("worse", "Worse"),
                    ("unsure", "Not sure"),
                ],
                help_text="Patient-reported change compared with the relevant prior point.",
                max_length=10,
            ),
        ),
    ]
