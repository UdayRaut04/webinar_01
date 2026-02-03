import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import RedisMock from 'ioredis-mock';

// Route imports
import authRoutes from './routes/auth';
import webinarRoutes from './routes/webinars';
import adminRoutes from './routes/admin';
import registrationRoutes from './routes/registrations';
import uploadRoutes from './routes/upload';
import { setupSocketHandlers } from './socket/index';
import { AutomationService } from './services/automation';

// Initialize Prisma
export const prisma = new PrismaClient();

// Initialize Redis (using mock for local dev)
export const redis = new RedisMock();

// Create Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
export const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Webinar Platform API' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/webinars', webinarRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/upload', uploadRoutes);

// Setup WebSocket handlers
setupSocketHandlers(io);

// Initialize Automation Service
const automationService = new AutomationService(io, prisma, redis);
automationService.start();

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🗄️  Database connected`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  redis.disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server };
