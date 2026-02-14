import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

import ImacMock from "../../components/common/ImacMock.jsx";
import dashboard from "../../assets/images/dashboard.png";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="authWrapper">
      <div className="authCard">
        {/* 왼쪽 이미지 */}
        <div className="authLeft">
          <ImacMock screenSrc={dashboard} />
        </div>

        {/* 오른쪽 */}
        <div className="authRight">
          <h1 className="authTitle">로그인</h1>
          <p className="authSub">
            서비스 이용을 위해 로그인 해주세요
          </p>

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

            <button
              type="button"
              className="authTextLink"
              onClick={() => alert("비밀번호 찾기 기능은 추후 연결 예정입니다.")}
            >
              비밀번호 찾기
            </button>

            <button type="submit" className="authBtn primary">
              로그인
            </button>

            <button type="button" className="authBtn secondary">
              회원가입
            </button>

            <button
              type="button"
              className="authBack"
              onClick={() => navigate("/")}
            >
              ← 처음으로
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
