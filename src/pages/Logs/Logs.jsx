import { useState, useEffect, useCallback, Fragment } from "react";
import "./logs.css";
import { getStoredSession, buildCompanyDisplayName } from "../../services/authStorage.js";
import { getLogs, analyzeLog } from "../../services/monitoringApi.js"; // 🌟 logApi 안 쓰고 직결

function parseCleanText(rawBody) {
  try { const parsed = JSON.parse(rawBody); return parsed.body || rawBody; } 
  catch (e) { return rawBody; }
}

export default function Logs() {
  const session = getStoredSession();
  const companyId = session?.id || "";
  const companyName = buildCompanyDisplayName(session);

  const [logs, setLogs] = useState({ items: [] });
  // 🌟 전체 개수 캐싱용 (검색 안 했을 때 기준)
  const [globalCounts, setGlobalCounts] = useState({ all: 0, ERROR: 0, WARN: 0, INFO: 0 });
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [filters, setFilters] = useState({ level: "all", q: "" });
  
  const [aiAnalysis, setAiAnalysis] = useState({});
  const [analyzingId, setAnalyzingId] = useState(null);

  const loadLogs = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      const data = await getLogs(companyId, {
        limit: 100,
        keyword: filters.q,
        severity: filters.level === "all" ? "" : filters.level
      });

      const mapped = (data || []).map((item, idx) => {
        const ts = Number(item.timestamp.slice(0, 13)); 
        const dateObj = new Date(ts);
        return {
          id: `log-${ts}-${idx}`,
          time: dateObj.toLocaleTimeString("ko-KR", { hour12: false }),
          date: dateObj.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", weekday: "short" }),
          level: item.severity || "INFO",
          text: parseCleanText(item.body)
        };
      });

      setLogs({ items: mapped });

      // 필터가 없을 때만 전체 카운트를 갱신 (탭의 숫자가 변하지 않도록)
      if (filters.level === "all" && filters.q === "") {
        setGlobalCounts({
          all: mapped.length,
          ERROR: mapped.filter(l => l.level === "ERROR").length,
          WARN: mapped.filter(l => l.level === "WARN").length,
          INFO: mapped.filter(l => l.level === "INFO").length,
        });
      }
    } catch (err) { console.error("로그 조회 실패"); } 
    finally { setLoading(false); }
  }, [companyId, filters]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // AI 분석
  async function handleAiAnalysis(e, item) {
    e.stopPropagation(); 
    if (aiAnalysis[item.id]) { setExpandedLogId(prev => prev === item.id ? null : item.id); return; }
    setAnalyzingId(item.id);
    try {
      const result = await analyzeLog(item.text);
      setAiAnalysis(prev => ({ ...prev, [item.id]: result }));
      setExpandedLogId(item.id); 
    } catch (err) { alert("AI 분석 실패"); } 
    finally { setAnalyzingId(null); }
  }

  return (
    <div className="logsPage">
      <div className="logsWrap">
        <div className="logsTitle">로그 분석</div>
        <div className="logsDesc">{companyName} 시스템 로그 실시간 모니터링</div>

        <div className="logPanel">
          <div className="filterRow">
            {/* 🌟 탭 버튼 안에 개수 포함 */}
            <div className="sourceTabs" role="tablist">
              <button type="button" className={`sourceTab ${filters.level === "all" ? "on" : ""}`} onClick={() => setFilters({ ...filters, level: "all" })}>
                전체 <span style={{opacity:0.6}}>({globalCounts.all})</span>
              </button>
              <button type="button" className={`sourceTab ${filters.level === "ERROR" ? "on" : ""}`} onClick={() => setFilters({ ...filters, level: "ERROR" })} style={{color: filters.level === "ERROR" ? '#dc2626' : ''}}>
                ERROR <span style={{opacity:0.6}}>({globalCounts.ERROR})</span>
              </button>
              <button type="button" className={`sourceTab ${filters.level === "WARN" ? "on" : ""}`} onClick={() => setFilters({ ...filters, level: "WARN" })} style={{color: filters.level === "WARN" ? '#ea580c' : ''}}>
                WARN <span style={{opacity:0.6}}>({globalCounts.WARN})</span>
              </button>
              <button type="button" className={`sourceTab ${filters.level === "INFO" ? "on" : ""}`} onClick={() => setFilters({ ...filters, level: "INFO" })}>
                INFO <span style={{opacity:0.6}}>({globalCounts.INFO})</span>
              </button>
            </div>

            {/* 🌟 검색창 정상화 */}
            <div className="searchBox">
              <input className="searchInput" type="text" placeholder="로그 키워드 검색..." value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="logTableCard">
          <div className="logTableHead" style={{ display: 'grid', gridTemplateColumns: '170px 100px minmax(0, 1fr)', padding: '12px 14px', background: 'rgba(15,23,42,0.02)', borderBottom: '1px solid var(--line)' }}>
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
                  <div key={item.id} className={`logRow ${hasAnalysis ? "expandable" : ""} ${expandedLogId === item.id ? "active" : ""}`} onClick={() => hasAnalysis && setExpandedLogId(prev => prev === item.id ? null : item.id)}
                       style={{ display: 'grid', gridTemplateColumns: '170px 100px minmax(0, 1fr)', padding: '12px 14px', borderBottom: '1px solid rgba(15,23,42,0.06)', background: '#fff' }}>
                    
                    <div className="td timeCell">
                      <div className="timeMain mono">{item.time}</div>
                      <div className="timeSub">{item.date}</div>
                    </div>
                    
                    <div className="td"><span className={`lv ${item.level.toLowerCase()}`}>{item.level}</span></div>
                    
                    <div className="td msgCol" style={{ display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div className="msgText" style={{ wordBreak: 'break-all', whiteSpace: 'normal', flex: 1, paddingRight: '15px' }}>{item.text}</div>
                        
                        {/* 🌟 AI 분석을 '진짜 버튼 UI'로 수정 */}
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
                            <span className="interpretKey" style={{ color: '#2563eb' }}>🤖 AI 가이드</span>
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