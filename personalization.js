import { patchMe, isLoggedIn } from "./api.js";

const PROFILE_KEY = "physiovision.profile.v1";
const CALIBRATION_KEY = "physiovision.calibrations.v1";

const DEFAULT_PROFILE = Object.freeze({
  name: "",
  age: "",
  goal: "Stronger knees",
  activity: "Lightly active",
  mobility: "Independent",
  focusSide: "right",
  cueStyle: "gentle",
  carePath: "wellness",
});

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadProfile() {
  return { ...DEFAULT_PROFILE, ...readJson(PROFILE_KEY, {}) };
}

export function hasSavedProfile() {
  try {
    return window.localStorage.getItem(PROFILE_KEY) !== null;
  } catch (_) {
    return false;
  }
}

export function saveProfile(profile) {
  const previous = loadProfile();
  const next = {
    ...previous,
    ...profile,
    name: String(profile.name ?? previous.name).trim().slice(0, 60),
    age: normaliseAge(profile.age ?? previous.age),
    updatedAt: new Date().toISOString(),
  };
  writeJson(PROFILE_KEY, next);
  window.dispatchEvent(
    new CustomEvent("physiovision:profile-updated", { detail: next })
  );

  // Sync to backend — fire and forget, localStorage is the source of truth locally
  if (isLoggedIn()) {
    patchMe({
      goal:            next.goal,
      activity_level:  next.activity,
      mobility_status: next.mobility,
      focus_side:      next.focusSide,
      cue_style:       next.cueStyle,
      care_path:       next.carePath,
    }).catch(() => {});
  }

  return next;
}

function normaliseAge(value) {
  if (value === "" || value === null || value === undefined) return "";
  const age = Math.round(Number(value));
  return Number.isFinite(age) ? Math.min(110, Math.max(18, age)) : "";
}

export function loadCalibrations() {
  return readJson(CALIBRATION_KEY, {});
}

export function getCalibration(exerciseId) {
  return loadCalibrations()[exerciseId] ?? null;
}

export function saveCalibration(calibration) {
  if (!calibration?.exerciseId) throw new Error("Calibration needs an exercise ID.");
  const calibrations = loadCalibrations();
  calibrations[calibration.exerciseId] = calibration;
  writeJson(CALIBRATION_KEY, calibrations);
  window.dispatchEvent(
    new CustomEvent("physiovision:calibration-updated", {
      detail: calibration,
    })
  );
  return calibration;
}

export function clearCalibration(exerciseId) {
  const calibrations = loadCalibrations();
  delete calibrations[exerciseId];
  writeJson(CALIBRATION_KEY, calibrations);
  window.dispatchEvent(
    new CustomEvent("physiovision:calibration-updated", {
      detail: { exerciseId, removed: true },
    })
  );
}

export function resolveMeasurement(key, angles, affectedSide = "right") {
  if (key in angles) return angles[key];
  const sideKey = `${affectedSide}${key[0].toUpperCase()}${key.slice(1)}`;
  return angles[sideKey] ?? null;
}

export function extractCalibrationFrame(exercise, angles, affectedSide) {
  const calibration = exercise.calibration;
  if (!calibration) return null;

  const frame = {};
  for (const key of calibration.captureKeys) {
    const measurement = resolveMeasurement(key, angles, affectedSide);
    if (
      !measurement ||
      measurement.lowConfidence ||
      !Number.isFinite(measurement.value)
    ) {
      return null;
    }
    frame[key] = measurement.value;
  }
  return frame;
}

export function summariseFrames(frames, keys) {
  if (!frames?.length) throw new Error("No visible movement samples were captured.");
  const summary = {};

  for (const key of keys) {
    const values = frames
      .map((frame) => frame[key])
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    if (values.length < 5) {
      throw new Error("Keep all required joints visible for the full measurement.");
    }
    const centre = median(values);
    const deviations = values.map((value) => Math.abs(value - centre));
    summary[key] = {
      median: round(centre),
      variability: round(median(deviations)),
      sampleCount: values.length,
    };
  }
  return summary;
}

