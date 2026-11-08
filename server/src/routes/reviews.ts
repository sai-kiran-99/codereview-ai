import { Router } from "express";
import { createReview, createReviewSchema, deleteReview, getReview, listReviews } from "../controllers/reviews.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { rateLimitPerUser } from "../middleware/rateLimit.js";

const router = Router();
const reviewsPerHour = Number(process.env.REVIEWS_PER_HOUR) || 10;

router.use(requireAuth);
router.post("/", rateLimitPerUser(reviewsPerHour, 60 * 60 * 1000), validateBody(createReviewSchema), createReview);
router.get("/", listReviews);
router.get("/:id", getReview);
router.delete("/:id", deleteReview);

export default router;
