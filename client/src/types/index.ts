export const SEVERITIES = ["critical", "major", "minor", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export type Category = "bug" | "security" | "performance" | "readability" | "best-practice";

export const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "sql", label: "SQL" },
  { value: "other", label: "Other" },
] as const;
export type Language = (typeof LANGUAGES)[number]["value"];

export interface Issue {
  line: number;
  severity: Severity;
  category: Category;
  message: string;
  suggestion: string;
}

export type ReviewStatus = "running" | "done" | "failed";

export interface User {
  id: string;
  email: string;
}

export interface ReviewListItem {
  id: string;
  title: string;
  language: Language;
  status: ReviewStatus;
  summary: string;
  issueCounts: Record<Severity, number>;
  createdAt: string;
  latencyMs?: number;
}

export interface ReviewList {
  items: ReviewListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Review {
  id: string;
  title: string;
  language: Language;
  code: string;
  status: ReviewStatus;
  summary: string;
  issues: Issue[];
  error?: string;
  model?: string;
  latencyMs?: number;
  createdAt: string;
}
