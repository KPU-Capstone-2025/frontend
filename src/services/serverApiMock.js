
//(todo) 지금은 목원 데이터 나중에 백엔드 연동 
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function maybeFail(rate = 0.08) {
  if (Math.random() < rate) {
    const e = new Error("임시 오류 발생. (목업) 재시도.");
    e.code = "MOCK_FAIL";
    throw e;
  }
}

function pickServer(serverId) {
  const map = {
    a: {
      id: "a",
      name: "a 중소기업 서버",
      ip: "10.0.1.3",
      os: "Ubuntu 22.04",
      health: "ok",
    },
    b: {
      id: "b",
      name: "b 중소기업 서버",
      ip: "10.0.1.4",
      os: "Ubuntu 22.04",
      health: "warn",
    },
    c: {
      id: "c",
      name: "c 중소기업 서버",
      ip: "10.0.1.5",
      os: "Ubuntu 22.04",
      health: "down",
    },
  };

  return map[serverId] || {
    id: serverId,
    name: `${serverId} 서버`,
    ip: "10.0.1.??",
    os: "Ubuntu",
    health: "warn",
  };
}

function buildContainers(serverId) {
  const base = [
    {
      id: "api",
      name: "api",
      image: "monittoring/api:1.2.0",
      ports: [8080],
    },
    {
      id: "nginx",
      name: "nginx",
      image: "nginx:1.25",
      ports: [80, 443],
    },
    {
      id: "db",
      name: "db",
      image: "mysql:8.0",
      ports: [3306],
    },
    {
      id: "prom",
      name: "prometheus",
      image: "prom/prometheus:v2",
      ports: [9090],
    },
    {
      id: "loki",
      name: "loki",
      image: "grafana/loki:2.9",
      ports: [3100],
    },
    {
      id: "graf",
      name: "grafana",
      image: "grafana/grafana:10",
      ports: [3000],
    },
  ];

  const health = pickServer(serverId).health;

  return base.map((c, idx) => {
    let state = "running";
    if (health === "warn" && idx % 3 === 0) state = "degraded";
    if (health === "down") state = "stopped";

    const cpu = health === "down" ? 0 : Math.floor(10 + Math.random() * 70);
    const mem = health === "down" ? 0 : Math.floor(10 + Math.random() * 80);
    const restarts = health === "down" ? 0 : Math.floor(Math.random() * 4);

    const updatedAt = new Date(Date.now() - idx * 3600_000)
      .toISOString()
      .slice(0, 16)
      .replace("T", " ");

    return {
      ...c,
      state,
      cpu,
      mem,
      restarts,
      updatedAt,
      events: [
        { ts: "방금 전", msg: state === "running" ? "헬스체크 정상" : "헬스체크 경고" },
        { ts: "10분 전", msg: "메트릭 수집 완료" },
        { ts: "1시간 전", msg: "이미지 업데이트 확인" },
      ],
    };
  });
}

function makeSeries(points, base, jitter, clampMax = 100) {
  return Array.from({ length: points }).map((_, i) => {
    const v = base + (Math.random() * jitter * 2 - jitter);
    return { t: i, v: Math.max(0, Math.min(clampMax, v)) };
  });
}

function periodToPoints(period) {
  if (period === "1h") return 12;
  if (period === "6h") return 24;
  if (period === "24h") return 48;
  if (period === "7d") return 56;
  return 24;
}

export async function fetchServerDetailMock(serverId) {
  await sleep(350);
  maybeFail(0.06);

  const server = pickServer(serverId);
  const containers = buildContainers(serverId);

  if (server.health === "down") {
    // 다운인 경우에도 "데이터 없음"이 아니라 "상태가 다운"을 보여주는 게 더 현실적이라
    // 컨테이너는 stopped로 내려주되, 페이지는 정상 렌더링 되게 해둠.
  }

  return { server, containers };
}

export async function fetchServerMetricsMock(serverId, period) {
  await sleep(300);
  maybeFail(0.08);

  const points = periodToPoints(period);
  const health = pickServer(serverId).health;

  if (health === "down") {
    const zeros = Array.from({ length: points }).map((_, i) => ({ t: i, v: 0 }));
    return { cpu: zeros, mem: zeros, disk: zeros, net: zeros };
  }

  const cpuBase = health === "warn" ? 70 : 30;
  const memBase = health === "warn" ? 75 : 45;
  const diskBase = health === "warn" ? 68 : 52;

  return {
    cpu: makeSeries(points, cpuBase, 12, 100),
    mem: makeSeries(points, memBase, 10, 100),
    disk: makeSeries(points, diskBase, 6, 100),
    net: makeSeries(points, health === "warn" ? 12 : 6, 3, 30),
  };
}
