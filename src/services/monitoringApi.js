/**
 * [수정사항]
 * 1. CompanyController 응답 구조에 맞게 getAgentDestination에서 .result 제거
 * 2. 다른 함수들도 응답 구조(래퍼 유무)에 따라 정밀하게 조정
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://data.monittoring.co.kr/api";

async function request(path, { method = "GET", query, body } = {}) {
  const url = new URL(BASE_URL + path);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const session = JSON.parse(window.sessionStorage.getItem("monittoring_session") || "null");
  const headers = { "Content-Type": "application/json" };
  if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`API Error ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// 1. 기업 관리 (CompanyController는 ApiResponse 래퍼를 쓰지 않음)
export const registerCompany = (data) => request("/company/register", { method: "POST", body: data });
export const loginCompany = (creds) => request("/company/login", { method: "POST", body: creds });
export const getAgentDestination = (id) => request(`/company/agent/${id}`); // 🌟 .result 제거함

// 2. 리소스 대시보드 (DashboardController는 ApiResponse 래퍼를 사용함)
export const getHostOverview = (id, hostName) => request(`/dashboard/${id}/host`, { query: hostName ? { hostName } : {} }).then(r => r.result);
export const getContainers = (id, hostName) => request(`/dashboard/container/${id}`, { query: hostName ? { hostName } : {} }).then(r => r.containers || []);
export const getContainerMetrics = (id, name) => request(`/dashboard/${id}/container/${name}/metrics`).then(r => r.result);
export const getMonthlyMetrics = (id, params, hostName) => request(`/dashboard/${id}/metrics/monthly`, { query: hostName ? { ...params, hostName } : params }).then(r => r.result);

// 3. 로그 및 AI 분석 (Loki 관련)
export const getLogs = (id, params) => request(`/dashboard/${id}/logs`, { query: params }).then(r => r.result || []);
export const analyzeLog = (logContent) => request(`/dashboard/logs/analyze`, { method: "POST", body: { logContent } }).then(r => r.analysis);

// 3-1. 날짜별 위험 알림 요약
export const getDailyAlertSummary = (id, date) => request(`/dashboard/${id}/alerts/daily`, { query: { date } });

// 3-2. 멀티서버 / 이상감지 / 예측
export const getDiscoveredHosts = (id) => request(`/dashboard/${id}/hosts`);
export const getAnomaly = (id, hostName) => request(`/dashboard/${id}/anomaly`, { query: hostName ? { hostName } : {} });
export const getPrediction = (id, hostName) => request(`/dashboard/${id}/prediction`, { query: hostName ? { hostName } : {} });

// 5. 서버 관리
export const getServers = (companyId) => request(`/servers/${companyId}`);
export const registerServer = (companyId, data) => request(`/servers/${companyId}`, { method: "POST", body: data });
export const deleteServer = (companyId, serverId) => request(`/servers/${companyId}/${serverId}`, { method: "DELETE" });

// 4. 알람 설정 및 챗봇
export const updateAlertRules = (data) => request("/rules/update", { method: "POST", body: data });
export const askChatbot = (monitoringId, question) => request(`/chat/ask`, { method: "POST", body: { monitoringId, question } });
export const getChatHistory = (monitoringId) => request(`/chat/history/${monitoringId}`);
