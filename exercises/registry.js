/**
 * Exercise rule specifications for the AAOS Knee Conditioning Programme.
 * Source: https://www.orthoinfo.org/recovery/knee-conditioning-program
 *
 * Each entry defines:
 *   - Which joint angles to measure (using the landmark triples from geometry.js)
 *   - Target angle ranges per phase (degrees)
 *   - Which angles constitute a completed rep (repRule state machine)
 *   - Symmetry constraints where both sides are in frame
 *   - Coaching cues triggered by out-of-range angles
 *
 * Camera setup: fixed frontal camera, chest height, 2–3 m from user, full body in frame.
 * Angles use MediaPipe worldLandmarks (3D metric, hip-centred) so they are computed in
 * true 3D space and remain valid from a frontal viewpoint — depth is inferred by the model.
 *
 * Angle convention (all from geometry.js `angle(A, B, C)`):
 *   knee  = angle(hip,      knee,   ankle)     — 180° = fully extended
 *   hip   = angle(shoulder, hip,    knee)      — 180° = fully extended / lying flat
 *   ankle = angle(knee,     ankle,  footIndex) — ~90° = neutral standing
 *
 * For side-lying exercises the hip angle (shoulder→hip→knee) still works:
 *   leg in line with trunk ≈ 170–180°, leg lifted 45° ≈ 125–135°.
 */

