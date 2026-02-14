import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

import ImacMock from "../../components/common/ImacMock.jsx";
import dashboard from "../../assets/images/dashboard.png";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  const canSubmit = useMemo(() => email.trim() && pw.trim(), [email, pw]);

  const onSubmit = (e) => {
    e.preventDefault();
    alert("로그인 API는 다음 단계에서 붙일게. 지금은 UI/라우팅만.");
  };

  return (
    <div className="loginPage">
      <div className="loginCard">
        <div className="loginLeft">
          <ImacMock screenSrc={dashboard} />
        </div>

        <div className="loginRight">
          <div className="loginHead">
            <h1 className="loginTitle">로그인</h1>
            <p className="loginSub">서비스 이용을 위해 로그인 해주세요</p>
          </div>

          <form className="loginForm" onSubmit={onSubmit}>
            <input
              className="input"
              type="email"
              placeholder="이메일 (ID)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />

            <input
              className="input"
              type="password"
              placeholder="비밀번호"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
            />

            <button type="button" className="linkBtn">
              비밀번호 찾기
            </button>

            <button className="primaryBtn" type="submit" disabled={!canSubmit}>
              로그인
            </button>

            <div className="divider" />

            <button className="ghostBtn" type="button">
              회원가입
            </button>

            <button className="backBtn" type="button" onClick={() => navigate("/")}>
              ← 처음으로
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
