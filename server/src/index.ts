import "dotenv/config";
import { createApp } from "./app.js";
import { checkEnv } from "./config.js";
import { connectDB } from "./db.js";
import { Review } from "./models/Review.js";

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  checkEnv(); // missing secrets → stop now with a clear message
  await connectDB(); // no database → no server

  // A server restart mid-review leaves it "running" forever. Mark those as failed.
  await Review.updateMany(
    { status: "running", createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
    { status: "failed", error: "Interrupted" },
  );

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start().catch((err: unknown) => {
  console.error("Failed to start server:", err instanceof Error ? err.message : err);
  process.exit(1);
});
