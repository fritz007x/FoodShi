import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import donationRoutes from './routes/donations';
import postRoutes from './routes/posts';
import reportRoutes from './routes/reports';
import rewardRoutes from './routes/rewards';
import invitationRoutes from './routes/invitations';
import internalRoutes from './routes/internal';
import worldidRoutes from './routes/worldid';
import uploadRoutes from './routes/uploads';
import { errorHandler } from './middleware/errorHandler';
import { initScheduler } from './jobs/scheduler';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/worldid', worldidRoutes);
app.use('/api/uploads', uploadRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize background jobs
  initScheduler();
});

export default app;
