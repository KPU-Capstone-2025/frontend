import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App.jsx";

// 전역 스타일(네가 쓰던 index.css를 여기서 유지해도 OK)
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
