import { Route } from "react-router-dom";
import Landing from "../pages/Landing/Landing.jsx";
import Login from "../pages/Auth/Login.jsx";

export default (
  <>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={<Login />} />
  </>
);
