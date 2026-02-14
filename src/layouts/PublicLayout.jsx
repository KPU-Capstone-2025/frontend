import { Outlet } from "react-router-dom";

export default function PublicLayout() {
  // 랜딩/로그인은 레이아웃이 단순하니까 그냥 outlet만
  return <Outlet />;
}