export function validateCalibrationCapture(exercise, frames, captureType) {
  const config = exercise.calibration;
  if (!config) throw new Error("This exercise does not support calibration yet.");
  const summary = summariseFrames(frames, config.captureKeys);
  const safeRanges = config.safeRanges?.[captureType] ?? {};

  for (const [key, range] of Object.entries(safeRanges)) {
    const value = summary[key]?.median;
    if (!Number.isFinite(value) || value < range[0] || value > range[1]) {
      const message = config.captureErrors?.[key];
      throw new Error(
        message ?? `Your ${friendlyMeasurement(key)} was outside the safe calibration range.`
      );
    }
  }
  return summary;
}

export function createCalibration(
  exercise,
  { affectedSide, startFrames, targetCaptures }
) {
  const config = exercise.calibration;
  if (!config) throw new Error("This exercise does not support calibration yet.");
  if (!Array.isArray(targetCaptures) || targetCaptures.length < 3) {
    throw new Error("Three comfortable movement samples are required.");
  }

  const start = validateCalibrationCapture(exercise, startFrames, "start");
  const targetSummaries = targetCaptures.map((frames) =>
    validateCalibrationCapture(exercise, frames, "target")
  );
  const target = {};

  for (const key of config.captureKeys) {
    const values = targetSummaries.map((summary) => summary[key].median);
    target[key] = {
      median: round(median(values)),
      variability: round(median(values.map((value) => Math.abs(value - median(values))))),
      repetitions: values.length,
    };
  }

  const phaseRanges = {
    [config.startPhase]: makePersonalRanges(
      config.personalizedKeys,
      start,
      config.safeRanges.start,
      config.toleranceDegrees
    ),
    [config.targetPhase]: makePersonalRanges(
      config.personalizedKeys,
      target,
      config.safeRanges.target,
      config.toleranceDegrees
    ),
  };

  const leftKnee = target.leftKnee?.median;
  const rightKnee = target.rightKnee?.median;
  const naturalKneeDifference =
    Number.isFinite(leftKnee) && Number.isFinite(rightKnee)
      ? round(Math.abs(leftKnee - rightKnee))
      : null;

  return {
    version: 1,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    affectedSide,
    capturedAt: new Date().toISOString(),
    start,
    target,
    phaseRanges,
    naturalKneeDifference,
  };
}

function makePersonalRanges(keys, summary, safetyRanges, tolerance = 8) {
  const ranges = {};
  for (const key of keys) {
    const centre = summary[key]?.median;
    const safe = safetyRanges[key];
    if (!Number.isFinite(centre) || !safe) continue;
    const variability = summary[key]?.variability ?? 0;
    const radius = Math.max(tolerance, variability * 3);
    ranges[key] = [
      round(Math.max(safe[0], centre - radius)),
      round(Math.min(safe[1], centre + radius)),
    ];
  }
  return ranges;
}

export function applyCalibration(exercise, calibration) {
  const copy = {
    ...exercise,
    prescription: { ...exercise.prescription },
    phases: exercise.phases.map((phase) => ({ ...phase })),
    symmetry: exercise.symmetry ? { ...exercise.symmetry } : undefined,
  };

  if (
    !calibration ||
    calibration.version !== 1 ||
    calibration.exerciseId !== exercise.id
  ) {
    return copy;
  }

  copy.phases = copy.phases.map((phase) => ({
    ...phase,
    ...(calibration.phaseRanges?.[phase.name] ?? {}),
  }));
  copy.activeCalibration = calibration;

  // Natural asymmetry is recorded for trend comparisons, but calibration is
  // never allowed to loosen the exercise's existing safety limit.
  if (copy.symmetry && Number.isFinite(calibration.naturalKneeDifference)) {
    copy.symmetry.maxDiffDeg = Math.min(
      copy.symmetry.maxDiffDeg,
      Math.max(8, calibration.naturalKneeDifference + 5)
    );
  }
  return copy;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function friendlyMeasurement(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}
