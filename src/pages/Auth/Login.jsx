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

      setStoredSession({
        userId: session.id,
        name: session.name,
        email: session.email,
        id: session.id,
      });

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err?.message || "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authWrapper">
      <div className="authCard">
        <div className="authLeft">
          <ImacMock screenSrc={dashboard} />
        </div>

        <div className="authRight">
          <h1 className="authTitle">로그인</h1>
          <p className="authSub">서비스 이용을 위해 로그인 해주세요</p>

          <form className="authForm" onSubmit={handleSubmit}>
            <label className="authLabel">이메일 (ID)</label>
            <input
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="authLabel">비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error ? (
              <div
                style={{
                  fontSize: 13,
                  color: "#d92d20",
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                {error}
              </div>
            ) : null}

            <button
              type="button"
              className="authTextLink"
              onClick={() => alert("비밀번호 찾기 기능은 추후 연결 예정입니다.")}
            >
              비밀번호 찾기
            </button>

            <button type="submit" className="authBtn primary" disabled={loading}>
              {loading ? "로그인 중..." : "로그인"}
            </button>

            <button
              type="button"
              className="authBtn secondary"
              onClick={() => navigate("/signup")}
              disabled={loading}
            >
              회원가입
            </button>

            <button
              type="button"
              className="authBack"
              onClick={() => navigate("/")}
              disabled={loading}
            >
              ← 메인으로
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}