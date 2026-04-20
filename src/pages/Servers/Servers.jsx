import { useState, useEffect } from "react";
import { getStoredSession } from "../../services/authStorage.js";
import { getServers, registerServer, deleteServer } from "../../services/monitoringApi.js";

export default function Servers() {
  const session = getStoredSession();
  const companyId = session?.id;
  const [servers, setServers] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    getServers(companyId).then(setServers).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      const srv = await registerServer(companyId, { name: name.trim(), description: description.trim() || null });
      setServers(prev => [...prev, srv]);
      setName(""); setDescription(""); setShowForm(false);
    } catch { alert("서버 등록 실패"); } finally { setAdding(false); }
  };

  const handleDelete = async (serverId) => {
    if (!confirm("서버를 삭제하시겠습니까?")) return;
    await deleteServer(companyId, serverId);
    setServers(prev => prev.filter(s => s.id !== serverId));
  };

  const installCmd = (srv) =>
    `curl -fLO http://agent.monittoring.co.kr/metric-agent\nchmod +x metric-agent\nexport MONITORING_ID="${srv.monitoringId}"\nexport COLLECTOR_URL="${srv.collectorUrl}:80"\nexport SERVER_NAME="${srv.name}"\nsudo -E nohup ./metric-agent > metric.log 2>&1 &`;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: "#080808" }}>서버 관리</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>모니터링할 서버를 등록하고 에이전트를 설치하세요.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ padding: "10px 20px", background: "#146ef5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
          + 서버 추가
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} style={{ background: "#f8fbff", border: "1px solid rgba(20,110,245,0.2)", borderRadius: 10, padding: 24, marginBottom: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>서버 이름 *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="예: production-web-01" required
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #d8d8d8", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>설명 (선택)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="예: 메인 웹 서버"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #d8d8d8", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={adding} style={{ padding: "10px 24px", background: "#146ef5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
              {adding ? "등록 중..." : "등록"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "10px 20px", background: "#fff", color: "#555", border: "1px solid #d8d8d8", borderRadius: 8, cursor: "pointer" }}>
              취소
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>불러오는 중...</div>
      ) : servers.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#aaa", background: "#f9f9f9", borderRadius: 10, border: "1px dashed #ddd" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🖥️</div>
          <div style={{ fontSize: 15 }}>등록된 서버가 없습니다.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>위 버튼으로 서버를 추가하세요.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {servers.map(srv => (
            <div key={srv.id} style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", cursor: "pointer" }} onClick={() => setExpandedId(expandedId === srv.id ? null : srv.id)}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#52c41a", marginRight: 12 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{srv.name}</div>
                  {srv.description && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{srv.description}</div>}
                </div>
                <div style={{ fontSize: 12, color: "#888", marginRight: 16 }}>등록일 {new Date(srv.createdAt).toLocaleDateString("ko-KR")}</div>
                <button onClick={e => { e.stopPropagation(); handleDelete(srv.id); }}
                  style={{ padding: "4px 12px", background: "#fff1f0", color: "#ff4d4f", border: "1px solid #ffccc7", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>삭제</button>
              </div>
              {expandedId === srv.id && (
                <div style={{ borderTop: "1px solid #f0f0f0", padding: "16px 20px", background: "#f8fbff" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#146ef5", marginBottom: 10 }}>에이전트 설치 명령어</div>
                  <pre style={{ background: "#1a1a2e", color: "#a8ff78", padding: 16, borderRadius: 8, fontSize: 12, overflowX: "auto", margin: 0, lineHeight: 1.8 }}>
                    {installCmd(srv)}
                  </pre>
                  <button onClick={() => navigator.clipboard.writeText(installCmd(srv))}
                    style={{ marginTop: 10, padding: "6px 16px", background: "#fff", border: "1px solid #d8d8d8", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                    📋 복사
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
