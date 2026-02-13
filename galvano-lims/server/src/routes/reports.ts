import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
  getReports,
  getReportById,
  generateReport,
  downloadReport,
  sendReportByEmail,
  deleteReport,
} from '../controllers/reportController';

const router = Router();

// Wszystkie endpointy wymagaja autoryzacji
router.use(authenticateToken as any);

// GET /api/reports - Lista raportow z paginacja
router.get('/', getReports as any);

// GET /api/reports/:id - Szczegoly raportu
router.get('/:id', getReportById as any);

// POST /api/reports/generate/:analysisId - Generowanie raportu PDF
router.post('/generate/:analysisId', generateReport as any);

// GET /api/reports/:id/download - Pobranie pliku PDF
router.get('/:id/download', downloadReport as any);

// POST /api/reports/:id/send-email - Wyslanie raportu emailem
router.post('/:id/send-email', sendReportByEmail as any);
router.delete('/:id', authorizeRoles('ADMIN') as any, deleteReport as any);

export default router;
