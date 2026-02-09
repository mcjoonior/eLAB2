import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getArchivedAnalyses,
  getTrendData,
  exportAnalysesCsv,
  getDeviationStats,
} from '../controllers/archiveController';

const router = Router();

// Wszystkie endpointy wymagaja autoryzacji
router.use(authenticateToken as any);

// GET /api/archive/analyses - Archiwum analiz z zaawansowanymi filtrami
router.get('/analyses', getArchivedAnalyses as any);

// GET /api/archive/trend - Dane trendow do wykresow
router.get('/trend', getTrendData as any);

// GET /api/archive/export/csv - Eksport analiz do CSV
router.get('/export/csv', exportAnalysesCsv as any);

// GET /api/archive/deviations - Statystyki odchylen
router.get('/deviations', getDeviationStats as any);

export default router;
