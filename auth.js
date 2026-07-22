import { isLoggedIn, login, logout, register, getMe, getCalibrations } from "./api.js";

const shell        = document.getElementById("auth-modal");
const loginForm    = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const tabLogin     = document.getElementById("authTabLogin");
const tabRegister  = document.getElementById("authTabRegister");
const loginError   = document.getElementById("loginError");
const registerError = document.getElementById("registerError");

const headerSignIn  = document.getElementById("headerSignIn");
const headerSignOut = document.getElementById("headerSignOut");
const mobileSignIn  = document.getElementById("mobileSignIn");
const mobileSignOut = document.getElementById("mobileSignOut");

function updateAuthButtons(loggedIn) {
  headerSignIn.style.display  = loggedIn ? "none" : "";
  headerSignOut.style.display = loggedIn ? "" : "none";
  mobileSignIn.style.display  = loggedIn ? "none" : "";
  mobileSignOut.style.display = loggedIn ? "" : "none";
}

function showModal() {
  shell.classList.add("is-open");
  shell.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function hideModal() {
  shell.classList.remove("is-open");
  shell.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = "block";
}

function clearError(el) {
  el.textContent = "";
  el.style.display = "none";
}

// Open modal when Sign in button is clicked
document.querySelectorAll("[data-open='auth-modal']").forEach(btn => {
  btn.addEventListener("click", showModal);
});

// Tab switching
tabLogin.addEventListener("click", () => {
  loginForm.style.display = "";
  registerForm.style.display = "none";
  tabLogin.className = "button button-coral";
  tabRegister.className = "button button-light";
  clearError(loginError);
});

tabRegister.addEventListener("click", () => {
  loginForm.style.display = "none";
  registerForm.style.display = "";
  tabLogin.className = "button button-light";
  tabRegister.className = "button button-coral";
  clearError(registerError);
});

// Login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError(loginError);
  const data = new FormData(loginForm);
  try {
    await login({ email: data.get("email"), password: data.get("password") });
    await Promise.all([seedProfileFromApi(), seedCalibrationsFromApi()]);
    hideModal();
    updateAuthButtons(true);
    alert("Signed in successfully!");
  } catch (err) {
    showError(loginError, err.data?.non_field_errors?.[0] ?? err.message ?? "Login failed.");
  }
});

// Register
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError(registerError);
  const data = new FormData(registerForm);
  try {
    await register({
      email:     data.get("email"),
      password:  data.get("password"),
      firstName: data.get("firstName"),
      lastName:  data.get("lastName"),
      role:      data.get("role"),
    });
    await seedProfileFromApi();
    hideModal();
    updateAuthButtons(true);
    alert("Account created successfully!");
  } catch (err) {
    const detail = err.data?.email?.[0] ?? err.data?.non_field_errors?.[0] ?? err.message ?? "Registration failed.";
    showError(registerError, detail);
  }
});

// Pull calibrations from API and cache in localStorage
async function seedCalibrationsFromApi() {
  try {
    const data = await getCalibrations();
    const results = data.results ?? data;
    const calibrations = {};
    results.forEach(cal => {
      if (cal.is_active) {
        calibrations[cal.exercise] = {
          version:              cal.version,
          exerciseId:           cal.exercise,
          affectedSide:         cal.affected_side,
          capturedAt:           cal.captured_at,
          start:                cal.start_measurements,
          target:               cal.target_measurements,
          phaseRanges:          cal.phase_ranges,
          naturalKneeDifference: cal.natural_knee_difference,
        };
      }
    });
    localStorage.setItem("physiovision.calibrations.v1", JSON.stringify(calibrations));
  } catch (_) {
    // Non-fatal
  }
}

// Pull profile from API and cache in localStorage
async function seedProfileFromApi() {
  try {
    const me = await getMe();
    if (me.profile) {
      const p = me.profile;
      const mapped = {
        name:      `${me.first_name} ${me.last_name}`.trim(),
        goal:      p.goal             ?? "",
        activity:  p.activity_level   ?? "",
        mobility:  p.mobility_status  ?? "",
        focusSide: p.focus_side       ?? "right",
        cueStyle:  p.cue_style        ?? "gentle",
        carePath:  p.care_path        ?? "wellness",
      };
      localStorage.setItem("physiovision.profile.v1", JSON.stringify(mapped));
      window.dispatchEvent(new CustomEvent("physiovision:profile-updated", { detail: mapped }));
    }
  } catch (_) {
    // Non-fatal — app still works with localStorage
  }
}

// On load: show modal if not logged in, otherwise sync profile + calibrations
if (!isLoggedIn()) {
  showModal();
  updateAuthButtons(false);
} else {
  updateAuthButtons(true);
  seedProfileFromApi();
  seedCalibrationsFromApi();
}

// Expose logout globally
window.pvLogout = async () => {
  await logout();
  updateAuthButtons(false);
  location.reload();
};
