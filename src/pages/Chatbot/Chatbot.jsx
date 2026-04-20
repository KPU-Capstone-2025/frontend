import { useState, useEffect, useRef } from "react";
import "./chatbot.css";
import { getStoredSession } from "../../services/authStorage.js";
import { askChatbot, getChatHistory } from "../../services/monitoringApi.js";

/**
 * [수정사항]
 * 1. 백엔드 ChatHistoryResponse의 createdAt 포맷 반영
 * 2. assistant 역할을 assistant로 통일
 */
const EXAMPLE_QUESTIONS = [
  "현재 컨테이너별 메모리 사용량 알려줘",
  "최근에 발생한 주요 장애 로그 요약해줘",
  "서버 장애가 발생하면 어떻게 조치해야 해?"
];

export default function Chatbot() {
  const session = getStoredSession();
  const monitoringId = session?.monitoringId;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const getCurrentTime = () => new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  useEffect(() => {
    if (!monitoringId) return;
    getChatHistory(monitoringId).then(history => {
      if (history && history.length > 0) {
        // 백엔드에서 준 createdAt 사용
        setMessages(history.map(h => ({ 
          role: h.role === "assistant" ? "assistant" : "user", 
          content: h.content, 
          time: h.createdAt 
        })));
      } else {
        setMessages([{ role: "assistant", content: "안녕하세요! 서버 상태, 로그, 장애 원인 등을 편하게 물어보세요! 🤖", time: getCurrentTime() }]);
      }
    });
  }, [monitoringId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSend = async (text = input) => {
    const targetText = typeof text === 'string' ? text : input;
    if (!targetText.trim() || loading || !monitoringId) return;

    setMessages(prev => [...prev, { role: "user", content: targetText, time: getCurrentTime() }]);
    setInput("");
    setLoading(true);

    try {
      const res = await askChatbot(monitoringId, targetText);
      setMessages(prev => [...prev, { role: "assistant", content: res.answer, time: getCurrentTime() }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ 네트워크 통신에 실패했습니다.", time: getCurrentTime() }]);
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="chatbotPage" style={{ display: 'flex', justifyContent: 'center', background: 'transparent', height: 'calc(100vh - 60px)', padding: '4px 0 24px' }}>
      <div className="chatbotContainer" style={{ 
        width: '100%', maxWidth: '900px', height: '100%', display: 'flex', flexDirection: 'column', 
        background: '#fff', borderRadius: '8px', boxShadow: 'var(--shadow)', border: '1px solid #d8d8d8', overflow: 'hidden'
      }}>
        <header style={{ padding: '20px', background: '#ffffff', borderBottom: '1px solid #d8d8d8', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(20,110,245,0.1)', color: '#146ef5', border: '1px solid rgba(20,110,245,0.22)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px', marginRight: '15px' }}>🤖</div>
          <div><h3 style={{ margin: 0, fontSize: '18px', color: '#080808' }}>모니또링 AI Assistant</h3><p style={{ margin: 0, fontSize: '13px', color: '#5a5a5a', marginTop: '4px' }}>실시간 서버 리소스 분석 중</p></div>
        </header>

        <div style={{ padding: '15px 20px', background: '#f8fbff', borderBottom: '1px solid rgba(20,110,245,0.14)', display: 'flex', gap: '10px', overflowX: 'auto' }}>
          {EXAMPLE_QUESTIONS.map(q => (
            <button key={q} onClick={() => handleSend(q)} style={{ padding: '8px 16px', fontSize: '13px', background: '#fff', color: '#363636', border: '1px solid #d8d8d8', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {q}
            </button>
          ))}
        </div>

        <div className="chatBody" ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#ffffff' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', maxWidth: '85%' }}>
                {msg.role === 'assistant' && <div style={{ fontSize: '24px', marginRight: '10px', marginBottom: '5px' }}>🤖</div>}
                <div style={{ 
                  padding: '14px 18px', borderRadius: '8px', fontSize: '15px', lineHeight: '1.6', wordBreak: 'break-word',
                  background: msg.role === 'user' ? '#146ef5' : '#f8fbff', color: msg.role === 'user' ? '#ffffff' : '#080808',
                  border: msg.role === 'user' ? '1px solid #146ef5' : '1px solid rgba(20,110,245,0.14)'
                }}>{msg.content}</div>
              </div>
              <div style={{ fontSize: '11px', color: '#adb5bd', marginTop: '6px', marginLeft: msg.role === 'assistant' ? '40px' : '0', marginRight: msg.role === 'user' ? '10px' : '0' }}>
                {msg.time}
              </div>
            </div>
          ))}
          {loading && <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}><div style={{ fontSize: '20px', marginRight: '10px' }}>🤖</div><div style={{ color: '#5a5a5a', fontSize: '14px', background: '#f8fbff', border: '1px solid rgba(20,110,245,0.14)', padding: '12px 18px', borderRadius: '8px' }}>분석 중...</div></div>}
        </div>

        <div className="chatInputArea" style={{ padding: '20px', background: '#fff', borderTop: '1px solid #d8d8d8' }}>
          <div style={{ display: 'flex', gap: '12px', background: '#f8fbff', padding: '8px', borderRadius: '8px', border: '1px solid rgba(20,110,245,0.14)' }}>
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="메시지 입력..." style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', outline: 'none', fontSize: '15px' }} />
            <button onClick={() => handleSend()} disabled={loading} style={{ padding: '0 24px', background: '#146ef5', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>전송</button>
          </div>
        </div>
      </div>
    </div>
  );
}
