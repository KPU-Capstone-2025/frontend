import { useEffect, useRef, useState } from "react";
import "./chatbot.css";
import { getStoredSession } from "../../services/authStorage.js";
import { askChatbot } from "../../services/monitoringApi.js";
import botImage from "../../assets/images/chatbot.png";

const EXAMPLE_QUESTIONS = [
  "현재 컨테이너별 메모리 사용량 알려줘",
  "최근에 발생한 주요 장애 로그 요약해줘",
  "서버 장애가 발생하면 어떻게 조치해야 해?",
];

const FIRST_MESSAGE = {
  role: "assistant",
  content:
    "안녕하세요! 궁금한 사항이 있으시면 언제든지 물어보세요.\n도움이 필요하신 경우 언제든지 제게 알려주세요!",
};

function formatTime() {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function Chatbot() {
  const session = getStoredSession();
  const monitoringId = session?.monitoringId;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    setInput("");
    setError("");

    if (!monitoringId) {
      setMessages([
        {
          role: "assistant",
          content: "로그인 정보에서 monitoringId를 찾지 못했어. 다시 로그인 후 이용해줘.",
          time: formatTime(),
        },
      ]);
      return;
    }

    setMessages([
      {
        ...FIRST_MESSAGE,
        time: formatTime(),
      },
    ]);
  }, [monitoringId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  function resetChat() {
    setMessages([
      {
        ...FIRST_MESSAGE,
        time: formatTime(),
      },
    ]);
    setInput("");
    setError("");
  }

  async function handleSend(text = input) {
    const question = String(text || "").trim();
    if (!question || loading) return;

    if (!monitoringId) {
      setError("로그인 정보가 없어 챗봇 요청을 보낼 수 없습니다.");
      return;
    }

    setError("");
    setInput("");
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: question,
        time: formatTime(),
      },
    ]);

    try {
      const result = await askChatbot(monitoringId, question);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result?.answer || "응답 내용을 찾지 못했습니다.",
          time: formatTime(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ 챗봇 요청에 실패했습니다. ${
            err?.message || "백엔드 연결을 확인해주세요."
          }`,
          time: formatTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chatbotPage">
      <section className="chatbotMainCard">
        <header className="chatbotHeader">
          <div className="chatbotBotAvatar">
            <img src={botImage} alt="chatbot" />
          </div>

          <div className="chatbotTitleBox">
            <h2>모니터링 AI Assistant</h2>
            <p>
              <span />
              실시간 서버 테스트 분석 중
            </p>
          </div>

          <button type="button" className="chatResetButton" onClick={resetChat}>
            대화 새로고침
          </button>
        </header>

        {error && <div className="chatbotError">{error}</div>}

        <div className="chatbotMessages" ref={scrollRef}>
          {messages.map((msg, index) => (
            <div
              key={`${msg.role}-${index}`}
              className={`chatMessage ${
                msg.role === "user" ? "isUser" : "isAssistant"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="chatAvatar">
                  <img src={botImage} alt="chatbot" />
                </div>
              )}

              <div className="chatBubbleWrap">
                <div className="chatBubble">{msg.content}</div>
                <div className="chatTime">{msg.time}</div>
              </div>
            </div>
          ))}

          {messages.length <= 1 && (
            <div className="chatQuickBox">
              {EXAMPLE_QUESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleSend(item)}
                  disabled={loading}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="chatMessage isAssistant">
              <div className="chatAvatar">
                <img src={botImage} alt="chatbot" />
              </div>
              <div className="chatBubble isLoading">분석 중...</div>
            </div>
          )}
        </div>

        <form
          className="chatInputArea"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지 입력..."
            disabled={loading}
          />

          <button type="submit" disabled={loading || !input.trim()} aria-label="전송">
            ➤
          </button>
        </form>
      </section>
    </div>
  );
}