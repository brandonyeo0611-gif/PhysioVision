// Central API client — all backend calls go through here.
// Token is kept in localStorage so it survives page refreshes.

const BASE = "http://localhost:8000/api";
const TOKEN_KEY = "physiovision.token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return Boolean(getToken());
}

async function request(method, path, body) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Token ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.detail || "Request failed"), { status: res.status, data: err });
  }

  return res.status === 204 ? null : res.json();
}

// ── Auth ──────────────────────────────────────────────────────

export async function register({ email, password, firstName, lastName, role = "patient", ...profileFields }) {
  const data = await request("POST", "/auth/register/", {
    email, password,
    first_name: firstName,
    last_name: lastName,
    role,
    ...profileFields,
  });
  setToken(data.token);
  return data;
}

export async function login({ email, password }) {
  const data = await request("POST", "/auth/login/", { email, password });
  setToken(data.token);
  return data;
}

export async function logout() {
  await request("POST", "/auth/logout/").catch(() => {});
  clearToken();
}

// ── Profile ───────────────────────────────────────────────────

export async function getMe() {
  return request("GET", "/auth/me/");
}

export async function patchMe(fields) {
  return request("PATCH", "/auth/me/", fields);
}

// ── Sessions ──────────────────────────────────────────────────

export async function postSession(session) {
  return request("POST", "/sessions/", session);
}

export async function postPainCheckin(checkin) {
  return request("POST", "/pain-checkins/", checkin);
}

export async function getSessions() {
  return request("GET", "/sessions/");
}

// ── Calibrations ──────────────────────────────────────────────

export async function postCalibration(calibration) {
  return request("POST", "/calibrations/", calibration);
}

export async function getCalibrations() {
  return request("GET", "/calibrations/");
}

// ── Exercises ─────────────────────────────────────────────────

export async function getExercises() {
  return request("GET", "/exercises/");
}

// ── Role-specific AI assistant ───────────────────────────────

export async function sendAgentMessage(message) {
  return request("POST", "/auth/agent/chat/", { message });
}
