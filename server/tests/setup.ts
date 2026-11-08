// Fake values for tests only. Real secrets live in server/.env, which tests never read.
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.REVIEWS_PER_HOUR = "5";
process.env.CLIENT_URL = "http://localhost:5173";
