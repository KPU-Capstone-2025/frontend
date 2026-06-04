const SESSION_KEY = "monittoring_session";

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const json = decodeURIComponent(
      window
        .atob(padded)
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizeSession(rawSession) {
  if (!rawSession) return null;

  const token = rawSession.token || rawSession.accessToken || rawSession.jwt || "";
  const claims = decodeJwtPayload(token);
  const companyId = claims?.sub || rawSession.companyId || rawSession.id || "";
  const monitoringId = claims?.monitoringId || rawSession.monitoringId || "";

  return {
    ...rawSession,
    token,
    id: companyId,
    companyId,
    monitoringId,
  };
}

export function setStoredSession(session) {
  const token = session?.token || session?.accessToken || session?.jwt || "";

  window.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      token,
      companyName: session?.companyName || session?.name || "",
    })
  );
}

export function getStoredSession() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? normalizeSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearStoredSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function buildCompanyDisplayName(session) {
  if (session?.companyName) return session.companyName;
  if (session?.name) return session.name;
  if (session?.companyId) return `기업 #${session.companyId}`;
  if (session?.id) return `기업 #${session.id}`;
  return "회사 정보 없음";
}
