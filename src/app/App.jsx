import { RouterProvider } from "react-router-dom";
import { router } from "./routes.jsx";
//우리 앱은 라우팅 기반으로 움직인다는 선언하는 파일

export default function App() {
  return <RouterProvider router={router} />;
}
