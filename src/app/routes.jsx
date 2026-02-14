import PublicLayout from "../layouts/PublicLayout.jsx";
import AppLayout from "../layouts/AppLayout.jsx";

import Landing from "../pages/Landing/Landing.jsx";
import Login from "../pages/Auth/Login.jsx";
import Dashboard from "../pages/Dashboard/Dashboard.jsx";
import NotFound from "../pages/NotFound.jsx";

const routes = [
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/login", element: <Login /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [{ path: "/dashboard", element: <Dashboard /> }],
  },
  { path: "*", element: <NotFound /> },
];

export default routes;
