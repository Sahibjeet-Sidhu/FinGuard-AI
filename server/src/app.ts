import './config/env';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import errorHandler from './middleware/errorHandler';

import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import caseRoutes from './routes/cases';
import analyticsRoutes from './routes/analytics';
import auditRoutes from './routes/audit';
import userRoutes from './routes/users';

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'FinGuard AI API' }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

app.use(errorHandler);

export default app;
