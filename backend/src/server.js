import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import config from './config/index.js';
import logger from './config/logger.js';
import errorHandler from './middleware/errorHandler.js';
import transactionRoutes from './routes/transactions.js';
import submissionsRoutes from './routes/submissions.js';
import draftsRoutes from './routes/drafts.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import referencesRoutes from './routes/references.js';
import { requireAuth } from './middleware/requireAuth.js';

const app = express();

app.use(helmet());
app.set('trust proxy', 'loopback');

app.use(cors({
  origin: config.portal.allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/transactions', requireAuth, transactionRoutes);
app.use('/api/submissions', requireAuth, submissionsRoutes);
app.use('/api/drafts', requireAuth, draftsRoutes);
app.use('/api/references', requireAuth, referencesRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

app.use(errorHandler);

const PORT = config.port;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Momentum Portal Backend running on port ${PORT}`, {
      environment: config.nodeEnv,
      momentumUrl: config.momentum.baseUrl,
    });
  });
}

export default app;
