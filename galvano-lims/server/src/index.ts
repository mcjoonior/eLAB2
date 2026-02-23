import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import processRoutes from './routes/processes';
import sampleRoutes from './routes/samples';
import analysisRoutes from './routes/analyses';
import reportRoutes from './routes/reports';
import importRoutes from './routes/import';
import adminRoutes from './routes/admin';
import dashboardRoutes from './routes/dashboard';
import archiveRoutes from './routes/archive';
import notificationRoutes from './routes/notifications';
import searchRoutes from './routes/search';
import deviceRoutes from './routes/devices';
import orderRoutes from './routes/orders';
import priceListRoutes from './routes/priceList';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust the nginx reverse proxy (needed for express-rate-limit behind nginx)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);

// Static files for uploads and reports
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/reports', express.static(path.join(__dirname, '..', 'reports')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/processes', processRoutes);
app.use('/api/samples', sampleRoutes);
app.use('/api/analyses', analysisRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/price-list', priceListRoutes);

// Public branding endpoint (no auth required)
app.get('/api/branding', async (_req, res) => {
  try {
    const settings = await prisma.companySettings.findFirst();
    res.json({
      companyName: settings?.companyName ?? 'eLAB LIMS',
      appSubtitle: settings?.appSubtitle ?? 'LIMS',
      logoUrl: settings?.logoUrl ?? null,
      dashboardVariant: settings?.dashboardVariant ?? 'CLEAN',
      themeMode: settings?.themeMode ?? 'LIGHT',
      appLanguage: settings?.appLanguage ?? 'PL',
    });
  } catch {
    res.json({
      companyName: 'eLAB LIMS',
      appSubtitle: 'LIMS',
      logoUrl: null,
      dashboardVariant: 'CLEAN',
      themeMode: 'LIGHT',
      appLanguage: 'PL',
    });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Serwer LIMS uruchomiony na porcie ${PORT}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
