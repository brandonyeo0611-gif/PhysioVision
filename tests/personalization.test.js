import assert from "node:assert/strict";

import { EXERCISE_MAP } from "../exercises/registry.js";
import {
  applyCalibration,
  createCalibration,
  validateCalibrationCapture,
} from "../personalization.js";

const halfSquat = EXERCISE_MAP["half-squats"];

function frames(values, count = 12) {
  return Array.from({ length: count }, (_, index) =>
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        value + ((index % 3) - 1) * 0.3,
      ])
    )
  );
}

const standing = frames({
  leftKnee: 172,
  rightKnee: 170,
  leftHip: 166,
  rightHip: 165,
  torsoLean: 8,
  leftKneeForwardRatio: 0,
  rightKneeForwardRatio: 0,
});

const targetCaptures = [
  frames({
    leftKnee: 132,
    rightKnee: 130,
    leftHip: 138,
    rightHip: 136,
    torsoLean: 22,
    leftKneeForwardRatio: 0.05,
    rightKneeForwardRatio: 0.04,
  }),
  frames({
    leftKnee: 128,
    rightKnee: 126,
    leftHip: 134,
    rightHip: 132,
    torsoLean: 23,
    leftKneeForwardRatio: 0.04,
    rightKneeForwardRatio: 0.03,
  }),
  frames({
    leftKnee: 130,
    rightKnee: 128,
    leftHip: 136,
    rightHip: 134,
    torsoLean: 21,
    leftKneeForwardRatio: 0.03,
    rightKneeForwardRatio: 0.04,
  }),
];

{
  const calibration = createCalibration(halfSquat, {
    affectedSide: "right",
    startFrames: standing,
    targetCaptures,
  });

  assert.equal(calibration.target.leftKnee.median, 130);
  assert.equal(calibration.target.rightKnee.median, 128);
  assert.deepEqual(calibration.phaseRanges.squat.leftKnee, [122, 138]);
  assert.deepEqual(calibration.phaseRanges.squat.rightKnee, [120, 136]);
  assert.equal(calibration.naturalKneeDifference, 2);

  const personalised = applyCalibration(halfSquat, calibration);
  const squat = personalised.phases.find((phase) => phase.name === "squat");
  assert.deepEqual(squat.leftKnee, [122, 138]);
  assert.deepEqual(squat.torsoLean, [0, 40]);
  assert.equal(personalised.symmetry.maxDiffDeg, 8);
}

{
  const unsafeLean = frames({
    leftKnee: 130,
    rightKnee: 130,
    leftHip: 135,
    rightHip: 135,
    torsoLean: 45,
    leftKneeForwardRatio: 0,
    rightKneeForwardRatio: 0,
  });

  assert.throws(
    () => validateCalibrationCapture(halfSquat, unsafeLean, "target"),
    /Lift your chest/
  );
}

console.log("personal calibration tests passed");
