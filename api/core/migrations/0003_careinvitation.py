import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_wellness_screening"),
    ]

    operations = [
        migrations.CreateModel(
            name="CareInvitation",
            fields=[
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "code_digest",
                    models.CharField(
                        editable=False,
                        max_length=64,
                        unique=True,
                    ),
                ),
                (
                    "code_hint",
                    models.CharField(editable=False, max_length=4),
                ),
                ("expires_at", models.DateTimeField()),
                ("accepted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "is_active",
                    models.BooleanField(db_index=True, default=True),
                ),
                (
                    "accepted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="accepted_care_invitations",
                        to="core.patientprofile",
                    ),
                ),
                (
                    "clinician",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="care_invitations",
                        to="core.clinicianprofile",
                    ),
                ),
            ],
            options={
                "db_table": "core_careinvitation",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="careinvitation",
            index=models.Index(
                fields=["clinician", "is_active"],
                name="core_carein_clinici_a85527_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="careinvitation",
            index=models.Index(
                fields=["expires_at"],
                name="core_carein_expires_41daf4_idx",
            ),
        ),
    ]
