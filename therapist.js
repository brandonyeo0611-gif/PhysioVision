import { getMe, getPatients, isLoggedIn } from "./api.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

function formatDate(d) {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function relativeTime(isoString) {
  if (!isoString) return "Never";
  const diff = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function initials(name) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function trendIcon(trend) {
  if (trend === "improving") return { icon: "↗", cls: "trend-rising" };
  if (trend === "declining") return { icon: "⌁", cls: "trend-falling" };
  return { icon: "—", cls: "trend-flat" };
}

function painBadge(level) {
  if (level === null || level === undefined) return `<span class="pain-badge pain-none">—</span>`;
  const cls = level >= 7 ? "pain-high" : level >= 4 ? "pain-mid" : "pain-low";
  return `<span class="pain-badge ${cls}">${level}/10</span>`;
}

function statusPill(patient) {
  if (patient.open_escalations_count > 0)
    return `<button class="status-pill status-pill-review" type="button">Review now</button>`;
  if (patient.trend === "declining")
    return `<button class="status-pill status-pill-watch" type="button">Monitor</button>`;
  return `<button class="status-pill status-pill-good" type="button">On track</button>`;
}

function goalLabel(goal) {
  const labels = {
    stronger_knees: "Knee strength",
    better_balance: "Balance",
    less_stiffness: "Stiffness",
    stay_active: "Stay active",
  };
  return labels[goal] || goal || "General";
}

function renderPatientRow(patient) {
  const name       = patient.full_name || "Unknown";
  const age        = patient.age ? `${patient.age} · ` : "";
  const goal       = goalLabel(patient.goal);
  const ini        = initials(name);
  const programme  = patient.active_prescription
    ? `${patient.active_prescription.exercise_name} · ${patient.active_prescription.days_per_week}×/wk`
    : "No programme";
  const lastSess   = relativeTime(patient.last_session_at);
  const { icon, cls } = trendIcon(patient.trend);

  return `
    <div class="patient-row">
      <span class="patient-name">
        <i class="avatar">${ini}</i>
        <span><strong>${name}</strong><small>${age}${goal}</small></span>
      </span>
      <span>${programme}</span>
      <span>${lastSess}</span>
      <span class="mini-trend ${cls}">${icon}</span>
      <span>${painBadge(patient.latest_pain_level)}</span>
      <span>${statusPill(patient)}</span>
    </div>`;
}

function renderStats(patients) {
  const total      = patients.length;
  const needReview = patients.filter(p => p.open_escalations_count > 0).length;
  const adherences = patients.map(p => p.adherence_pct).filter(v => v !== null);
  const avgAdh     = adherences.length
    ? Math.round(adherences.reduce((a, b) => a + b, 0) / adherences.length)
    : null;

  document.getElementById("stat-active-patients").textContent = total;
  document.getElementById("stat-active-sub").textContent      = `${total} under your care`;
  document.getElementById("stat-need-review").textContent     = needReview;
  document.getElementById("stat-review-sub").textContent      = needReview > 0
    ? `${needReview} open escalation${needReview > 1 ? "s" : ""}`
    : "All clear";
  document.getElementById("stat-adherence").textContent       = avgAdh !== null ? `${avgAdh}%` : "—";
  document.getElementById("stat-adherence-sub").textContent   = avgAdh !== null
    ? (avgAdh >= 80 ? "↑ On track" : "↓ Below target")
    : "No prescriptions yet";
}

function renderPatientTable(patients) {
  const sorted = [...patients].sort((a, b) => {
    const aScore = (a.open_escalations_count > 0 ? 2 : 0) + (a.trend === "declining" ? 1 : 0);
    const bScore = (b.open_escalations_count > 0 ? 2 : 0) + (b.trend === "declining" ? 1 : 0);
    return bScore - aScore;
  });

  const body = document.getElementById("patient-table-body");
  if (!body) return;

  if (sorted.length === 0) {
    body.innerHTML = `<p class="empty-state">No patients assigned to your account yet.</p>`;
    return;
  }

  body.innerHTML = sorted.map(renderPatientRow).join("");
}

function renderClinicianInfo(me) {
  const name = `${me.first_name} ${me.last_name}`.trim() || "Clinician";
  const nameEl   = document.getElementById("clinician-name");
  const avatarEl = document.getElementById("clinician-avatar");
  if (nameEl)   nameEl.textContent   = name;
  if (avatarEl) avatarEl.textContent = initials(name);
}

function setLoading(on) {
  document.querySelector(".therapist-content")?.classList.toggle("is-loading", on);
}

async function loadDashboard() {
  if (!isLoggedIn()) return;

  const dateEl = document.getElementById("dashboard-date");
  if (dateEl) dateEl.textContent = formatDate(new Date());

  setLoading(true);
  try {
    const [me, patientsData] = await Promise.all([getMe(), getPatients()]);

    if (me.role !== "clinician") {
      document.getElementById("patient-table-body").innerHTML =
        `<p class="empty-state">Clinician access only.</p>`;
      return;
    }

    renderClinicianInfo(me);

    const patients = Array.isArray(patientsData) ? patientsData : (patientsData.results ?? []);
    renderStats(patients);
    renderPatientTable(patients);
  } catch (err) {
    const body = document.getElementById("patient-table-body");
    if (body) body.innerHTML = `<p class="empty-state">Could not load patients. Please try again.</p>`;
    console.error("Dashboard load failed:", err);
  } finally {
    setLoading(false);
  }
}

window.pvLoadDashboard = loadDashboard;
