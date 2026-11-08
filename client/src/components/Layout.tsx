import { NavLink, Outlet, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "../api/auth";
import { useAuthStore } from "../store/auth";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`;

export function Layout() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleLogout() {
    await logout().catch(() => {});
    queryClient.clear(); // don't show the previous user's data to the next one
    navigate("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">CR</span>
            <span className="hidden sm:inline">CodeReview AI</span>
          </NavLink>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navClass}>New review</NavLink>
            <NavLink to="/history" className={navClass}>History</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-slate-500 md:inline">{user?.email}</span>
            <button onClick={handleLogout} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
