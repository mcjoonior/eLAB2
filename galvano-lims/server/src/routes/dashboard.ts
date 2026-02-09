import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getStats,
  getRecentAnalyses,
  getCriticalAlerts,
} from '../controllers/dashboardController';

const router = Router();

// Wszystkie endpointy wymagaja autoryzacji
router.use(authenticateToken as any);

// GET /api/dashboard/stats - Statystyki (probki dzis/tydzien/miesiac, analizy, odchylenia)
router.get('/stats', getStats as any);

// GET /api/dashboard/recent-analyses - Ostatnie 10 analiz
router.get('/recent-analyses', getRecentAnalyses as any);

// GET /api/dashboard/critical-alerts - Alerty krytycznych odchylen
router.get('/critical-alerts', getCriticalAlerts as any);

export default router;
