import "./chatbot.css";

const EXAMPLE_QUESTIONS = [
  "현재 CPU 사용률이 가장 높은 컨테이너는 뭐야?",
  "최근 10분 내 ERROR 로그만 요약해줘.",
  "호스트 서버 네트워크 트래픽이 급증한 시점을 알려줘.",
  "특정 컨테이너 재시작이 필요한지 판단해줘.",
];

export default function Chatbot() {
  return (
    <div className="chatbotPage">
      <section className="chatbotHero">
        <div>
          <div className="chatbotEyebrow">MONITORING ASSISTANT</div>
          <h2 className="chatbotTitle">모니터링 챗봇</h2>
          <p className="chatbotDesc">
            대시보드와 로그 데이터를 바탕으로 질문하고, 장애 원인 분석이나 상태 요약을
            빠르게 확인할 수 있는 영역입니다.
          </p>
        </div>

        <div className="chatbotBadge">준비 중</div>
      </section>

      <section className="chatbotPanel">
        <div className="chatbotPanel__title">예시 질문</div>
        <div className="chatbotPromptGrid">
          {EXAMPLE_QUESTIONS.map((item) => (
            <button key={item} type="button" className="chatbotPromptBtn">
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="chatbotPanel chatbotPanel--empty">
        <div className="chatbotEmptyIcon">💬</div>
        <div className="chatbotEmptyTitle">챗봇 UI 연결 예정</div>
        <p className="chatbotEmptyDesc">
          현재는 사이드바 구조와 페이지 동선만 먼저 반영해둔 상태. 추후 API 또는 LLM
          연동 시 이 영역에 대화 UI를 붙이면 댐.
        </p>
      </section>
    </div>
  );
}