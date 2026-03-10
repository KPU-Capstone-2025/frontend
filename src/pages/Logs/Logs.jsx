import { useState, useEffect } from "react";
import "./logs.css";
import { getStoredSession, buildCompanyDisplayName } from "../../services/authStorage.js";
import { fetchLogs, getLogFilterOptions } from "../../services/logApi.js";

export default function Logs() {
  const session = getStoredSession();
  const companyId = session?.id || "";
  const companyName = buildCompanyDisplayName(session);

  const [logs, setLogs] = useState({ items: [], total: 0, counts: { total: 0, ERROR: 0, WARN: 0, INFO: 0 }, containers: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ container: "all", level: "all", q: "", page: 1, timeRange: "24h" });

  const filterOptions = getLogFilterOptions(logs.containers);

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    setError("");

    fetchLogs({
      companyId,
      container: filters.container,
      level: filters.level,
      q: filters.q,
      page: filters.page,
      timeRange: filters.timeRange,
    })
      .then((result) => setLogs(result))
      .catch((err) => setError(err?.message || "로그 조회 실패"))
      .finally(() => setLoading(false));
  }, [companyId, filters]);

  return (
    <div className="logsPage">
      <div className="logsWrap">
        <div className="logsTitle">로그 분석</div>
        <div className="logsDesc">시스템 로그를 실시간으로 모니터링합니다.</div>

        {error && (
          <div style={{ padding: "12px 16px", marginBottom: 12, background: "#fdf2f2", border: "1px solid #d92d20", borderRadius: 6, color: "#d92d20" }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto auto auto", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>시간 범위</label>
              <select value={filters.timeRange} onChange={(e) => setFilters({ ...filters, timeRange: e.target.value, page: 1 })} style={{ padding: 6, borderRadius: 4, border: "1px solid #d0d5dd" }}>
                {filterOptions.timeRanges.map((gr) => (
                  <option key={gr.key} value={gr.key}>
                    {gr.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>컨테이너</label>
              <select value={filters.container} onChange={(e) => setFilters({ ...filters, container: e.target.value, page: 1 })} style={{ padding: 6, borderRadius: 4, border: "1px solid #d0d5dd" }}>
                {filterOptions.containers.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "전체" : c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>레벨</label>
              <select value={filters.level} onChange={(e) => setFilters({ ...filters, level: e.target.value, page: 1 })} style={{ padding: 6, borderRadius: 4, border: "1px solid #d0d5dd" }}>
                {filterOptions.levels.map((l) => (
                  <option key={l} value={l}>
                    {l === "all" ? "전체" : l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>검색</label>
              <input type="text" placeholder="메시지 검색..." value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value, page: 1 })} style={{ padding: 6, borderRadius: 4, border: "1px solid #d0d5dd", width: "100%" }} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 12, fontSize: 12, color: "#475467" }}>
          총 {logs.total}개 (ERROR: {logs.counts.ERROR}, WARN: {logs.counts.WARN}, INFO: {logs.counts.INFO})
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#98a2b3" }}>로드 중...</div>
        ) : logs.items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#98a2b3" }}>로그가 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {logs.items.map((item) => (
              <div key={item.id} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 6, background: item.isDemo ? "#fffacd" : "#f9fafb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: item.level === "ERROR" ? "#fee2e2" : item.level === "WARN" ? "#fef3c7" : "#dbeafe", color: item.level === "ERROR" ? "#d92d20" : item.level === "WARN" ? "#b45309" : "#1e40af" }}>
                      {item.level}
                    </span>
                    {item.isDemo && <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#dcfce7", color: "#15803d" }}>DEMO</span>}
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{item.tag}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{item.tsText}</span>
                </div>
                <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>{item.message}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {item.container} | {item.service}
                </div>
              </div>
            ))}
          </div>
        )}

        {logs.totalPages > 1 && (
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 8 }}>
            {Array.from({ length: logs.totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setFilters({ ...filters, page: p })} style={{ padding: "6px 12px", borderRadius: 4, border: p === filters.page ? "2px solid #3b82f6" : "1px solid #d0d5dd", background: p === filters.page ? "#3b82f6" : "#fff", color: p === filters.page ? "#fff" : "#374151", cursor: "pointer" }}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}