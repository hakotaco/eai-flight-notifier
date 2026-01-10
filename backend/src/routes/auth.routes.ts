import { Router } from "express";
import { validateSignup } from "../middleware/validation";
import { signup, getUserFlights } from "../controllers/auth.controller";

const router = Router();

// Signup endpoint - creates user and registers their flight
router.post("/signup", validateSignup, signup);

// Get user's flights
router.get("/flights/:userId", getUserFlights);

export default router;
