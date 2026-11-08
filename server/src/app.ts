import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import reviewsRouter from "./routes/reviews.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

/** Builds the Express app without starting it, so tests can import it. */
export function createApp() {
  const app = express();

  // Render puts a proxy in front of us: trust it so req.ip and secure cookies work.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.CLIENT_URL ?? "http://localhost:5173").split(",").map((o) => o.trim()),
      credentials: true, // allow the refresh-token cookie
    }),
  );
  if (process.env.NODE_ENV !== "test") app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use("/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/reviews", reviewsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
