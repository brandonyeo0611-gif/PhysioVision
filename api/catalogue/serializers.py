from rest_framework import serializers

from .models import Calibration, Exercise, Prescription


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Exercise
        fields = [
            'id', 'name', 'category', 'camera_direction', 'rep_rule',
            'default_sets', 'default_reps', 'default_hold_seconds', 'default_days_per_week',
            'phase_confirmation_ms', 'max_cues',
            'tracking_notes', 'tracking_warning',
            'tracked_angles_config', 'phases_config', 'cues_config',
            'calibration_config', 'symmetry_config', 'stage_images',
            'is_active', 'sort_order',
        ]


class PrescriptionSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source='exercise.name', read_only=True)
    patient_name = serializers.SerializerMethodField()
    clinician_name = serializers.SerializerMethodField()

    class Meta:
        model  = Prescription
        fields = [
            'id', 'patient', 'patient_name', 'exercise', 'exercise_name',
            'clinician', 'clinician_name',
            'sets', 'reps', 'hold_seconds', 'days_per_week', 'notes',
            'is_active', 'valid_from', 'valid_until',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'clinician', 'created_at', 'updated_at']

    def get_patient_name(self, obj):
        return obj.patient.user.get_full_name().strip() or obj.patient.user.email

    def get_clinician_name(self, obj):
        if not obj.clinician_id:
            return None
        return (
            obj.clinician.user.get_full_name().strip()
            or obj.clinician.user.email
        )

    def validate(self, attrs):
        valid_from = attrs.get('valid_from', getattr(self.instance, 'valid_from', None))
        valid_until = attrs.get('valid_until', getattr(self.instance, 'valid_until', None))
        if valid_until and valid_from and valid_until < valid_from:
            raise serializers.ValidationError({
                'valid_until': 'The end date cannot be before the start date.'
            })

        exercise = attrs.get('exercise', getattr(self.instance, 'exercise', None))
        if exercise and not exercise.is_active:
            raise serializers.ValidationError({
                'exercise': 'This exercise is not active.'
            })

        request = self.context.get('request')
        if request and request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if not getattr(request.user, 'is_clinician', False):
                raise serializers.ValidationError(
                    'Only a clinician can create or change a prescription.'
                )
            patient = attrs.get('patient', getattr(self.instance, 'patient', None))
            clinician = getattr(request.user, 'clinician_profile', None)
            if not patient or patient.primary_clinician_id != getattr(clinician, 'id', None):
                raise serializers.ValidationError({
                    'patient': 'Select a patient linked to your clinician account.'
                })
        return attrs


class CalibrationSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source='exercise.name', read_only=True)

    class Meta:
        model  = Calibration
        fields = [
            'id', 'exercise', 'exercise_name', 'version', 'affected_side',
            'captured_at', 'start_measurements', 'target_measurements',
            'phase_ranges', 'natural_knee_difference', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']
