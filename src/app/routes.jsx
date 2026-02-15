import { createBrowserRouter } from "react-router-dom";

import Landing from "../pages/Landing/Landing.jsx";
import Login from "../pages/Auth/Login.jsx";
import Signup from "../pages/Auth/Signup.jsx";

import AppLayout from "../layouts/AppLayout.jsx";
import Dashboard from "../pages/Dashboard/Dashboard.jsx";

import NotFound from "../pages/NotFound.jsx";

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },

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
