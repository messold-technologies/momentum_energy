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
import firstEnergyRoutes from './routes/firstEnergyAccounts.js';
import offersRoutes from './routes/offers.js';
import agentSalesRoutes from './routes/agentSales.js';
import consentRoutes from './routes/consent.js';
import agentPortalRoutes from './routes/agentPortal.js';
import rateCardRoutes from './routes/rateCard.js';
import { requireAgentScope } from './middleware/requireAgentScope.js';
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

// A consent token in a URL is a working link to a customer's identity documents, and
// morgan writes the whole path. Redact it so access logs cannot be replayed.
morgan.token('url', (req) =>
  String(req.originalUrl || req.url || '').replace(
    /\/consent\/[a-f0-9]{64}/gi,
    '/consent/[redacted]'
  )
);

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
app.use('/api/first-energy', requireAuth, firstEnergyRoutes);
app.use('/api/offers', requireAuth, offersRoutes);
app.use('/api/agent-sales', requireAuth, agentSalesRoutes);
// Admin only: uploading a rate card replaces every price the agent portal quotes.
app.use('/api/rate-card', requireAuth, rateCardRoutes);
// Public: the customer holds only a consent link, so this one sits outside requireAuth.
app.use('/api/consent', consentRoutes);
// Agent portal: agents sign up and log in with their own credentials, stored in
// agent_users. Their tokens carry scope 'agent' and are accepted only here, never by
// the staff routes above.
app.use('/api/agent-portal/offers', requireAgentScope, offersRoutes);
app.use('/api/agent-portal', agentPortalRoutes);

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

    // Consent links are sent to customers. A localhost link in production is useless to
    // them and nothing else surfaces it, so say so loudly at boot.
    const publicUrl = config.portal.publicUrl;
    if (config.nodeEnv === 'production' && /localhost|127\.0\.0\.1/.test(publicUrl)) {
      logger.error(
        `PUBLIC_APP_URL is not set and ALLOWED_ORIGINS has no public address, so consent links will point at ${publicUrl} and customers will not be able to open them.`
      );
    } else {
      logger.info(`Consent links will point at ${publicUrl}`);
    }
  });
}

export default app;
