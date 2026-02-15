import { createBrowserRouter } from "react-router-dom";

import Landing from "../pages/Landing/Landing.jsx";
import Login from "../pages/Auth/Login.jsx";

import AppLayout from "../layouts/AppLayout.jsx";
import Dashboard from "../pages/Dashboard/Dashboard.jsx";

function NotFound() {
  return <div style={{ padding: 24 }}>Not Found</div>;
}

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/login", element: <Login /> },

  {
    element: <AppLayout />,
    children: [
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/servers", element: <div>서버 상태(준비중)</div> },
      { path: "/logs", element: <div>로그 분석(준비중)</div> },
      { path: "/alerts", element: <div>알림 설정(준비중)</div> },
    ],
  },

  { path: "*", element: <NotFound /> },
]);
