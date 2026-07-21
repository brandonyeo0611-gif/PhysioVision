import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

import { jointAngles, symmetry, VISIBILITY_THRESHOLD } from "./geometry.js";
import { FeedbackEngine, EXERCISES } from "./feedback/engine.js";
import { POSES } from "./poses.js";
import {
  createCalibration,
  extractCalibrationFrame,
  getCalibration,
  hasSavedProfile,
  loadProfile,
  saveCalibration,
  validateCalibrationCapture,
} from "./personalization.js";

// ── EMA smoother ─────────────────────────────────────────────────────────────

const EMA_ALPHA = 0.3;

class AngleSmoother {
  constructor(alpha = EMA_ALPHA) {
    this.alpha = alpha;
    this.state = {};
  }

  smooth(name, raw) {
    if (raw.lowConfidence) {
      delete this.state[name];
      return raw;
    }
    const prev = this.state[name];
    const next =
      prev === undefined ? raw.value : prev + this.alpha * (raw.value - prev);
    this.state[name] = next;
    return { value: next, lowConfidence: false, weakPoints: [] };
  }
}

const smoother = new AngleSmoother();

// ── DOM refs ──────────────────────────────────────────────────────────────────

const video       = document.getElementById("webcam");
const canvas      = document.getElementById("overlay");
const ctx         = canvas.getContext("2d");
const statusEl    = document.getElementById("status");
const toggleBtn   = document.getElementById("toggle");
const fpsEl       = document.getElementById("fps");
const exSelect    = document.getElementById("exerciseSelect");
const sideSelect  = document.getElementById("sideSelect");
const poseStripEl        = document.getElementById("poseStrip");
const repCountEl         = document.getElementById("repCount");
const phaseFlowEl        = document.getElementById("phaseFlow");
const progressEl         = document.getElementById("progressFill");
const progressLbl        = document.getElementById("progressLabel");
const progressSection    = document.getElementById("progressSection");
const holdTimerSection   = document.getElementById("holdTimerSection");
const holdProgressEl     = document.getElementById("holdProgressFill");
const holdInlineEl       = document.getElementById("holdInline");
const holdInlineCountEl  = document.getElementById("holdInlineCountdown");
const cueListEl          = document.getElementById("cueList");
const symWarnEl          = document.getElementById("symWarning");
const trackWarnEl        = document.getElementById("trackingWarning");
const prescEl            = document.getElementById("prescription");
const repTargetEl        = document.getElementById("repTarget");
const feedbackEl         = document.getElementById("feedbackBanner");
const cameraStage        = document.getElementById("cameraStage");
const personalizationTitle  = document.getElementById("personalizationTitle");
const personalizationDetail = document.getElementById("personalizationDetail");
const calibrationBadge      = document.getElementById("calibrationBadge");
const calibrationDetail     = document.getElementById("calibrationDetail");
const openCalibrationBtn    = document.getElementById("openCalibration");
const calibrationOverlay    = document.getElementById("calibrationOverlay");
const calibrationStepLabel  = document.getElementById("calibrationStepLabel");
const calibrationTitle      = document.getElementById("calibrationTitle");
const calibrationInstructions = document.getElementById("calibrationInstructions");
const calibrationStatus     = document.getElementById("calibrationStatus");
const calibrationResult     = document.getElementById("calibrationResult");
const calibrationAction     = document.getElementById("calibrationAction");
const calibrationCancel     = document.getElementById("calibrationCancel");

let profile = loadProfile();
let poseLandmarker = null;

// ── Hold timer state ──────────────────────────────────────────────────────────
let holdInterval  = null;
let holdRemaining = 0;
let holdTotal     = 0;

// ── Personal calibration state ───────────────────────────────────────────────
const CALIBRATION_CAPTURE_MS = 1800;
let calibrationSession = null;
let calibrationDraft = null;

