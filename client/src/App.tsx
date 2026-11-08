import { BrowserRouter, Link, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { EmptyState } from "./components/ui";
import { useBootstrapAuth } from "./hooks/useBootstrapAuth";
import { AuthPage } from "./pages/AuthPage";
import { HistoryPage } from "./pages/HistoryPage";
import { NewReviewPage } from "./pages/NewReviewPage";
import { ReviewDetailPage } from "./pages/ReviewDetailPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

function AppRoutes() {
  useBootstrapAuth();
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<NewReviewPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="reviews/:id" element={<ReviewDetailPage />} />
          <Route
            path="*"
            element={
              <EmptyState title="Page not found">
                <Link to="/" className="font-medium text-indigo-600 hover:underline">Go home</Link>
              </EmptyState>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
