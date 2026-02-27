import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App.jsx";

// 전역 스타일  브라우저가 최초로 실행할 때 제일 먼저 읽는 파일 
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