function startHoldTimer(seconds) {
  if (holdInterval) return; // already running
  holdTotal     = seconds;
  holdRemaining = seconds;
  holdInlineEl.classList.add("active");
  holdInlineCountEl.textContent = holdRemaining;
  holdProgressEl.style.width    = "0%";

  holdInterval = setInterval(() => {
    holdRemaining--;
    holdInlineCountEl.textContent = holdRemaining;
    holdProgressEl.style.width    = `${((holdTotal - holdRemaining) / holdTotal) * 100}%`;
    if (holdRemaining <= 0) {
      clearHoldTimer();
      engine.completeHold();
    }
  }, 1000);
}

function clearHoldTimer(resetSeconds) {
  clearInterval(holdInterval);
  holdInterval  = null;
  holdRemaining = 0;
  holdInlineEl.classList.remove("active");
  if (Number.isFinite(resetSeconds)) {
    holdTotal = resetSeconds;
    holdInlineCountEl.textContent = resetSeconds;
    holdProgressEl.style.width = "0%";
  }
}

// ── Exercise selector ─────────────────────────────────────────────────────────

EXERCISES.forEach((ex) => {
  const opt = document.createElement("option");
  opt.value = ex.id;
  opt.textContent = ex.name;
  exSelect.appendChild(opt);
});

sideSelect.value = profile.focusSide;
let engine = new FeedbackEngine(
  EXERCISES[0].id,
  profile.focusSide,
  getCalibration(EXERCISES[0].id)
);
renderPrescription(engine.exercise);
renderTrackingWarning(engine.exercise);
renderPoseStrip(engine.exercise, engine.stages[0]);
renderStaticPhaseFlow(engine);
renderPersonalization();

exSelect.addEventListener("change", () => {
  cancelCalibration();
  engine.changeExercise(
    exSelect.value,
    sideSelect.value,
    getCalibration(exSelect.value)
  );
  smoother.state = {};
  clearHoldTimer(engine.exercise.prescription.holdSeconds);
  holdTimerSection.classList.add("hidden");
  progressSection.classList.remove("hidden");
  renderPrescription(engine.exercise);
  renderTrackingWarning(engine.exercise);
renderPoseStrip(engine.exercise, engine.stages[0]);
renderStaticPhaseFlow(engine);
  repCountEl.textContent = "0";
  cueListEl.innerHTML = "";
  symWarnEl.classList.add("hidden");
  progressEl.style.width = "0%";
  progressLbl.textContent = "Position yourself to start";
  setFeedbackBanner("ready");
  renderPersonalization();
});

sideSelect.addEventListener("change", () => {
  cancelCalibration();
  engine.changeExercise(
    exSelect.value,
    sideSelect.value,
    getCalibration(exSelect.value)
  );
  smoother.state = {};
  repCountEl.textContent = "0";
  progressEl.style.width = "0%";
  setFeedbackBanner("ready");
  renderPersonalization();
});

window.addEventListener("physiovision:profile-updated", (event) => {
  cancelCalibration();
  profile = event.detail;
  sideSelect.value = profile.focusSide;
  engine.changeExercise(
    exSelect.value,
    sideSelect.value,
    getCalibration(exSelect.value)
  );
  smoother.state = {};
  repCountEl.textContent = "0";
  progressEl.style.width = "0%";
  setFeedbackBanner("ready");
  renderPersonalization();
});

// ── MediaPipe setup ───────────────────────────────────────────────────────────

async function createLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  statusEl.textContent = "Movement guide ready";
  toggleBtn.disabled = false;
  renderPersonalization();
}

// ── Camera ────────────────────────────────────────────────────────────────────

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      // "none" requests raw sensor output — prevents OS-level crop/pan (Center Stage)
      resizeMode: "none",
    },
    audio: false,
  });

  // Try to lock zoom to minimum so Center Stage auto-zoom can't fire
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities?.() ?? {};
  if (capabilities.zoom) {
    try {
      await track.applyConstraints({
        advanced: [{ zoom: capabilities.zoom.min }],
      });
    } catch (_) {
      // Device doesn't support zoom constraint — silently ignore
    }
  }

  video.srcObject = stream;
  await video.play();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

