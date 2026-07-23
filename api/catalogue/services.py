from django.db.models import Q
from django.utils import timezone

from api.core.models import (
    CarePath,
    WellnessScreeningStatus,
)

from .models import Prescription


def active_prescriptions_for(patient):
    if not patient.primary_clinician_id:
        return Prescription.objects.none()
    today = timezone.localdate()
    return Prescription.objects.filter(
        patient=patient,
        clinician_id=patient.primary_clinician_id,
        is_active=True,
        valid_from__lte=today,
    ).filter(
        Q(valid_until__isnull=True) | Q(valid_until__gte=today)
    )


def sync_patient_care_path(patient):
    if active_prescriptions_for(patient).exists():
        next_path = CarePath.CLINICIAN
    elif patient.primary_clinician_id:
        next_path = CarePath.NEEDS_REVIEW
    elif (
        patient.wellness_screening_status
        == WellnessScreeningStatus.ELIGIBLE
    ):
        next_path = CarePath.WELLNESS
    else:
        next_path = CarePath.NEEDS_REVIEW

    if patient.care_path != next_path:
        patient.care_path = next_path
        patient.save(update_fields=["care_path", "updated_at"])
    return next_path
