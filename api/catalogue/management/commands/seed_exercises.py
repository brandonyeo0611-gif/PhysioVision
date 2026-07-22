from django.core.management.base import BaseCommand
from api.catalogue.models import Exercise

EXERCISES = [
    {
        "id": "heel-cord-stretch",
        "name": "Heel Cord Stretch",
        "category": "stretch",
        "camera_direction": "front",
        "rep_rule": "neutral → stretch → hold",
        "default_sets": 2,
        "default_reps": 4,
        "default_hold_seconds": 30,
        "default_days_per_week": "6–7",
        "tracking_notes": "Side camera; back leg ankle/footIndex landmarks must be visible.",
        "tracked_angles_config": {
            "ankle": {"points": ["knee", "ankle", "footIndex"], "side": "affected"},
        },
        "phases_config": [
            {"name": "neutral", "ankle": [88, 115]},
            {"name": "stretch",  "ankle": [50, 87]},
        ],
        "cues_config": {
            "ankle>92": "Lean forward more to feel the stretch in the calf",
        },
        "stage_images": ["standing", "calf-stretch"],
        "sort_order": 1,
    },
    {
        "id": "standing-quad-stretch",
        "name": "Standing Quadriceps Stretch",
        "category": "stretch",
        "camera_direction": "front",
        "rep_rule": "standing → stretch → hold",
        "default_sets": 1,
        "default_reps": 3,
        "default_hold_seconds": 45,
        "default_days_per_week": "4–5",
        "tracking_notes": "Side camera. Ankle landmark may be partially occluded when heel is raised; flag low-confidence.",
        "tracked_angles_config": {
            "knee": {"points": ["hip", "knee", "ankle"], "side": "affected"},
        },
        "phases_config": [
            {"name": "standing", "knee": [155, 180]},
            {"name": "stretch",  "knee": [30, 70]},
        ],
        "cues_config": {
            "knee>80": "Pull heel closer to your buttock for a deeper stretch",
        },
        "stage_images": ["standing", "quad-stretch"],
        "sort_order": 2,
    },
    {
        "id": "supine-hamstring-stretch",
        "name": "Supine Hamstring Stretch",
        "category": "stretch",
        "camera_direction": "front",
        "rep_rule": "flat → stretch → hold",
        "default_sets": 1,
        "default_reps": 3,
        "default_hold_seconds": 45,
        "default_days_per_week": "4–5",
        "tracking_notes": "Supine (lying) — side camera. Keep leg in sagittal plane for clean angle reads.",
        "tracked_angles_config": {
            "hip":  {"points": ["shoulder", "hip",  "knee"],  "side": "affected"},
            "knee": {"points": ["hip",      "knee", "ankle"], "side": "affected"},
        },
        "phases_config": [
            {"name": "flat",    "hip": [155, 180], "knee": [155, 180]},
            {"name": "stretch", "hip": [60, 110],  "knee": [130, 180]},
        ],
        "cues_config": {
            "knee<120": "Try to straighten your knee more while holding the stretch",
        },
        "stage_images": ["lying-flat", "lying-leg-raised"],
        "sort_order": 3,
    },
    {
        "id": "half-squats",
        "name": "Half Squats",
        "category": "strengthening",
        "camera_direction": "front",
        "rep_rule": "standing → squat → standing",
        "default_sets": 3,
        "default_reps": 10,
        "default_hold_seconds": 5,
        "default_days_per_week": "4–5",
        "phase_confirmation_ms": 300,
        "max_cues": 1,
        "tracking_warning": "Face the camera and keep both feet, knees, hips, and shoulders fully visible.",
        "tracked_angles_config": {
            "leftKnee":  {"points": ["leftHip",  "leftKnee",  "leftAnkle"]},
            "rightKnee": {"points": ["rightHip", "rightKnee", "rightAnkle"]},
            "leftHip":   {"points": ["leftShoulder",  "leftHip",  "leftKnee"]},
            "rightHip":  {"points": ["rightShoulder", "rightHip", "rightKnee"]},
            "torsoLean": {"points": ["leftShoulder", "rightShoulder", "leftHip", "rightHip"]},
            "leftKneeForwardRatio":  {"points": ["nose", "leftKnee",  "leftAnkle",  "leftFootIndex"]},
            "rightKneeForwardRatio": {"points": ["nose", "rightKnee", "rightAnkle", "rightFootIndex"]},
        },
        "phases_config": [
            {
                "name": "standing",
                "leftKnee": [160, 180], "rightKnee": [160, 180],
                "leftHip": [155, 180],  "rightHip": [155, 180],
                "torsoLean": [0, 25],
                "leftKneeForwardRatio": [-1, 0.15], "rightKneeForwardRatio": [-1, 0.15],
            },
            {
                "name": "squat",
                "leftKnee": [90, 130], "rightKnee": [90, 130],
                "leftHip": [90, 135],  "rightHip": [90, 135],
                "torsoLean": [0, 40],
                "leftKneeForwardRatio": [-1, 0.15], "rightKneeForwardRatio": [-1, 0.15],
            },
        ],
        "cues_config": {
            "leftKnee<90":  "Don't go too deep — this is a half squat only",
            "rightKnee<90": "Don't go too deep — this is a half squat only",
            "torsoLean>40": "Lift your chest slightly — avoid leaning too far forward",
            "leftKneeForwardRatio>0.15":  "Move your left knee back so it stays over your foot",
            "rightKneeForwardRatio>0.15": "Move your right knee back so it stays over your foot",
            "kneeDiff>15": "Keep both knees bending equally",
        },
        "calibration_config": {
            "startPhase": "standing",
            "targetPhase": "squat",
            "captureKeys": ["leftKnee", "rightKnee", "leftHip", "rightHip", "torsoLean", "leftKneeForwardRatio", "rightKneeForwardRatio"],
            "personalizedKeys": ["leftKnee", "rightKnee", "leftHip", "rightHip"],
            "toleranceDegrees": 8,
            "safeRanges": {
                "start": {
                    "leftKnee": [145, 180], "rightKnee": [145, 180],
                    "leftHip": [145, 180],  "rightHip": [145, 180],
                    "torsoLean": [0, 25],
                    "leftKneeForwardRatio": [-1, 0.15], "rightKneeForwardRatio": [-1, 0.15],
                },
                "target": {
                    "leftKnee": [90, 145], "rightKnee": [90, 145],
                    "leftHip": [90, 150],  "rightHip": [90, 150],
                    "torsoLean": [0, 40],
                    "leftKneeForwardRatio": [-1, 0.15], "rightKneeForwardRatio": [-1, 0.15],
                },
            },
            "captureErrors": {
                "leftKnee":  "Use a comfortable half-squat depth and do not bend past 90°.",
                "rightKnee": "Use a comfortable half-squat depth and do not bend past 90°.",
                "leftHip":   "Use a smaller, comfortable movement for this calibration.",
                "rightHip":  "Use a smaller, comfortable movement for this calibration.",
                "torsoLean": "Lift your chest and try the measurement again.",
                "leftKneeForwardRatio":  "Move your knees back over your feet, then try again.",
                "rightKneeForwardRatio": "Move your knees back over your feet, then try again.",
            },
        },
        "symmetry_config": {"joint": "knee", "maxDiffDeg": 15},
        "stage_images": ["standing", "squat", "standing"],
        "sort_order": 4,
    },
    {
        "id": "hamstring-curls",
        "name": "Hamstring Curls",
        "category": "strengthening",
        "camera_direction": "front",
        "rep_rule": "standing → curled → standing",
        "default_sets": 3,
        "default_reps": 10,
        "default_hold_seconds": 5,
        "default_days_per_week": "4–5",
        "tracking_warning": "Ankle moves behind the body — depth inference is less accurate at peak curl. Angle readings are approximate.",
        "tracked_angles_config": {
            "knee": {"points": ["hip", "knee", "ankle"], "side": "affected"},
        },
        "phases_config": [
            {"name": "standing", "knee": [160, 180]},
            {"name": "curled",   "knee": [30, 70]},
        ],
        "cues_config": {
            "knee>90": "Curl higher — bring your heel up toward the ceiling",
        },
        "stage_images": ["standing", "knee-curled", "standing"],
        "sort_order": 5,
    },
    {
        "id": "calf-raises",
        "name": "Calf Raises",
        "category": "strengthening",
        "camera_direction": "front",
        "rep_rule": "flat → raised → flat",
        "default_sets": 2,
        "default_reps": 10,
        "default_hold_seconds": 0,
        "default_days_per_week": "6–7",
        "tracked_angles_config": {
            "footInclination": {"points": ["heel", "footIndex"], "side": "affected"},
        },
        "phases_config": [
            {"name": "flat",   "footInclination": [0, 12]},
            {"name": "raised", "footInclination": [18, 50]},
        ],
        "cues_config": {
            "footInclination<18": "Rise higher onto your toes",
        },
        "stage_images": ["standing", "calf-raised", "standing"],
        "sort_order": 6,
    },
    {
        "id": "leg-extensions",
        "name": "Leg Extensions (Seated)",
        "category": "strengthening",
        "camera_direction": "front",
        "rep_rule": "seated → extended → seated",
        "default_sets": 3,
        "default_reps": 10,
        "default_hold_seconds": 5,
        "default_days_per_week": "4–5",
        "tracked_angles_config": {
            "knee": {"points": ["hip", "knee", "ankle"], "side": "affected"},
        },
        "phases_config": [
            {"name": "seated",   "knee": [80, 105]},
            {"name": "extended", "knee": [155, 180]},
        ],
        "cues_config": {
            "knee<150": "Try to straighten your leg fully at the top",
        },
        "stage_images": ["seated", "seated-leg-extended", "seated"],
        "sort_order": 7,
    },
    {
        "id": "straight-leg-raises-supine",
        "name": "Straight-Leg Raises (Supine)",
        "category": "strengthening",
        "camera_direction": "front",
        "rep_rule": "flat → raised → flat",
        "default_sets": 3,
        "default_reps": 10,
        "default_hold_seconds": 5,
        "default_days_per_week": "4–5",
        "tracked_angles_config": {
            "hip":  {"points": ["shoulder", "hip",  "knee"],  "side": "affected"},
            "knee": {"points": ["hip",      "knee", "ankle"], "side": "affected"},
        },
        "phases_config": [
            {"name": "flat",   "hip": [155, 180], "knee": [155, 180]},
            {"name": "raised", "hip": [125, 155], "knee": [155, 180]},
        ],
        "cues_config": {
            "knee<150": "Keep your leg straight — don't bend the knee",
            "hip<120":  "Lower leg slightly — 6 to 10 inches off the floor is enough",
        },
        "stage_images": ["lying-flat", "lying-leg-raised", "lying-flat"],
        "sort_order": 8,
    },
    {
        "id": "straight-leg-raises-prone",
        "name": "Straight-Leg Raises (Prone)",
        "category": "strengthening",
        "camera_direction": "front",
        "rep_rule": "flat → raised → flat",
        "default_sets": 3,
        "default_reps": 10,
        "default_hold_seconds": 5,
        "default_days_per_week": "4–5",
        "tracking_notes": "Prone position — face down. Landmark visibility will be low on many joints. Flag liberally.",
        "tracking_warning": "High occlusion risk in prone position; side camera essential.",
        "tracked_angles_config": {
            "hip":  {"points": ["shoulder", "hip",  "knee"],  "side": "affected"},
            "knee": {"points": ["hip",      "knee", "ankle"], "side": "affected"},
        },
        "phases_config": [
            {"name": "flat",   "hip": [165, 185], "knee": [155, 180]},
            {"name": "raised", "hip": [185, 210], "knee": [155, 180]},
        ],
        "cues_config": {
            "knee<150": "Keep your knee straight while lifting",
        },
        "stage_images": ["prone-flat", "prone-leg-raised", "prone-flat"],
        "sort_order": 9,
    },
    {
        "id": "hip-abduction",
        "name": "Hip Abduction",
        "category": "strengthening",
        "camera_direction": "front",
        "rep_rule": "rest → abducted → rest",
        "default_sets": 3,
        "default_reps": 20,
        "default_hold_seconds": 5,
        "default_days_per_week": "4–5",
        "tracking_notes": "Side-lying; front camera shows frontal-plane motion. Top-side hip/knee landmarks may partially occlude. Flag aggressively.",
        "tracking_warning": "Side-lying position: expect frequent low-confidence flags on affected-side landmarks.",
        "tracked_angles_config": {
            "hip": {"points": ["shoulder", "hip", "knee"], "side": "affected"},
        },
        "phases_config": [
            {"name": "rest",     "hip": [160, 180]},
            {"name": "abducted", "hip": [125, 145]},
        ],
        "cues_config": {
            "hip>150": "Lift the leg higher — aim for a 45° angle from your body",
        },
        "stage_images": ["side-lying", "side-lying-abducted", "side-lying"],
        "sort_order": 10,
    },
    {
        "id": "hip-adduction",
        "name": "Hip Adduction",
        "category": "strengthening",
        "camera_direction": "front",
        "rep_rule": "rest → adducted → rest",
        "default_sets": 3,
        "default_reps": 20,
        "default_hold_seconds": 5,
        "default_days_per_week": "4–5",
        "tracking_notes": "Side-lying on injured side. Bottom leg likely partially occluded by upper body. Expect very high low-confidence rate.",
        "tracking_warning": "Most reliable when patient is visible from a 45° elevated front angle.",
        "tracked_angles_config": {
            "hip": {"points": ["shoulder", "hip", "knee"], "side": "affected"},
        },
        "phases_config": [
            {"name": "rest",     "hip": [160, 180]},
            {"name": "adducted", "hip": [145, 159]},
        ],
        "cues_config": {
            "hip>163": "Lift the bottom leg off the floor — 6 to 8 inches is the target",
        },
        "stage_images": ["side-lying", "side-lying-abducted", "side-lying"],
        "sort_order": 11,
    },
    {
        "id": "leg-presses",
        "name": "Leg Presses (Elastic Band)",
        "category": "strengthening",
        "camera_direction": "front",
        "rep_rule": "bent → extended → bent",
        "default_sets": 3,
        "default_reps": 10,
        "default_hold_seconds": 2,
        "default_days_per_week": "4–5",
        "tracking_notes": "Supine. Side camera gives cleanest sagittal-plane read.",
        "tracked_angles_config": {
            "hip":  {"points": ["shoulder", "hip",  "knee"],  "side": "affected"},
            "knee": {"points": ["hip",      "knee", "ankle"], "side": "affected"},
        },
        "phases_config": [
            {"name": "bent",     "hip": [70, 110],  "knee": [70, 105]},
            {"name": "extended", "hip": [140, 180], "knee": [150, 180]},
        ],
        "cues_config": {
            "knee<150": "Press fully against the band — straighten your leg completely",
        },
        "stage_images": ["lying-knees-bent", "lying-legs-extended", "lying-knees-bent"],
        "sort_order": 12,
    },
]


class Command(BaseCommand):
    help = "Seed exercise catalogue from registry.js data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all existing exercises before seeding",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            Exercise.objects.all().delete()
            self.stdout.write(self.style.WARNING("Cleared all existing exercises."))

        created = updated = 0
        for data in EXERCISES:
            _, is_new = Exercise.objects.update_or_create(
                id=data["id"],
                defaults={k: v for k, v in data.items() if k != "id"},
            )
            if is_new:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done — {created} created, {updated} updated. "
                f"{Exercise.objects.filter(is_active=True).count()} exercises active."
            )
        )
