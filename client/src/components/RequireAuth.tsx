import { Navigate, Outlet, useLocation } from "react-router";
import { useAuthStore } from "../store/auth";
import { FullPageSpinner } from "./ui";

/** Waits for the session restore on page load, then sends logged-out users to /login. */
export function RequireAuth() {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!ready) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
