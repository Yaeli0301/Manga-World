import { Outlet } from "react-router-dom";
import { BottomNav } from "../mobile/bottomNav/BottomNav";
import { TopBar } from "./TopBar";

export function AppLayout() {
  return (
    <>
      <TopBar />
      <Outlet />
      <BottomNav />
    </>
  );
}