function stopCamera() {
  video.srcObject?.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
}

// ── Render loop ───────────────────────────────────────────────────────────────

const drawingUtils = new DrawingUtils(ctx);
let running = false;
let rafId;
let lastVideoTime = -1;
let lastFrameStamp = performance.now();

function renderFrame() {
  if (!running) return;

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const frameTimestamp = performance.now();
    const result = poseLandmarker.detectForVideo(video, frameTimestamp);

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (result.landmarks.length > 0) {
      const landmarks = result.landmarks[0];

      drawingUtils.drawLandmarks(landmarks, {
        radius: 4,
        color: (data) =>
          (data?.from?.visibility ?? 1) < VISIBILITY_THRESHOLD
            ? "#f3d77d"
            : "#76d89b",
      });
      drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
        color: "#dff2e6",
        lineWidth: 3,
      });

      // worldLandmarks for angle math, landmarks for visibility gating
      const raw = jointAngles(result.worldLandmarks[0], landmarks);
      const angles = Object.fromEntries(
        Object.entries(raw).map(([k, a]) => [k, smoother.smooth(k, a)])
      );

      updateDebugPanel(angles);
      if (calibrationSession) {
        updateCalibrationCapture(angles, frameTimestamp);
        statusEl.textContent = "Personal calibration in progress";
      } else {
        updateFeedbackPanel(angles, frameTimestamp);
        statusEl.textContent = "Tracking your movement";
      }
    } else {
      updateCalibrationCapture(null, frameTimestamp);
      const interruptedHold = engine.inHold;
      if (holdInterval) {
        clearHoldTimer(engine.exercise.prescription.holdSeconds);
      }
      statusEl.textContent = "Step back so your full body is visible";
      setFeedbackBanner(
        "position",
        interruptedHold
          ? "Hold reset — return to the stretch to restart"
          : ""
      );
    }

    ctx.restore();

    const now = performance.now();
    fpsEl.textContent = (1000 / (now - lastFrameStamp)).toFixed(0);
    lastFrameStamp = now;
  }

  rafId = requestAnimationFrame(renderFrame);
}

// ── Panel updates ─────────────────────────────────────────────────────────────

function updateFeedbackPanel(angles, timestampMs) {
  const fb = engine.update(angles, timestampMs);

  // Rep counter
  repCountEl.textContent = fb.repCount;

  // Highlight active pose card without re-rendering the whole strip
  poseStripEl.querySelectorAll(".pose-card").forEach((card, i) => {
    card.classList.toggle("active", fb.stages[i] === fb.phase);
  });

  // Phase flow chips
  phaseFlowEl.innerHTML = fb.stages
    .map((s, i) => {
      const active = s === fb.phase ? " active" : "";
      const arrow =
        i < fb.stages.length - 1
          ? '<span class="phase-arrow">→</span>'
          : "";
      return `<span class="phase-chip${active}">${s}</span>${arrow}`;
    })
    .join("");

  // Hold timer vs progress bar — mutually exclusive
  if (fb.inHold) {
    // Switch to hold timer view
    progressSection.classList.add("hidden");
    holdTimerSection.classList.remove("hidden");
    if (fb.trackingReady) {
      startHoldTimer(fb.exercise.prescription.holdSeconds ?? 30);
    } else if (holdInterval) {
      // Fail safely: an uncertain pose cannot earn hold time. Reset so the
      // complete prescribed duration must be tracked after visibility returns.
      clearHoldTimer(fb.exercise.prescription.holdSeconds);
    }
  } else {
    // Cancel timer if user broke position — reset inline display to full hold seconds
    if (holdInterval) clearHoldTimer(fb.exercise.prescription.holdSeconds);
    progressSection.classList.remove("hidden");
    holdTimerSection.classList.add("hidden");

    // Progress bar
    const pct = Math.round(fb.progress * 100);
    progressEl.style.width = `${pct}%`;
    const nextIdx = fb.stages.indexOf(fb.phase) + 1;
    const nextPhase = fb.stages[nextIdx] ?? fb.stages[0];
    progressLbl.textContent =
      pct >= 100
        ? `Get into ${fb.phase} position`
        : `Moving to ${nextPhase}… ${pct}%`;
  }

  // Coaching cues
  const personalizedCues = fb.cues.map(personalizeCue);
  cueListEl.innerHTML = personalizedCues
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join("");
  if (!fb.trackingReady) {
    setFeedbackBanner(
      "tracking",
      fb.inHold
        ? "Hold reset — keep the required joints visible to restart"
        : ""
    );
  } else {
    setFeedbackBanner(
      personalizedCues.length ? "adjust" : "good",
      personalizedCues[0]
    );
  }

  // Symmetry warning
  if (fb.symmetryWarning) {
    symWarnEl.textContent = fb.symmetryWarning;
    symWarnEl.classList.remove("hidden");
  } else {
    symWarnEl.classList.add("hidden");
  }
}

