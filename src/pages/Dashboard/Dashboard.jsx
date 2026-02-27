import { useEffect, useMemo, useState } from "react";
import { getCompanies, getDashboardSummary } from "../../api/monitoringApi";

export default function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(""); // 문자열로 유지

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // 상태 뱃지 색/문구
  const statusMeta = useMemo(() => {
    const s = data?.systemStatus ?? "LOADING";
    if (s === "NORMAL") {
      return { label: "정상", emoji: "🟢", color: "#16a34a", bg: "#dcfce7" };
    }
    if (s === "DANGER") {
      return { label: "위험", emoji: "🔴", color: "#dc2626", bg: "#fee2e2" };
    }
    return { label: "준비중", emoji: "🟡", color: "#ca8a04", bg: "#fef9c3" };
  }, [data?.systemStatus]);

  const cpuUsage = data?.serverKpi?.cpuUsage ?? 0;
  const memoryUsage = data?.serverKpi?.memoryUsage ?? 0;

  // 1) 회사 목록 로드 + 첫 회사 자동 선택
  useEffect(() => {
    let alive = true;

    async function loadCompanies() {
      try {
        setLoadingCompanies(true);
        setError("");

        const list = await getCompanies();
        const normalized = Array.isArray(list) ? list : [];

        if (!alive) return;
        setCompanies(normalized);

        if (normalized.length > 0) {
          setCompanyId(String(normalized[0].companyId));
        }
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setError("회사 목록을 불러오지 못했습니다. (콘솔 확인)");
      } finally {
        if (alive) setLoadingCompanies(false);
      }
    }

    loadCompanies();
    return () => {
      alive = false;
    };
  }, []);

  // 2) 대시보드 호출 + 15초 폴링
  useEffect(() => {
    if (!companyId) return;

    let alive = true;

    async function fetchDashboard() {
      try {
        setLoadingDashboard(true);
        setError("");

        const res = await getDashboardSummary(companyId);

        if (!alive) return;
        setData(res);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setError("대시보드 데이터를 불러오지 못했습니다. (콘솔 확인)");
      } finally {
        if (alive) setLoadingDashboard(false);
      }
    }

    fetchDashboard();
    const timer = setInterval(fetchDashboard, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [companyId]);

  // 카드 표시값 구성
  const cpuValue = data?.systemStatus === "LOADING" ? "준비 중" : `${cpuUsage}%`;
  const memValue = data?.systemStatus === "LOADING" ? "준비 중" : `${memoryUsage}%`;

  // 기존 UI 그대로 + 상단 회사 선택만 추가
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1600,
        margin: "0 auto",
      }}
    >
      <h2
        style={{
          margin: "6px 0 14px",
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: "-0.02em",
        }}
      >
        실시간 모니터링 대시보드
      </h2>
      <p style={{ margin: "0 0 18px", color: "#64748b" }}>
        서버 상태를 실시간으로 확인하고 관리하세요
      </p>

      {/* ✅ 기업 선택 + 상태 뱃지 (기존 UI 상단에만 추가) */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 12,
          borderRadius: 16,
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
        }}
      >
        <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 13 }}>
          기업 선택
        </div>

        {loadingCompanies ? (
          <div style={{ fontSize: 13, color: "#64748b" }}>불러오는 중…</div>
        ) : (
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            style={{
              height: 34,
              padding: "0 10px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              fontWeight: 800,
              fontSize: 13,
              minWidth: 240,
            }}
          >
            {companies.map((c) => (
              <option key={c.companyId} value={String(c.companyId)}>
                {c.companyName} (ID: {c.companyId})
              </option>
            ))}
          </select>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 900,
              color: statusMeta.color,
              background: statusMeta.bg,
              border: "1px solid rgba(15,23,42,0.06)",
            }}
          >
            {statusMeta.emoji} {statusMeta.label}
          </span>

          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
            15초마다 자동 갱신
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ marginBottom: 12, color: "#dc2626", fontWeight: 900 }}>
          {error}
        </div>
      ) : null}

      {/* ✅ 기존 카드 3개: value/sub만 API로 교체 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <Card
          title="CPU 사용률"
          value={loadingDashboard && !data ? "불러오는 중…" : cpuValue}
          sub={data?.systemStatus === "LOADING" ? "서버 준비 중" : "단위: %"}
        />
        <Card
          title="메모리"
          value={loadingDashboard && !data ? "불러오는 중…" : memValue}
          sub={data?.systemStatus === "LOADING" ? "서버 준비 중" : "단위: %"}
        />
        <Card
          title="서버 상태"
          value={loadingDashboard && !data ? "불러오는 중…" : `${statusMeta.label} ${statusMeta.emoji}`}
          sub={data?.lastUpdate ? `lastUpdate: ${data.lastUpdate}` : (data?.message ?? "")}
        />
      </div>

      {/* ✅ 하단 박스: LOADING이면 “준비 중 UI”, 아니면 기존 자리 유지 */}
      <div
        style={{
          marginTop: 18,
          borderRadius: 18,
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
          padding: 18,
          minHeight: 380,
        }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Tab active>서버 상태</Tab>
          <Tab>리소스 모니터링</Tab>
          <Tab>로그 분석</Tab>
        </div>

        {data?.systemStatus === "LOADING" ? (
          <div
            style={{
              height: 320,
              borderRadius: 14,
              border: "1px dashed rgba(15,23,42,0.15)",
              display: "grid",
              placeItems: "center",
              color: "#64748b",
              fontWeight: 900,
              textAlign: "center",
              padding: 16,
            }}
          >
            <div>
              🚀 서버 부팅 중 / 인프라 연결 중…
              <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800 }}>
                {data?.message ? `message: ${data.message}` : "잠시 후 자동으로 갱신됩니다."}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: 320,
              borderRadius: 14,
              border: "1px dashed rgba(15,23,42,0.15)",
              display: "grid",
              placeItems: "center",
              color: "#64748b",
              fontWeight: 800,
            }}
          >
            (여기에 메트릭 차트/테이블 들어갈 예정)
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, value, sub }) {
  return (
    <div
      style={{
        borderRadius: 16,
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
        padding: 16,
      }}
    >
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em" }}>
        {value}
      </div>
      <div style={{ marginTop: 6, color: "#0b2bff", fontSize: 12, fontWeight: 900 }}>{sub}</div>
    </div>
  );
}

function Tab({ active, children }) {
  return (
    <button
      style={{
        height: 34,
        padding: "0 12px",
        borderRadius: 10,
        border: `1px solid ${active ? "rgba(11,43,255,0.35)" : "rgba(15,23,42,0.10)"}`,
        background: active ? "rgba(11,43,255,0.10)" : "#fff",
        color: active ? "#0b2bff" : "#0f172a",
        fontWeight: 900,
        fontSize: 12,
      }}
    >
      {children}
    </button>
  );
}