import { useRoutes } from "react-router-dom";
import routes from "./routes.jsx";

export default function App() {
  const element = useRoutes(routes);
  return element;
}
