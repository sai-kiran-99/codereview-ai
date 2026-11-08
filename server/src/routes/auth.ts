import { Router } from "express";
import { credentialsSchema, login, logout, me, refresh, signup } from "../controllers/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { rateLimitPerUser } from "../middleware/rateLimit.js";

const router = Router();

// Slow down password guessing: 20 attempts per 15 minutes per IP.
const authLimit = rateLimitPerUser(20, 15 * 60 * 1000);

router.post("/signup", authLimit, validateBody(credentialsSchema), signup);
router.post("/login", authLimit, validateBody(credentialsSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
