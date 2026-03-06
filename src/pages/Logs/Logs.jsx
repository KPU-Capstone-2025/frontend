import { useEffect, useMemo, useState } from "react";
import "./logs.css";
import { getCompanies } from "../../api/monitoringApi";
import { fetchLogs, getLogFilterOptions } from "../../services/logApi.js";

function Pill({ children }) {
  return <div className="logPill">{children}</div>;
}

function Select({ value, onChange, options }) {
  return (
    <select className="logSelect" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt) => (
        <option key={opt.value ?? opt.key ?? opt} value={opt.value ?? opt.key ?? opt}>
          {opt.label ?? opt}
        </option>
      ))}
    </select>
  );
}

function LevelBadge({ level }) {
  const cls = level === "ERROR" ? "lv error" : level === "WARN" ? "lv warn" : "lv info";
  return <span className={cls}>{level}</span>;
}

function TagBadge({ text }) {
  return <span className="tag">{text}</span>;
}

function IconBtn({ title, onClick, children }) {
  return (
    <button type="button" className="iconBtn2" title={title} onClick={onClick}>
      {children}
    </button>
  );
}

function Pagination({ page, totalPages, onPage }) {
  const nums = useMemo(() => {
    const arr = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, totalPages]);

  return (
    <div className="pager">
      <button
        type="button"
        className="pagerBtn"
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        이전
      </button>

      <div className="pagerNums">
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            className={`pagerNum ${n === page ? "on" : ""}`}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="pagerBtn"
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        다음
      </button>
    </div>
  );
}

