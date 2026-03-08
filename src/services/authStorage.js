const SESSION_KEY = "monittoring_session";

export function setStoredSession(session) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getStoredSession() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStoredSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function buildCompanyDisplayName(session) {
  if (session?.companyName) return session.companyName;
  if (session?.companyId) return `기업 #${session.companyId}`;
  return "회사 정보 없음";
}