function updateDebugPanel(angles) {
  for (const [name, a] of Object.entries(angles)) {
    const el = document.querySelector(`[data-angle="${name}"]`);
    if (!el) continue;
    if (a.lowConfidence) {
      el.textContent = "hidden";
      el.classList.add("low-conf");
      el.title = `Low visibility: ${a.weakPoints.join(", ")}`;
    } else {
      el.textContent = `${a.value.toFixed(0)}°`;
      el.classList.remove("low-conf");
      el.title = "";
    }
  }

  setSymRow("knee",  angles.leftKnee,  angles.rightKnee);
  setSymRow("elbow", angles.leftElbow, angles.rightElbow);
}

function setSymRow(key, left, right) {
  const el = document.querySelector(`[data-sym="${key}"]`);
  if (!el) return;
  if (!left || !right || left.lowConfidence || right.lowConfidence) {
    el.textContent = "—";
    el.classList.add("low-conf");
    el.title = "Needs both sides visible";
    return;
  }
  el.textContent = `${symmetry(left.value, right.value).toFixed(0)}°`;
  el.classList.remove("low-conf");
  el.title = "";
}

// ── Personal profile and calibration ─────────────────────────────────────────

function renderPersonalization() {
  const savedProfile = hasSavedProfile();
  const calibration = getCalibration(exSelect.value);
  const supportsCalibration = Boolean(engine.exercise.calibration);

  personalizationTitle.textContent = savedProfile
    ? `Guidance for ${profile.name || "you"}`
    : "Set up your profile";
  personalizationDetail.textContent = savedProfile
    ? `${profile.goal} · ${cueStyleLabel(profile.cueStyle)} coaching`
    : "Save your goals, preferences, and comfortable range.";

  if (calibration) {
    const kneeValues = [
      calibration.target?.leftKnee?.median,
      calibration.target?.rightKnee?.median,
    ].filter(Number.isFinite);
    const depth = kneeValues.length
      ? `${Math.round(kneeValues.reduce((sum, value) => sum + value, 0) / kneeValues.length)}° knee target`
      : "comfortable target saved";
    calibrationBadge.textContent = "Personal range active";
    calibrationDetail.textContent = `${depth} · safety limits unchanged`;
    openCalibrationBtn.textContent = "Recalibrate";
  } else if (supportsCalibration) {
    calibrationBadge.textContent = "Standard range";
    calibrationDetail.textContent = `Calibrate ${engine.exercise.name} to your comfortable depth.`;
    openCalibrationBtn.textContent = "Calibrate";
  } else {
    calibrationBadge.textContent = "Standard range";
    calibrationDetail.textContent = "Personal calibration is currently available for Half Squats.";
    openCalibrationBtn.textContent = "Unavailable";
  }

  openCalibrationBtn.disabled = !poseLandmarker || !supportsCalibration;
}

