import { createBrowserRouter } from "react-router-dom";

import PublicLayout from "../layouts/PublicLayout.jsx";
import AppLayout from "../layouts/AppLayout.jsx";

import Landing from "../pages/Landing/Landing.jsx";
import Login from "../pages/Auth/Login.jsx";
import Signup from "../pages/Auth/Signup.jsx";

import Dashboard from "../pages/Dashboard/Dashboard.jsx";
import ServerDetail from "../pages/Servers/ServerDetail.jsx";
import Alerts from "../pages/Alerts/Alerts.jsx";

import NotFound from "../pages/NotFound.jsx";

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/login", element: <Login /> },
      { path: "/signup", element: <Signup /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/servers/:serverId", element: <ServerDetail /> },
      { path: "/alerts", element: <Alerts /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
