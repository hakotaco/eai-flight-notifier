import { Router } from "express";
import { validateSignup } from "../middleware/validation";
import { signup, getUserFlights } from "../controllers/auth.controller";
import { unsubscribe } from "../controllers/unsubscribe.controller";

const router = Router();

// Signup endpoint - creates user and registers their flight
router.post("/signup", validateSignup, signup);

// Get user's flights
router.get("/flights/:userId", getUserFlights);

// Unsubscribe endpoint
router.get("/unsubscribe/:subscriptionId", unsubscribe);

export default router;