export default function Logs() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // 서버에서 받은 컨테이너 목록으로 옵션 생성
  const [containerOptions, setContainerOptions] = useState([]);
  const opts = useMemo(() => getLogFilterOptions(containerOptions), [containerOptions]);

  const [timeRange, setTimeRange] = useState("24h");
  const [container, setContainer] = useState("all");
  const [level, setLevel] = useState("all");
  const [q, setQ] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    items: [],
    total: 0,
    totalPages: 1,
    page: 1,
    pageSize: 20,
    counts: { total: 0, ERROR: 0, WARN: 0, INFO: 0 },
  });

  const [selected, setSelected] = useState(null);

  // 1) 회사 목록 로드 + 첫 회사 자동 선택
  useEffect(() => {
    let alive = true;

    async function loadCompanies() {
      try {
        setLoadingCompanies(true);
        const list = await getCompanies();
        const normalized = Array.isArray(list) ? list : [];
        if (!alive) return;
        setCompanies(normalized);
        if (normalized.length > 0) setCompanyId(String(normalized[0].companyId));
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setCompanies([]);
      } finally {
        if (alive) setLoadingCompanies(false);
      }
    }

    loadCompanies();
    return () => {
      alive = false;
    };
  }, []);

  async function load(nextPage = page) {
    if (!companyId) return;

    setLoading(true);
    try {
      const res = await fetchLogs({
        companyId,
        timeRange,
        container,
        level,
        q,
        page: nextPage,
        pageSize,
        // 로그가 적게 내려오면 필터가 잘 안 먹는 느낌이 나서 넉넉히 가져오는 게 좋아
        limit: 500,
      });

      setData(res);

      // 서버에서 나온 컨테이너 옵션 갱신
      if (Array.isArray(res.containers)) setContainerOptions(res.containers);

      // 선택 유지(없어지면 첫 줄로)
      if (res.items.length) {
        const stillExists = selected && res.items.some((it) => it.id === selected.id);
        if (!stillExists) setSelected(res.items[0]);
      } else {
        setSelected(null);
      }
    } catch (e) {
      console.error(e);
      setData({
        items: [],
        total: 0,
        totalPages: 1,
        page: 1,
        pageSize,
        counts: { total: 0, ERROR: 0, WARN: 0, INFO: 0 },
      });
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 회사/필터 바뀌면 1페이지로 재조회
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, timeRange, container, level]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function onSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    load(1);
  }

  function onReset() {
    setTimeRange("24h");
    setContainer("all");
    setLevel("all");
    setQ("");
    setPage(1);
    load(1);
  }

  return (
    <div className="logsPage">
      <div className="logsWrap">
        <div className="logsTitle">로그 분석</div>
        <div className="logsDesc">
          특정 컨테이너 또는 서버에서 발생한 이벤트/에러 로그를 시간 기준으로 조회하고,
          문제 원인을 추적합니다
        </div>

        {/* 회사 선택 */}
        <section className="logPanel" style={{ marginTop: 12 }}>
          <div className="logPanelHead">
            <div className="logPanelLeft">
              <div className="panelIconMini">🏢</div>
              <div className="panelText">
                <div className="panelH">기업 선택</div>
                <div className="panelP">선택한 기업(companyId)의 로그를 조회합니다</div>
              </div>
            </div>

            <div className="logPanelRight" style={{ gap: 10 }}>
              {loadingCompanies ? (
                <span className="loadingTxt">불러오는 중...</span>
              ) : (
                <select
                  className="logSelect"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  style={{ minWidth: 260 }}
                >
                  {companies.map((c) => (
                    <option key={c.companyId} value={String(c.companyId)}>
                      {c.companyName} (ID: {c.companyId})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </section>

        {/* 필터 */}
        <section className="logPanel">
          <div className="logPanelHead">
            <div className="logPanelLeft">
              <div className="panelIconMini">≡</div>
              <div className="panelText">
                <div className="panelH">필터</div>
                <div className="panelP">시간/컨테이너/레벨 조건으로 재조회합니다</div>
              </div>
            </div>

            <div className="logPanelRight">
              <IconBtn title="새로고침" onClick={() => load(page)}>
                ↻
              </IconBtn>
              <IconBtn title="초기화" onClick={onReset}>
                ⟲
              </IconBtn>
            </div>
          </div>

          <div className="filterRow">
            <Pill>
              <Select
                value={timeRange}
                onChange={setTimeRange}
                options={opts.timeRanges.map((t) => ({ key: t.key, label: t.label }))}
              />
            </Pill>

            <Pill>
              <Select
                value={container}
                onChange={setContainer}
                options={opts.containers.map((c) => ({
                  value: c,
                  label: c === "all" ? "전체 컨테이너" : c,
                }))}
              />
            </Pill>

            <Pill>
              <Select
                value={level}
                onChange={setLevel}
                options={opts.levels.map((lv) => ({
                  value: lv,
                  label: lv === "all" ? "전체 레벨" : lv,
                }))}
              />
            </Pill>

            <form className="searchBox" onSubmit={onSearchSubmit}>
              <input
                className="searchInput"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="메시지/컨테이너/태그 검색"
              />
              <button type="submit" className="searchBtn">
                검색
              </button>
            </form>
          </div>

          <div className="summaryRow">
            <div className="summaryLeft">
              <div className="summaryTitle">
                조회된 로그 : {data.counts.total.toLocaleString()}개
              </div>

              <div className="summaryBadges">
                <span className="sumChip error">ERROR {data.counts.ERROR}</span>
                <span className="sumChip warn">WARN {data.counts.WARN}</span>
                <span className="sumChip info">INFO {data.counts.INFO}</span>
              </div>
            </div>

            <div className="summaryRight">
              {loading ? <span className="loadingTxt">조회 중...</span> : null}
            </div>
          </div>
        </section>

        {/* 목록 + 상세 */}
        <section className="logGrid">
          <div className="logTableCard">
            <div className="logTableHead">
              <div className="th">레벨</div>
              <div className="th">시간</div>
              <div className="th">컨테이너</div>
              <div className="th">메시지</div>
              <div className="th">구분</div>
            </div>

            <div className="logTableBody">
              {data.items.length === 0 ? (
                <div className="emptyState">
                  <div className="emptyIcon">◻</div>
                  <div style={{ fontWeight: 900 }}>조건에 맞는 로그가 없습니다</div>
                  <div style={{ fontSize: 12 }}>필터를 바꾸거나 검색어를 지워보세요</div>
                </div>
              ) : (
                data.items.map((row) => {
                  const active = selected && selected.id === row.id;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      className={`logRow ${active ? "active" : ""}`}
                      onClick={() => setSelected(row)}
                    >
                      <div className="td">
                        <LevelBadge level={row.level} />
                      </div>
                      <div className="td mono">{row.tsText}</div>
                      <div className="td">{row.container}</div>
                      <div className="td msg">{row.message}</div>
                      <div className="td">
                        <TagBadge text={row.tag} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="logTableFoot">
              <div className="rangeTxt">
                {data.total === 0
                  ? "0"
                  : `${(data.page - 1) * data.pageSize + 1} - ${Math.min(
                      data.page * data.pageSize,
                      data.total
                    )} of ${data.total.toLocaleString()}`}
              </div>

              <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} />
            </div>
          </div>

          <div className="detailCard">
            <div className="detailHead">
              <div className="detailTitle">로그 상세</div>
              <button
                type="button"
                className="detailClose"
                title="닫기"
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>

            {selected ? (
              <div className="detailBody">
                <div className="detailTop">
                  <LevelBadge level={selected.level} />
                  <span className="detailMsg">{selected.detail.summary}</span>
                </div>

                <div className="detailSection">
                  <div className="kv">
                    <div className="k">발생 시각</div>
                    <div className="v mono">{selected.detail.occurredAt}</div>
                  </div>
                  <div className="kv">
                    <div className="k">컨테이너</div>
                    <div className="v">{selected.detail.container}</div>
                  </div>
                  <div className="kv">
                    <div className="k">관련 메트릭</div>
                    <div className="v">{selected.detail.relatedMetric}</div>
                  </div>
                  <div className="kv">
                    <div className="k">호스트</div>
                    <div className="v">{selected.host}</div>
                  </div>
                  <div className="kv">
                    <div className="k">IP</div>
                    <div className="v mono">{selected.ip}</div>
                  </div>
                  <div className="kv">
                    <div className="k">서비스</div>
                    <div className="v">{selected.service}</div>
                  </div>
                </div>

                <div className="detailSection">
                  <div className="detailHintTitle">권장 조치</div>
                  <div className="detailHint">{selected.detail.suggestion}</div>
                </div>

                <div className="detailActions">
                  <button type="button" className="btn2" onClick={() => load(1)}>
                    재조회
                  </button>
                  <button
                    type="button"
                    className="btn2 primary"
                    onClick={() => alert("알림 설정은 다음 단계에서 연결하면 돼!")}
                  >
                    알림 설정
                  </button>
                </div>
              </div>
            ) : (
              <div className="detailEmpty">
                <div className="emptyIcon">☰</div>
                <div style={{ fontWeight: 900 }}>로그를 선택해 주세요</div>
                <div style={{ fontSize: 12 }}>
                  왼쪽 목록에서 한 줄을 클릭하면 상세가 여기 뜹니다
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}