export const EXERCISES = [
  // ── Stretches ─────────────────────────────────────────────────────────────

  {
    id: "heel-cord-stretch",
    name: "Heel Cord Stretch",
    category: "stretch",
    prescription: { sets: 2, reps: 4, holdSeconds: 30, daysPerWeek: "6–7" },
    camera: "front",
    // Primary: ankle dorsiflexion of the back (affected) leg.
    // Measured as angle(knee, ankle, footIndex).
    // Neutral standing ≈ 90°; calf on stretch (dorsiflexed) < 85°.
    trackedAngles: {
      ankle: { points: ["knee", "ankle", "footIndex"], side: "affected" },
    },
    phases: [
      { name: "neutral", ankle: [88, 115] },
      { name: "stretch",  ankle: [50, 87] },   // no overlap with neutral — frontal depth inference is imprecise
    ],
    repRule: "neutral → stretch → hold",
    stageImages: ["standing", "calf-stretch"],
    cues: {
      "ankle>92": "Lean forward more to feel the stretch in the calf",
    },
    trackingNotes: "Side camera; back leg ankle/footIndex landmarks must be visible.",
  },

  {
    id: "standing-quad-stretch",
    name: "Standing Quadriceps Stretch",
    category: "stretch",
    prescription: { sets: 1, reps: 3, holdSeconds: 45, daysPerWeek: "4–5" },
    camera: "front",
    // Affected knee flexes deeply — heel drawn toward buttock.
    trackedAngles: {
      knee: { points: ["hip", "knee", "ankle"], side: "affected" },
    },
    phases: [
      { name: "standing", knee: [155, 180] },
      { name: "stretch",  knee: [30, 70] },    // deeply flexed, heel near buttock
    ],
    repRule: "standing → stretch → hold",
    stageImages: ["standing", "quad-stretch"],
    cues: {
      "knee>80": "Pull heel closer to your buttock for a deeper stretch",
    },
    trackingNotes: "Side camera. Ankle landmark may be partially occluded when heel is raised; flag low-confidence.",
  },

  {
    id: "supine-hamstring-stretch",
    name: "Supine Hamstring Stretch",
    category: "stretch",
    prescription: { sets: 1, reps: 3, holdSeconds: 45, daysPerWeek: "4–5" },
    camera: "front",
    // Hip flexes (leg pulled toward chest), knee should stay as extended as possible.
    trackedAngles: {
      hip:  { points: ["shoulder", "hip",  "knee"],  side: "affected" },
      knee: { points: ["hip",      "knee", "ankle"], side: "affected" },
    },
    phases: [
      { name: "flat",    hip: [155, 180], knee: [155, 180] },
      { name: "stretch", hip: [60, 110],  knee: [130, 180] }, // hip flexed, knee as straight as possible
    ],
    repRule: "flat → stretch → hold",
    stageImages: ["lying-flat", "lying-leg-raised"],
    cues: {
      "knee<120": "Try to straighten your knee more while holding the stretch",
    },
    trackingNotes: "Supine (lying) — side camera. Keep leg in sagittal plane for clean angle reads.",
  },

  // ── Strengthening ─────────────────────────────────────────────────────────

  {
    id: "half-squats",
    name: "Half Squats",
    category: "strengthening",
    prescription: { sets: 3, reps: 10, holdSeconds: 5, daysPerWeek: "4–5" },
    camera: "front",   // side gives cleanest knee/hip angles; front works for symmetry
    trackedAngles: {
      leftKnee:  { points: ["leftHip",  "leftKnee",  "leftAnkle"]  },
      rightKnee: { points: ["rightHip", "rightKnee", "rightAnkle"] },
      leftHip:   { points: ["leftShoulder",  "leftHip",  "leftKnee"]  },
      rightHip:  { points: ["rightShoulder", "rightHip", "rightKnee"] },
    },
    phases: [
      { name: "standing", knee: [160, 180], hip: [155, 180] },
      { name: "squat",    knee: [90, 130],  hip: [90, 130]  }, // ~10-inch descent
    ],
    repRule: "standing → squat → standing",
    stageImages: ["standing", "squat", "standing"],
    symmetry: { joint: "knee", maxDiffDeg: 15 },
    cues: {
      "knee<90":       "Don't go too deep — this is a half squat only",
      "kneeDiff>15":   "Keep both knees bending equally",
      "kneeForwardOfToe": "Keep knees behind toes",
    },
  },

  {
    id: "hamstring-curls",
    name: "Hamstring Curls",
    category: "strengthening",
    prescription: { sets: 3, reps: 10, holdSeconds: 5, daysPerWeek: "4–5" },
    camera: "front",
    trackingWarning: "Ankle moves behind the body — depth inference is less accurate at peak curl. Angle readings are approximate.",
    // Standing; affected knee flexes, heel rises toward ceiling.
    trackedAngles: {
      knee: { points: ["hip", "knee", "ankle"], side: "affected" },
    },
    phases: [
      { name: "standing", knee: [160, 180] },
      { name: "curled",   knee: [30, 70]   }, // heel toward ceiling
    ],
    repRule: "standing → curled → standing",
    stageImages: ["standing", "knee-curled", "standing"],
    cues: {
      "knee>90": "Curl higher — bring your heel up toward the ceiling",
    },
  },

  {
    id: "calf-raises",
    name: "Calf Raises",
    category: "strengthening",
    prescription: { sets: 2, reps: 10, holdSeconds: 0, daysPerWeek: "6–7" },
    camera: "front",
    // Foot inclination: degrees the foot rises above horizontal (floor), 0° when flat.
    // ~0–10° standing flat; ~20–45° on tiptoe. Directly captures heel elevation.
    trackedAngles: {
      footInclination: { points: ["heel", "footIndex"], side: "affected" },
    },
    phases: [
      { name: "flat",   footInclination: [0, 12]  },
      { name: "raised", footInclination: [18, 50] },
    ],
    repRule: "flat → raised → flat",
    stageImages: ["standing", "calf-raised", "standing"],
    cues: {
      "footInclination<18": "Rise higher onto your toes",
    },
  },

  {
    id: "leg-extensions",
    name: "Leg Extensions (Seated)",
    category: "strengthening",
    prescription: { sets: 3, reps: 10, holdSeconds: 5, daysPerWeek: "4–5" },
    camera: "front",
    // Seated on chair; knee extends from ~90° to full extension.
    trackedAngles: {
      knee: { points: ["hip", "knee", "ankle"], side: "affected" },
    },
    phases: [
      { name: "seated",   knee: [80, 105]  }, // at rest on chair
      { name: "extended", knee: [155, 180] }, // leg straightened out
    ],
    repRule: "seated → extended → seated",
    stageImages: ["seated", "seated-leg-extended", "seated"],
    cues: {
      "knee<150": "Try to straighten your leg fully at the top",
    },
  },

  {
    id: "straight-leg-raises-supine",
    name: "Straight-Leg Raises (Supine)",
    category: "strengthening",
    prescription: { sets: 3, reps: 10, holdSeconds: 5, daysPerWeek: "4–5" },
    camera: "front",
    // Lying on back; affected leg lifts 6–10 inches with knee kept straight.
    trackedAngles: {
      hip:  { points: ["shoulder", "hip",  "knee"],  side: "affected" },
      knee: { points: ["hip",      "knee", "ankle"], side: "affected" },
    },
    phases: [
      { name: "flat",   hip: [155, 180], knee: [155, 180] },
      { name: "raised", hip: [125, 155], knee: [155, 180] }, // 6–10 inch lift ≈ 25–35° hip flexion
    ],
    repRule: "flat → raised → flat",
    stageImages: ["lying-flat", "lying-leg-raised", "lying-flat"],
    cues: {
      "knee<150":  "Keep your leg straight — don't bend the knee",
      "hip<120":   "Lower leg slightly — 6 to 10 inches off the floor is enough",
    },
  },

  {
    id: "straight-leg-raises-prone",
    name: "Straight-Leg Raises (Prone)",
    category: "strengthening",
    prescription: { sets: 3, reps: 10, holdSeconds: 5, daysPerWeek: "4–5" },
    camera: "front",
    // Lying face-down; hip extends (leg lifts toward ceiling).
    // Hip extension beyond neutral: angle(shoulder, hip, knee) increases past 180° is
    // not directly computable, so we track relative change: start ≈ 170–180°,
    // raised ≈ 185–200° (landmark coords allow >180° in world space).
    trackedAngles: {
      hip:  { points: ["shoulder", "hip",  "knee"],  side: "affected" },
      knee: { points: ["hip",      "knee", "ankle"], side: "affected" },
    },
    phases: [
      { name: "flat",   hip: [165, 185], knee: [155, 180] },
      { name: "raised", hip: [185, 210], knee: [155, 180] }, // hip extension past neutral
    ],
    repRule: "flat → raised → flat",
    stageImages: ["prone-flat", "prone-leg-raised", "prone-flat"],
    cues: {
      "knee<150": "Keep your knee straight while lifting",
    },
    trackingNotes: "Prone position — face down. Landmark visibility will be low on many joints. Flag liberally.",
    trackingWarning: "High occlusion risk in prone position; side camera essential.",
  },

  {
    id: "hip-abduction",
    name: "Hip Abduction",
    category: "strengthening",
    prescription: { sets: 3, reps: 20, holdSeconds: 5, daysPerWeek: "4–5" },
    camera: "front",
    // Side-lying; top (affected) leg lifts to ~45°.
    // Measured as angle(shoulder, hip, knee) on the top side:
    //   leg in line with trunk ≈ 170–180°; abducted 45° ≈ 125–135°.
    trackedAngles: {
      hip: { points: ["shoulder", "hip", "knee"], side: "affected" },
    },
    phases: [
      { name: "rest",     hip: [160, 180] },
      { name: "abducted", hip: [125, 145] }, // 45° abduction
    ],
    repRule: "rest → abducted → rest",
    stageImages: ["side-lying", "side-lying-abducted", "side-lying"],
    cues: {
      "hip>150": "Lift the leg higher — aim for a 45° angle from your body",
    },
    trackingNotes: "Side-lying; front camera shows frontal-plane motion. Top-side hip/knee landmarks may partially occlude. Flag aggressively.",
    trackingWarning: "Side-lying position: expect frequent low-confidence flags on affected-side landmarks.",
  },

  {
    id: "hip-adduction",
    name: "Hip Adduction",
    category: "strengthening",
    prescription: { sets: 3, reps: 20, holdSeconds: 5, daysPerWeek: "4–5" },
    camera: "front",
    // Side-lying on injured side; bottom (injured) leg lifts 6–8 inches.
    // Same angle definition — angle(shoulder, hip, knee) — but on the bottom side.
    trackedAngles: {
      hip: { points: ["shoulder", "hip", "knee"], side: "affected" },
    },
    phases: [
      { name: "rest",     hip: [160, 180] },
      { name: "adducted", hip: [145, 159] }, // top at 159 to avoid overlap with rest (160+)
    ],
    repRule: "rest → adducted → rest",
    stageImages: ["side-lying", "side-lying-abducted", "side-lying"],
    cues: {
      "hip>163": "Lift the bottom leg off the floor — 6 to 8 inches is the target",
    },
    trackingNotes: "Side-lying on injured side. Bottom leg likely partially occluded by upper body. Expect very high low-confidence rate.",
    trackingWarning: "Most reliable when patient is visible from a 45° elevated front angle.",
  },

  {
    id: "leg-presses",
    name: "Leg Presses (Elastic Band)",
    category: "strengthening",
    prescription: { sets: 3, reps: 10, holdSeconds: 2, daysPerWeek: "4–5" },
    camera: "front",
    // Supine; elastic band around foot arch; knee and hip extend against resistance.
    trackedAngles: {
      hip:  { points: ["shoulder", "hip",  "knee"],  side: "affected" },
      knee: { points: ["hip",      "knee", "ankle"], side: "affected" },
    },
    phases: [
      { name: "bent",     hip: [70, 110],  knee: [70, 105]  }, // start — knees pulled in
      { name: "extended", hip: [140, 180], knee: [150, 180] }, // legs pressed out straight
    ],
    repRule: "bent → extended → bent",
    stageImages: ["lying-knees-bent", "lying-legs-extended", "lying-knees-bent"],
    cues: {
      "knee<150": "Press fully against the band — straighten your leg completely",
    },
    trackingNotes: "Supine. Side camera gives cleanest sagittal-plane read.",
  },
];

// Quick lookup by exercise id.
// basic fildering
export const EXERCISE_MAP = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
