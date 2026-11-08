import { apiJson } from "./client";
import type { Review, ReviewList } from "../types";

export function listReviews(params: { page: number; limit?: number; q?: string }) {
  const search = new URLSearchParams({ page: String(params.page), limit: String(params.limit ?? 10) });
  if (params.q) search.set("q", params.q);
  return apiJson<ReviewList>(`/api/reviews?${search}`);
}

export async function getReview(id: string) {
  return (await apiJson<{ review: Review }>(`/api/reviews/${id}`)).review;
}

export function deleteReview(id: string) {
  return apiJson<void>(`/api/reviews/${id}`, { method: "DELETE" });
}
