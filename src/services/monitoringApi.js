// src/services/monitoringApi.js
// 백엔드 수정 없이 프론트에서만 연동하기 위한 API 유틸
const DEFAULT_BASE_URL = "http://localhost:8080/api/monitoring";

/**
 * Vite 환경변수(VITE_API_BASE_URL)가 있으면 그 값을 우선 사용.
 * 예) VITE_API_BASE_URL=/api/monitoring  (vite proxy 사용 시)
 */
export const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || DEFAULT_BASE_URL;

async function fetchJson(url, { method = "GET", headers, body, signal } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body,
    signal,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      `요청 실패 (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export function getCompanies({ signal } = {}) {
  return fetchJson(`${API_BASE_URL}/companies`, { signal });
}

export function getDashboardSummary(companyId, { signal } = {}) {
  const qs = new URLSearchParams({ companyId: String(companyId) }).toString();
  return fetchJson(`${API_BASE_URL}/dashboard/summary?${qs}`, { signal });
}