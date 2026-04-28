import { useState, useEffect, useCallback } from "react";
import "./logs.css";
import { getStoredSession, buildCompanyDisplayName } from "../../services/authStorage.js";
import { getLogs, analyzeLog, getServers } from "../../services/monitoringApi.js";

/**
 * [수정사항]
 * 1. 백엔드 MonitoringModule의 getLogs 응답 구조(body, severity) 파싱 로직 정밀화
 * 2. timestamp를 백엔드 포맷(나노/밀리초)에 맞게 안전하게 변환
 */
function parseCleanText(rawBody) {
  try {
    const parsed = JSON.parse(rawBody);
    return parsed.body || rawBody;
  } catch (e) {
    return rawBody;
  }
}

export default function Logs() {
  const session = getStoredSession();
  const companyId = session?.id || "";
  const companyName = buildCompanyDisplayName(session);

  const [logs, setLogs] = useState({ items: [] });
  const [globalCounts, setGlobalCounts] = useState({ all: 0, ERROR: 0, WARN: 0, INFO: 0 });
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [filters, setFilters] = useState({ level: "all", q: "" });
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);

  const [aiAnalysis, setAiAnalysis] = useState({});
  const [analyzingId, setAnalyzingId] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    getServers(companyId).then(list => setServers(Array.isArray(list) ? list : [])).catch(() => {});
  }, [companyId]);

  const loadLogs = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      const data = await getLogs(companyId, {
        limit: 100,
        keyword: filters.q,
        severity: filters.level === "all" ? "" : filters.level
      }, selectedServer);

      const mapped = (data || []).map((item, idx) => {
        // 백엔드 timestamp 처리 (문자열인 경우 숫자로 변환)
        const tsString = String(item.timestamp);
        const ts = Number(tsString.length > 13 ? tsString.slice(0, 13) : tsString);
        const dateObj = new Date(ts);

        return {
          id: `log-${ts}-${idx}`,
          time: dateObj.toLocaleTimeString("ko-KR", { hour12: false }),
          date: dateObj.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", weekday: "short" }),
          level: item.severity || "INFO",
          text: parseCleanText(item.body || item.rawMessage),
          serverName: item.hostName || null
        };
      });

      setLogs({ items: mapped });

      if (filters.level === "all" && filters.q === "") {
        setGlobalCounts({
          all: mapped.length,
          ERROR: mapped.filter(l => l.level === "ERROR").length,
          WARN: mapped.filter(l => l.level === "WARN").length,
          INFO: mapped.filter(l => l.level === "INFO").length,
        });
      }
    } catch (err) {
      console.error("로그 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [companyId, filters, selectedServer]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function handleAiAnalysis(e, item) {
    e.stopPropagation(); 
    if (aiAnalysis[item.id]) { setExpandedLogId(prev => prev === item.id ? null : item.id); return; }
    setAnalyzingId(item.id);
    try {
      const result = await analyzeLog(item.text);
      setAiAnalysis(prev => ({ ...prev, [item.id]: result }));
      setExpandedLogId(item.id); 
    } catch (err) {
      alert("AI 분석 실패");
    } finally {
      setAnalyzingId(null);
    }
  }

  return (
    <div className="logsPage">
      <div className="logsWrap">
        <div className="logsTitle">로그 분석</div>
        <div className="logsDesc">{companyName} 시스템 로그 실시간 모니터링</div>

        {servers.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>서버</span>
            <button onClick={() => setSelectedServer(null)}
              style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid", fontSize: 12, cursor: "pointer", background: !selectedServer ? "#146ef5" : "var(--surface2)", color: !selectedServer ? "#fff" : "var(--text)", borderColor: !selectedServer ? "#146ef5" : "var(--border)" }}>
              전체
            </button>
            {servers.map(s => (
              <button key={s.id} onClick={() => setSelectedServer(s.name)}
                style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid", fontSize: 12, cursor: "pointer", background: selectedServer === s.name ? "#146ef5" : "var(--surface2)", color: selectedServer === s.name ? "#fff" : "var(--text)", borderColor: selectedServer === s.name ? "#146ef5" : "var(--border)" }}>
                🖥️ {s.name}
              </button>
            ))}
          </div>
        )}

        <div className="logPanel">
          <div className="filterRow">
            <div className="sourceTabs" role="tablist">
              {["all", "ERROR", "WARN", "INFO"].map((lv) => (
                <button 
                  key={lv} 
                  type="button" 
                  className={`sourceTab ${filters.level === lv ? "on" : ""}`} 
                  onClick={() => setFilters({ ...filters, level: lv })}
                  style={{ color: lv === "ERROR" && filters.level === "ERROR" ? '#dc2626' : (lv === "WARN" && filters.level === "WARN" ? '#ea580c' : '') }}
                >
                  {lv === "all" ? "전체" : lv} <span>({globalCounts[lv]})</span>
                </button>
              ))}
            </div>
            <div className="searchBox">
              <input className="searchInput" type="text" placeholder="로그 키워드 검색..." value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="logTableCard">
          <div className="logTableHead" style={{ display: 'grid', gridTemplateColumns: '170px 100px minmax(0, 1fr)', padding: '12px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            <div className="th">시간</div>
            <div className="th">레벨</div>
            <div className="th">로그 메시지</div>
          </div>

          <div className="logTableBody" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {loading && logs.items.length === 0 ? <div className="emptyState">로딩 중...</div> : 
             logs.items.length === 0 ? <div className="emptyState">로그가 없습니다.</div> : (
              logs.items.map((item) => {
                const isErrorOrWarn = item.level === "ERROR" || item.level === "WARN";
                const hasAnalysis = !!aiAnalysis[item.id];
                
                return (
                  <div key={item.id} className={`logRow ${hasAnalysis ? "expandable" : ""} ${expandedLogId === item.id ? "active" : ""}`}
                       onClick={() => hasAnalysis && setExpandedLogId(prev => prev === item.id ? null : item.id)}
                       style={{ display: 'grid', gridTemplateColumns: '170px 100px minmax(0, 1fr)', padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>

                    <div className="td timeCell">
                      <div className="timeMain mono">{item.time}</div>
                      <div className="timeSub">{item.date}</div>
                      {item.serverName && <div style={{ fontSize: 10, color: '#146ef5', marginTop: 2, fontWeight: 600 }}>🖥️ {item.serverName}</div>}
                    </div>

                    <div className="td"><span className={`lv ${item.level.toLowerCase()}`}>{item.level}</span></div>

                    <div className="td msgCol" style={{ display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div className="msgText" style={{ wordBreak: 'break-all', whiteSpace: 'normal', flex: 1, paddingRight: '15px' }}>{item.text}</div>
                        
                        {isErrorOrWarn && !hasAnalysis && (
                          <button onClick={(e) => handleAiAnalysis(e, item)} disabled={analyzingId === item.id} style={{ 
                            padding: '6px 12px', background: '#eef2ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' 
                          }}>
                            {analyzingId === item.id ? "🤖 분석 중..." : "🔎 AI 분석"}
                          </button>
                        )}
                        {hasAnalysis && <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold', whiteSpace: 'nowrap' }}>✓ 분석완료 ▾</div>}
                      </div>

                      {hasAnalysis && expandedLogId === item.id && (
                        <div className="interpretPanel" style={{ marginTop: '10px', padding: '15px', background: '#f8fafc', borderLeft: '4px solid #3b82f6', borderRadius: '4px' }}>
                          <div className="interpretRow">
                            <span className="interpretKey" style={{ color: '#2563eb', fontWeight: 'bold', marginRight: '10px' }}>🤖 AI 가이드:</span>
                            <span className="interpretVal" style={{ lineHeight: '1.6' }}>{aiAnalysis[item.id]}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}