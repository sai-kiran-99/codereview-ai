import { useEffect } from "react";
import { refreshAccessToken } from "../api/client";
import { useAuthStore } from "../store/auth";

/** On page load, try to restore the session from the refresh cookie. Runs once. */
export function useBootstrapAuth() {
  const ready = useAuthStore((s) => s.ready);
  useEffect(() => {
    if (ready) return;
    void refreshAccessToken().finally(() => useAuthStore.getState().setReady());
  }, [ready]);
  return ready;
}
