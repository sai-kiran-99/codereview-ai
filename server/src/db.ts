import mongoose from "mongoose";

/**
 * Connects to MongoDB. Throws if MONGODB_URI is missing or the database can't be reached,
 * so the server never starts in a broken state.
 */
export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to server/.env (see .env.example).");
  }

  // Fail after 10s instead of the default 30s when Atlas is unreachable (wrong host, IP not allowlisted).
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });

  // Log the host only. The URI contains the database password.
  console.log(`MongoDB connected: ${mongoose.connection.host}`);

  // Errors after the first connect (e.g. network drop) arrive as events, not thrown errors.
  mongoose.connection.on("error", (err) => console.error("MongoDB error:", err.message));
  mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));
}
