import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import { validateSignup } from '../middleware/validation';
import { FlightStatus } from '../types/models';

const router = Router();

interface SignupRequest {
  email: string;
  name: string;
  homeAddress: string;
  flightNumber: string;
  departureDate: string;
}

// Signup endpoint - creates user and registers their flight
router.post('/signup', validateSignup, async (req: Request, res: Response): Promise<void> => {
  const { email, name, homeAddress, flightNumber, departureDate }: SignupRequest = req.body;

  try {
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      res.status(400).json({
        error: 'User with this email already exists'
      });
      return;
    }

    // Generate a simple password for now (in production, you'd want proper auth)
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Start transaction
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Insert user
      const userResult = await client.query(
        `INSERT INTO users (email, name, password_hash, home_address)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, home_address, created_at`,
        [email, name, passwordHash, homeAddress]
      );

      const user = userResult.rows[0];

      // Insert flight (Schiphol is always the origin)
      const flightResult = await client.query(
        `INSERT INTO flights (user_id, flight_number, departure_time, origin, destination, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, flight_number, departure_time, origin, destination, status, created_at`,
        [
          user.id,
          flightNumber.toUpperCase(),
          new Date(departureDate),
          'Schiphol Airport (AMS)',
          'Unknown', // Will be updated by Schiphol service
          FlightStatus.SCHEDULED
        ]
      );

      const flight = flightResult.rows[0];

      await client.query('COMMIT');

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'secret'
      );

      res.status(201).json({
        message: 'Signup successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          homeAddress: user.home_address
        },
        flight: {
          id: flight.id,
          flightNumber: flight.flight_number,
          departureTime: flight.departure_time,
          origin: flight.origin,
          destination: flight.destination,
          status: flight.status
        },
        token
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Failed to create account',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Get user's flights
router.get('/flights/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const result = await db.query(
      `SELECT id, flight_number, departure_time, arrival_time, origin, destination, status, last_updated
       FROM flights
       WHERE user_id = $1
       ORDER BY departure_time DESC`,
      [userId]
    );

    res.json({
      flights: result.rows
    });
  } catch (error) {
    console.error('Error fetching flights:', error);
    res.status(500).json({ error: 'Failed to fetch flights' });
  }
});

export default router;
