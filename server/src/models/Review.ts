import { Schema, model, type InferSchemaType } from "mongoose";

export const SEVERITIES = ["critical", "major", "minor", "info"] as const;
export const CATEGORIES = ["bug", "security", "performance", "readability", "best-practice"] as const;
export const LANGUAGES = [
  "javascript", "typescript", "python", "java", "go", "rust", "c", "cpp", "csharp",
  "php", "ruby", "kotlin", "swift", "sql", "other",
] as const;

const issueSchema = new Schema(
  {
    line: { type: Number, required: true },
    severity: { type: String, enum: SEVERITIES, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    message: { type: String, required: true },
    suggestion: { type: String, default: "" },
  },
  { _id: false },
);

const reviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "Untitled review" },
    language: { type: String, enum: LANGUAGES, required: true },
    code: { type: String, required: true },
    /** A review takes several seconds and can fail, so the UI needs to know where it is. */
    status: { type: String, enum: ["running", "done", "failed"], default: "running" },
    summary: { type: String, default: "" },
    issues: { type: [issueSchema], default: [] },
    error: { type: String },
    model: { type: String },
    inputTokens: { type: Number },
    outputTokens: { type: Number },
    latencyMs: { type: Number },
  },
  { timestamps: true },
);

// History page: "my reviews, newest first".
reviewSchema.index({ userId: 1, createdAt: -1 });

export type ReviewDoc = InferSchemaType<typeof reviewSchema>;
export const Review = model("Review", reviewSchema);
