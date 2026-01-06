import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './config/database';
import rabbitmqService from './services/rabbitmq.service';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://frontend:3001'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await db.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        rabbitmq: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable'
    });
  }
});

// Base route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Flight Delay Notifier - Central Service API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      flights: '/api/flights',
      users: '/api/users'
    }
  });
});

// Route handlers
import authRoutes from './routes/auth.routes';
app.use('/api/auth', authRoutes);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    await db.query('SELECT NOW()');
    console.log('Database connected successfully');

    // Connect to RabbitMQ
    await rabbitmqService.connect();

    // Start consuming messages from queues
    rabbitmqService.consumeFlightUpdates(async (message) => {
      console.log('Received flight update:', message);
      // TODO: Implement flight update processing logic
    });

    rabbitmqService.consumeTrafficUpdates(async (message) => {
      console.log('Received traffic update:', message);
      // TODO: Implement traffic update processing logic
    });

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await rabbitmqService.close();
  await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await rabbitmqService.close();
  await db.end();
  process.exit(0);
});

// Start the server
startServer();

export default app;