function cueStyleLabel(style) {
  if (style === "direct") return "short, direct";
  if (style === "detailed") return "detailed";
  return "gentle";
}

function personalizeCue(cue) {
  if (!cue) return cue;
  if (profile.cueStyle === "direct") return cue;
  if (profile.cueStyle === "detailed") {
    return `${cue}. Move slowly, then use the guide to check your position again.`;
  }
  return `When you’re ready, ${cue[0].toLowerCase()}${cue.slice(1)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

openCalibrationBtn.addEventListener("click", async () => {
  if (!engine.exercise.calibration) return;
  if (!running && !(await activateCameraGuide())) return;

  calibrationDraft = null;
  calibrationSession = {
    exerciseId: engine.exercise.id,
    step: "intro",
    startFrames: null,
    targetCaptures: [],
    capture: null,
  };
  calibrationOverlay.classList.remove("hidden");
  renderCalibrationStep();
  calibrationAction.focus();
});

calibrationCancel.addEventListener("click", cancelCalibration);

calibrationAction.addEventListener("click", () => {
  if (!calibrationSession) return;

  if (calibrationSession.step === "intro") {
    calibrationSession.step = "start";
    renderCalibrationStep();
  } else if (calibrationSession.step === "start") {
    beginCalibrationCapture("start");
  } else if (calibrationSession.step === "target") {
    beginCalibrationCapture("target");
  } else if (calibrationSession.step === "result" && calibrationDraft) {
    saveCalibration(calibrationDraft);
    engine.changeExercise(
      exSelect.value,
      sideSelect.value,
      calibrationDraft
    );
    smoother.state = {};
    renderPersonalization();
    setFeedbackBanner("ready");
    cancelCalibration();
    statusEl.textContent = "Personal range saved — movement guide ready";
  }
});

function renderCalibrationStep() {
  if (!calibrationSession) return;
  const dots = [...calibrationOverlay.querySelectorAll(".calibration-dots span")];
  const stepIndex = { intro: 0, start: 1, target: 2, result: 3 }[
    calibrationSession.step
  ];
  dots.forEach((dot, index) => dot.classList.toggle("active", index <= stepIndex));
  calibrationStatus.textContent = "";
  calibrationResult.classList.add("hidden");
  calibrationAction.disabled = false;

  if (calibrationSession.step === "intro") {
    calibrationStepLabel.textContent = "Personal calibration · about 1 minute";
    calibrationTitle.textContent = `Fit ${engine.exercise.name} to your movement`;
    calibrationInstructions.textContent =
      "Keep a sturdy chair nearby. We’ll measure your natural standing position, then three comfortable half-squat depths. Stop if you feel pain, dizziness, or unsteadiness.";
    calibrationAction.textContent = "Begin";
  } else if (calibrationSession.step === "start") {
    calibrationStepLabel.textContent = "Step 1 · Starting position";
    calibrationTitle.textContent = "Stand naturally and look forward";
    calibrationInstructions.textContent =
      "Keep both feet, knees, hips, shoulders, and your head visible. Hold still while we measure for two seconds.";
    calibrationAction.textContent = "Measure standing position";
  } else if (calibrationSession.step === "target") {
    const nextRep = calibrationSession.targetCaptures.length + 1;
    calibrationStepLabel.textContent = `Step 2 · Comfortable squat ${nextRep} of 3`;
    calibrationTitle.textContent = "Move to a comfortable half squat";
    calibrationInstructions.textContent =
      "Use the chair for support if needed. Keep your chest lifted and knees over your feet, then hold your comfortable depth.";
    calibrationAction.textContent = `Measure squat ${nextRep}`;
  } else {
    const knees = [
      calibrationDraft?.target.leftKnee?.median,
      calibrationDraft?.target.rightKnee?.median,
    ].filter(Number.isFinite);
    const target = knees.length
      ? Math.round(knees.reduce((sum, value) => sum + value, 0) / knees.length)
      : null;
    calibrationStepLabel.textContent = "Step 3 · Review";
    calibrationTitle.textContent = "Your personal range is ready";
    calibrationInstructions.textContent =
      "This adjusts when a comfortable squat is recognized. Form and safety limits are not relaxed.";
    calibrationResult.innerHTML = `
      <span><strong>${target ?? "—"}°</strong>comfortable knee target</span>
      <span><strong>${calibrationDraft?.naturalKneeDifference ?? "—"}°</strong>natural left/right difference</span>
    `;
    calibrationResult.classList.remove("hidden");
    calibrationAction.textContent = "Save personal range";
  }
  calibrationAction.focus();
}

function beginCalibrationCapture(type) {
  calibrationSession.capture = {
    type,
    startedAt: performance.now(),
    frames: [],
  };
  calibrationAction.disabled = true;
  calibrationStatus.textContent = "Measuring… hold this position";
}

function updateCalibrationCapture(angles, timestampMs) {
  const capture = calibrationSession?.capture;
  if (!capture) return;

  if (angles) {
    const frame = extractCalibrationFrame(
      engine.exercise,
      angles,
      sideSelect.value
    );
    if (frame) capture.frames.push(frame);
  }

  const remaining = Math.max(
    0,
    Math.ceil((CALIBRATION_CAPTURE_MS - (timestampMs - capture.startedAt)) / 1000)
  );
  calibrationStatus.textContent = angles
    ? `Measuring… ${remaining || "almost done"}`
    : "Pause — make sure your full body is visible";

  if (timestampMs - capture.startedAt < CALIBRATION_CAPTURE_MS) return;
  finishCalibrationCapture(capture);
}

function finishCalibrationCapture(capture) {
  calibrationSession.capture = null;
  try {
    validateCalibrationCapture(
      engine.exercise,
      capture.frames,
      capture.type
    );

    if (capture.type === "start") {
      calibrationSession.startFrames = capture.frames;
      calibrationSession.step = "target";
    } else {
      calibrationSession.targetCaptures.push(capture.frames);
      if (calibrationSession.targetCaptures.length >= 3) {
        calibrationDraft = createCalibration(engine.exercise, {
          affectedSide: sideSelect.value,
          startFrames: calibrationSession.startFrames,
          targetCaptures: calibrationSession.targetCaptures,
        });
        calibrationSession.step = "result";
      }
    }
    renderCalibrationStep();
  } catch (error) {
    calibrationAction.disabled = false;
    calibrationStatus.textContent = `${error.message} Try again.`;
  }
}

function cancelCalibration() {
  const wasActive = Boolean(calibrationSession);
  calibrationSession = null;
  calibrationDraft = null;
  calibrationOverlay?.classList.add("hidden");
  if (wasActive) openCalibrationBtn?.focus();
}

// ── Static panel renders ──────────────────────────────────────────────────────

function renderPoseStrip(exercise, activePhase) {
  const images = exercise.stageImages ?? [];
  const stages = engine.stages;
  if (!images.length) { poseStripEl.innerHTML = ""; return; }

  poseStripEl.innerHTML = images.map((poseKey, i) => {
    const svg = POSES[poseKey] ?? "";
    const isLandscape = svg.includes('viewBox="0 0 160');
    const isActive = stages[i] === activePhase;
    const label = stages[i] ?? "";
    const arrow = i < images.length - 1
      ? `<span class="pose-arrow-sep">→</span>`
      : "";
    return `
      <div class="pose-card${isActive ? " active" : ""}">
        ${svg.replace("<svg ", `<svg class="${isLandscape ? "landscape" : ""}" `)}
        <span class="pose-label">${label}</span>
      </div>
      ${arrow}`;
  }).join("");
}

function renderPrescription(ex) {
  const p = ex.prescription;
  prescEl.textContent =
    `${p.sets} sets × ${p.reps} reps` +
    (p.holdSeconds ? ` · hold ${p.holdSeconds}s` : "") +
    ` · ${p.daysPerWeek} days/week`;
  if (repTargetEl) repTargetEl.textContent = p.reps;

  // Show inline hold timer only for stretch exercises
  if (ex.category === "stretch" && p.holdSeconds) {
    holdInlineEl.classList.remove("hidden");
    holdInlineEl.classList.remove("active");
    holdInlineCountEl.textContent = p.holdSeconds;
  } else {
    holdInlineEl.classList.add("hidden");
  }
}

function renderTrackingWarning(ex) {
  if (ex.trackingWarning) {
    trackWarnEl.textContent = ex.trackingWarning;
    trackWarnEl.classList.remove("hidden");
  } else {
    trackWarnEl.classList.add("hidden");
  }
}

function renderStaticPhaseFlow(activeEngine) {
  phaseFlowEl.innerHTML = activeEngine.stages
    .map((stage, index) => {
      const active = index === 0 ? " active" : "";
      const arrow =
        index < activeEngine.stages.length - 1
          ? '<span class="phase-arrow">→</span>'
          : "";
      return `<span class="phase-chip${active}">${stage}</span>${arrow}`;
    })
    .join("");
}

function setFeedbackBanner(state, cue = "") {
  if (!feedbackEl) return;
  const symbol = feedbackEl.querySelector(".feedback-symbol");
  const title = feedbackEl.querySelector("strong");
  const detail = feedbackEl.querySelector("div > span");
  feedbackEl.classList.toggle("needs-adjustment", state === "adjust");
  feedbackEl.classList.toggle("tracking-uncertain", state === "tracking");

  if (state === "adjust") {
    symbol.textContent = "!";
    title.textContent = "Small adjustment";
    detail.textContent = cue || "Follow the coaching cue below";
  } else if (state === "good") {
    symbol.textContent = "✓";
    title.textContent = "Movement looks good";
    detail.textContent = "Keep this pace and breathe naturally";
  } else if (state === "tracking") {
    symbol.textContent = "?";
    title.textContent = "Tracking uncertain";
    detail.textContent =
      cue || "Make sure your required joints are clearly visible";
  } else if (state === "position") {
    symbol.textContent = "↔";
    title.textContent = "Let’s get you in frame";
    detail.textContent = cue || "Make sure your full body is visible";
  } else {
    symbol.textContent = "●";
    title.textContent = "Get into position";
    detail.textContent = "Your guidance will appear here";
  }
}

// ── Controls ──────────────────────────────────────────────────────────────────

async function activateCameraGuide() {
  if (running) return true;
  try {
    toggleBtn.disabled = true;
    statusEl.textContent = "Starting camera…";
    await startCamera();
    running = true;
    cameraStage?.classList.add("camera-active");
    toggleBtn.innerHTML = 'Stop camera guide <span aria-hidden="true">■</span>';
    toggleBtn.disabled = false;
    renderFrame();
    return true;
  } catch (err) {
    statusEl.textContent = `Camera error: ${err.message}`;
    toggleBtn.disabled = false;
    return false;
  }
}

function deactivateCameraGuide() {
  running = false;
  cancelAnimationFrame(rafId);
  cancelCalibration();
  if (holdInterval) {
    clearHoldTimer(engine.exercise.prescription.holdSeconds);
  }
  stopCamera();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  cameraStage?.classList.remove("camera-active");
  toggleBtn.innerHTML = 'Start camera guide <span aria-hidden="true">→</span>';
  statusEl.textContent = "Stopped";
  setFeedbackBanner("ready");
}

toggleBtn.addEventListener("click", async () => {
  if (running) deactivateCameraGuide();
  else await activateCameraGuide();
});

createLandmarker().catch((err) => {
  statusEl.textContent = "Movement model unavailable — check your connection";
});
