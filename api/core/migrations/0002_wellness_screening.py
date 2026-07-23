from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="patientprofile",
            name="care_path",
            field=models.CharField(
                choices=[
                    ("wellness", "General wellness"),
                    ("clinician", "Physiotherapist-prescribed rehabilitation"),
                    ("needs_review", "Professional review needed"),
                ],
                default="wellness",
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name="patientprofile",
            name="wellness_screening_status",
            field=models.CharField(
                choices=[
                    ("pending", "Not completed"),
                    ("eligible", "Eligible for general wellness"),
                    ("needs_review", "Professional review needed"),
                ],
                default="pending",
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name="patientprofile",
            name="wellness_screening_answers",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="patientprofile",
            name="wellness_screened_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
