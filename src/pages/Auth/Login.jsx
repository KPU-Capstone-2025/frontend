import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";
import ImacMock from "../../components/common/ImacMock.jsx";
import dashboard from "../../assets/images/dashboard.png";
import { setStoredSession } from "../../services/authStorage.js";
import { loginCompany } from "../../services/monitoringApi.js";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      const session = await loginCompany({ email, password });
      
      // 백엔드 LoginResponse(id, name, monitoringId)를 세션에 저장
      setStoredSession({
        id: session.id,
        name: session.name,
        email: email,
        monitoringId: session.monitoringId 
      });

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError("로그인 정보가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authWrapper">
      <div className="authCard">
        <div className="authLeft"><ImacMock screenSrc={dashboard} /></div>
        <div className="authRight">
          <h1 className="authTitle">로그인</h1>
          <form className="authForm" onSubmit={handleSubmit}>
            <label className="authLabel">이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="authLabel">비밀번호</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <div style={{ color: "#d92d20", fontSize: 13, marginTop: 10 }}>{error}</div>}
            <button type="submit" className="authBtn primary" disabled={loading}>{loading ? "로그인 중..." : "로그인"}</button>
            <button type="button" className="authBtn secondary" onClick={() => navigate("/signup")}>회원가입</button>
          </form>
        </div>
      </div>
    </div>
  );
}