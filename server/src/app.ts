import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

/** Builds the Express app without starting it, so tests can import it later. */
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_URL ?? "http://localhost:5173",
      credentials: true, // allow the refresh-token cookie
    }),
  );
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use("/health", healthRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
