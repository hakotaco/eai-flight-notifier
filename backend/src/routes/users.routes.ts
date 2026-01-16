import { Router } from 'express';
import { getAllUsersWithFlights } from '../controllers/users.controller';

const router = Router();

// Get all users with upcoming flights (for maps-api scheduler)
router.get('/travelers', getAllUsersWithFlights);

export default router;
