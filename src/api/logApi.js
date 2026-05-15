import { getLogs } from "./monitoringApi.js";

export async function fetchLogs(companyId, options = {}) {
  return getLogs(companyId, options);
}