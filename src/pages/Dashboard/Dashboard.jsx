export default function Dashboard() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1600,   // ← 1200이 너무 작아서 오른쪽이 비어 보였음 (원하면 1800으로 더 키워도 됨)
        margin: "0 auto", // ← 가운데 정렬 (왼쪽 붙는 느낌 제거)
      }}
    >
      <h2 style={{ margin: "6px 0 14px", fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>
        실시간 모니터링 대시보드
      </h2>
      <p style={{ margin: "0 0 18px", color: "#64748b" }}>
        서버 상태를 실시간으로 확인하고 관리하세요
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <Card title="CPU 사용률" value="72%" sub="+1.5%" />
        <Card title="메모리" value="8.1 GB" sub="사용률 65%" />
        <Card title="서버 상태" value="정상 ✅" sub="All green" />
      </div>

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
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em" }}>{value}</div>
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
