import { useState, useEffect, useCallback } from "react";
import "./logs.css";
import { getStoredSession, buildCompanyDisplayName } from "../../services/authStorage.js";
import { fetchLogs, getLogFilterOptions } from "../../services/logApi.js";

export default function Logs() {
  const session = getStoredSession();
  const companyId = session?.id || "";
  const companyName = buildCompanyDisplayName(session);

  const [logs, setLogs] = useState({ items: [], total: 0, counts: { total: 0, ERROR: 0, WARN: 0, INFO: 0 }, containers: [] });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ sourceType: "all", level: "all", q: "", page: 1, timeRange: "24h" });

  const filterOptions = getLogFilterOptions(logs.containers);

  const loadLogs = useCallback(async (silent = false) => {
    if (!companyId) return;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    if (!silent) setError("");

    try {
      const result = await fetchLogs({
        companyId,
        sourceType: filters.sourceType,
        level: filters.level,
        q: filters.q,
        page: filters.page,
        timeRange: filters.timeRange,
      });
      setLogs(result);
    } catch (err) {
      setError(err?.message || "로그 조회 실패");
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [companyId, filters]);

  useEffect(() => {
    loadLogs(false);
  }, [loadLogs]);

  useEffect(() => {
    if (!companyId) return;

    const timerId = window.setInterval(() => {
      loadLogs(true);
    }, 5000);

    return () => window.clearInterval(timerId);
  }, [companyId, loadLogs]);

  const pageNumbers = Array.from({ length: logs.totalPages || 1 }, (_, i) => i + 1);
  const levelLabelMap = { all: "전체", ERROR: "오류", WARN: "경고", INFO: "일반" };

  function levelClass(level) {
    const lower = (level || "INFO").toLowerCase();
    if (lower.includes("error")) return "error";
    if (lower.includes("warn")) return "warn";
    return "info";
  }

  function riskLabel(risk) {
    if (risk === "danger") return "위험";
    if (risk === "warn") return "주의";
    return "정상";
  }

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

        <div className="logPanel">
          <div className="filterRow">
            <div className="sourceTabs" role="tablist" aria-label="로그 구분">
              <button
                type="button"
                className={`sourceTab ${filters.sourceType === "all" ? "on" : ""}`}
                onClick={() => setFilters({ ...filters, sourceType: "all", page: 1 })}
              >
                전체
              </button>
              <button
                type="button"
                className={`sourceTab ${filters.sourceType === "host" ? "on" : ""}`}
                onClick={() => setFilters({ ...filters, sourceType: "host", page: 1 })}
              >
                호스트
              </button>
              <button
                type="button"
                className={`sourceTab ${filters.sourceType === "container" ? "on" : ""}`}
                onClick={() => setFilters({ ...filters, sourceType: "container", page: 1 })}
              >
                컨테이너
              </button>
            </div>

            <div className="sourceTabs" role="tablist" aria-label="시간 범위">
              {filterOptions.timeRanges.map((gr) => (
                <button
                  key={gr.key}
                  type="button"
                  className={`sourceTab ${filters.timeRange === gr.key ? "on" : ""}`}
                  onClick={() => setFilters({ ...filters, timeRange: gr.key, page: 1 })}
                >
                  {gr.label}
                </button>
              ))}
            </div>

            <div className="sourceTabs" role="tablist" aria-label="로그 유형">
              {filterOptions.levels.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`sourceTab ${filters.level === l ? "on" : ""}`}
                  onClick={() => setFilters({ ...filters, level: l, page: 1 })}
                >
                  {levelLabelMap[l] || l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="summaryRow">
          <div>
            <div className="summaryTitle">총 {logs.total}개 로그</div>
            <div className="summaryBadges">
              <span className="sumChip error">ERROR {logs.counts.ERROR}</span>
              <span className="sumChip warn">WARN {logs.counts.WARN}</span>
              <span className="sumChip info">INFO {logs.counts.INFO}</span>
            </div>
          </div>
          {(loading || refreshing) && <div className="loadingTxt">{loading ? "로드 중..." : "실시간 갱신 중..."}</div>}
        </div>

        <div className="logTableCard">
          <div className="logsSearchRow">
            <input
              className="searchInput logsSearchInput"
              type="text"
              placeholder="로그 본문 검색"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value, page: 1 })}
            />
          </div>
          <div className="logTableHead">
            <div className="th">시간</div>
            <div className="th">유형</div>
            <div className="th">구분</div>
            <div className="th">로그 메시지</div>
          </div>

          <div className="logTableBody">
            {loading ? (
              <div className="emptyState">로그를 불러오는 중입니다...</div>
            ) : logs.items.length === 0 ? (
              <div className="emptyState">조건에 맞는 로그가 없습니다.</div>
            ) : (
              logs.items.map((item) => (
                <div key={item.id} className="logRow">
                  <div className="td timeCell">
                    <div className="timeMain mono">{item.time}</div>
                    <div className="timeSub">{item.date}</div>
                  </div>
                  <div className="td">
                    <span className={`lv ${levelClass(item.level)}`}>{item.level}</span>
                  </div>
                  <div className="td">
                    <span className={`sourceBadge ${item.sourceType}`}>
                      {item.sourceType === "container" ? item.source : item.sourceLabel}
                    </span>
                  </div>
                  <div className="td msgCol">
                    <div className="msgText">{item.text}</div>
                    <div className="msgHint">
                      <span className={`riskBadge ${item.interpretation?.risk || "normal"}`}>{riskLabel(item.interpretation?.risk)}</span>
                      <span>해석: {item.interpretation?.title || "-"}</span>
                      <button
                        type="button"
                        className={`expandBtn ${expandedLogId === item.id ? "open" : ""}`}
                        onClick={() => setExpandedLogId((prev) => (prev === item.id ? null : item.id))}
                        aria-label="로그 해석 상세 보기"
                      >
                        ▾
                      </button>
                    </div>
                    {expandedLogId === item.id && (
                      <div className="interpretPanel">
                        <div className="interpretRow">
                          <span className="interpretKey">설명</span>
                          <span className="interpretVal">{item.interpretation?.detail || "-"}</span>
                        </div>
                        {item.interpretation?.needsAction ? (
                          <div className="interpretRow">
                            <span className="interpretKey">해결 방안</span>
                            <span className="interpretVal">{item.interpretation?.remedy || "-"}</span>
                          </div>
                        ) : (
                          <div className="interpretRow">
                            <span className="interpretKey">상태</span>
                            <span className="interpretVal">문제가 없는 로그입니다.</span>
                          </div>
                        )}
                        <div className="interpretRow">
                          <span className="interpretKey">근거</span>
                          <span className="interpretVal mono">{item.interpretation?.evidence || "-"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {logs.totalPages > 1 && (
            <div className="logTableFoot">
              <div className="rangeTxt">페이지 {logs.page} / {logs.totalPages}</div>
              <div className="pager">
                <button
                  type="button"
                  className="pagerBtn"
                  onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                  disabled={filters.page <= 1}
                >
                  이전
                </button>
                <div className="pagerNums">
                  {pageNumbers.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`pagerNum ${p === filters.page ? "on" : ""}`}
                      onClick={() => setFilters({ ...filters, page: p })}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="pagerBtn"
                  onClick={() => setFilters({ ...filters, page: Math.min(logs.totalPages, filters.page + 1) })}
                  disabled={filters.page >= logs.totalPages}
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}