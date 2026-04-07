import { useState, useEffect, useRef } from "react";
import "./chatbot.css";
import { getStoredSession } from "../../services/authStorage.js";
import { askChatbot, getChatHistory } from "../../services/monitoringApi.js";

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

  // 현재 시간 구하는 헬퍼
  const getCurrentTime = () => new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  useEffect(() => {
    if (!monitoringId) return;
    getChatHistory(monitoringId).then(history => {
      if (history && history.length > 0) {
    // 백엔드의 createdAt 시간을 그대로 사용
    setMessages(history.map(h => ({ role: h.role, content: h.content, time: h.createdAt })));
        setMessages(mappedHistory);
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
    <div className="chatbotPage" style={{ display: 'flex', justifyContent: 'center', background: '#f0f2f5', height: 'calc(100vh - 60px)', padding: '20px' }}>
      <div className="chatbotContainer" style={{ 
        width: '100%', maxWidth: '900px', height: '100%', display: 'flex', flexDirection: 'column', 
        background: '#fff', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', overflow: 'hidden' 
      }}>
        <header style={{ padding: '20px', background: '#ffffff', borderBottom: '1px solid #eaeaea', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#000', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px', marginRight: '15px' }}>🤖</div>
          <div><h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>AI Monitoring Assistant</h3><p style={{ margin: 0, fontSize: '13px', color: '#888', marginTop: '4px' }}>실시간 서버 리소스 분석 중</p></div>
        </header>

        <div style={{ padding: '15px 20px', background: '#fafbfc', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: '10px', overflowX: 'auto' }}>
          {EXAMPLE_QUESTIONS.map(q => (
            <button key={q} onClick={() => handleSend(q)} style={{ padding: '8px 16px', fontSize: '13px', background: '#fff', color: '#555', border: '1px solid #e1e4e8', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
                  padding: '14px 18px', borderRadius: '16px', fontSize: '15px', lineHeight: '1.6', wordBreak: 'break-word',
                  background: msg.role === 'user' ? '#1a1a1a' : '#f4f6f8', color: msg.role === 'user' ? '#ffffff' : '#24292e',
                  borderTopRightRadius: msg.role === 'user' ? '4px' : '16px', borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '16px'
                }}>{msg.content}</div>
              </div>
              <div style={{ fontSize: '11px', color: '#adb5bd', marginTop: '6px', marginLeft: msg.role === 'assistant' ? '40px' : '0', marginRight: msg.role === 'user' ? '10px' : '0' }}>
                {msg.time}
              </div>
            </div>
          ))}
          {loading && <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}><div style={{ fontSize: '20px', marginRight: '10px' }}>🤖</div><div style={{ color: '#888', fontSize: '14px', background: '#f4f6f8', padding: '12px 18px', borderRadius: '16px 16px 16px 4px' }}>분석 중...</div></div>}
        </div>

        <div className="chatInputArea" style={{ padding: '20px', background: '#fff', borderTop: '1px solid #eaeaea' }}>
          <div style={{ display: 'flex', gap: '12px', background: '#f4f6f8', padding: '8px', borderRadius: '12px', border: '1px solid #e1e4e8' }}>
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="메시지 입력..." style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', outline: 'none', fontSize: '15px' }} />
            <button onClick={() => handleSend()} disabled={loading} style={{ padding: '0 24px', background: '#1a1a1a', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>전송</button>
          </div>
        </div>
      </div>
    </div>
  );
}