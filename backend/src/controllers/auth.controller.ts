import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/database";
import { User } from "../entities/User";
import { Flight, FlightStatus } from "../entities/Flight";
import { UserFlightSubscription } from "../entities/UserFlightSubscription";
import { v4 as uuidv4 } from "uuid";

interface SignupRequest {
  email: string;
  name: string;
  homeAddress: string;
  flightNumber: string;
  departureDate: string;
}

export const signup = async (req: Request, res: Response): Promise<void> => {
  const {
    email,
    name,
    homeAddress,
    flightNumber,
    departureDate,
  }: SignupRequest = req.body;

  try {
    const userRepository = AppDataSource.getRepository(User);
    const flightRepository = AppDataSource.getRepository(Flight);
    const subscriptionRepository =
      AppDataSource.getRepository(UserFlightSubscription);

    // Check if user already exists
    const existingUser = await userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        error: "User with this email already exists",
      });
      return;
    }

    // Generate a simple password for now (in production, you'd want proper auth)
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Parse departure date
    const departureDateTime = new Date(departureDate);
    const scheduleDate = departureDateTime.toISOString().split("T")[0]; // YYYY-MM-DD

    // Start transaction
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create and save user
      const user = userRepository.create({
        id: uuidv4(),
        email,
        name,
        passwordHash,
        homeAddress,
      });

      await queryRunner.manager.save(user);

      // Check if flight already exists for this flight number and date
      let flight = await flightRepository.findOne({
        where: {
          flightNumber: flightNumber.toUpperCase(),
          scheduleDate: scheduleDate,
        },
      });

      // Create flight if it doesn't exist
      if (!flight) {
        flight = flightRepository.create({
          id: uuidv4(),
          flightNumber: flightNumber.toUpperCase(),
          scheduleDate: scheduleDate,
          scheduledDepartureTime: departureDateTime,
          actualDepartureTime: null, // Will be updated by Schiphol service
          origin: "Schiphol Airport (AMS)",
          destination: "Unknown", // Will be updated by Schiphol service
          status: FlightStatus.SCHEDULED,
          lastUpdated: new Date(),
        });

        await queryRunner.manager.save(flight);
      }

      // Create subscription
      const subscription = subscriptionRepository.create({
        id: uuidv4(),
        userId: user.id,
        flightId: flight.id,
        subscribedAt: new Date(),
      });

      await queryRunner.manager.save(subscription);

      await queryRunner.commitTransaction();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || "secret"
      );

      res.status(201).json({
        message: "Signup successful",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          homeAddress: user.homeAddress,
        },
        flight: {
          id: flight.id,
          flightNumber: flight.flightNumber,
          departureTime: flight.scheduledDepartureTime,
          origin: flight.origin,
          destination: flight.destination,
          status: flight.status,
        },
        token,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      error: "Failed to create account",
      message:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
};

export const getUserFlights = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = req.params;

  try {
    const subscriptionRepository =
      AppDataSource.getRepository(UserFlightSubscription);
    const flightRepository = AppDataSource.getRepository(Flight);

    // Get all flight subscriptions for the user
    const subscriptions = await subscriptionRepository.find({
      where: { userId },
    });

    // Get all flight details
    const flightIds = subscriptions.map((sub) => sub.flightId);
    const flights = await flightRepository.findByIds(flightIds);

    res.json({
      flights: flights.map((flight) => ({
        id: flight.id,
        flightNumber: flight.flightNumber,
        scheduledDepartureTime: flight.scheduledDepartureTime,
        actualDepartureTime: flight.actualDepartureTime,
        arrivalTime: flight.arrivalTime,
        origin: flight.origin,
        destination: flight.destination,
        status: flight.status,
        lastUpdated: flight.lastUpdated,
      })),
    });
  } catch (error) {
    console.error("Error fetching flights:", error);
    res.status(500).json({ error: "Failed to fetch flights" });
  }
};
