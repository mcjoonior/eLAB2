import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
  getAnalyses,
  getAnalysisById,
  createAnalysis,
  updateAnalysis,
  changeAnalysisStatus,
  approveAnalysis,
  saveAnalysisResults,
  addRecommendation,
  getRecommendations,
  uploadAttachments,
  addAttachments,
  deleteAttachment,
  deleteAnalysis,
} from '../controllers/analysisController';

const router = Router();

// Wszystkie endpointy wymagaja autoryzacji
router.use(authenticateToken as any);

// GET /api/analyses - Lista analiz z filtrami i paginacja
router.get('/', getAnalyses as any);

// GET /api/analyses/:id - Szczegoly analizy z wynikami, zaleceniami, probka, procesem
router.get('/:id', getAnalysisById as any);

// POST /api/analyses - Utworzenie analizy z automatycznym kodem ANL-YYYYMM-XXXX
router.post('/', createAnalysis as any);

// PUT /api/analyses/:id - Aktualizacja analizy
router.put('/:id', updateAnalysis as any);

// PATCH /api/analyses/:id/status - Zmiana statusu analizy (workflow)
router.patch('/:id/status', changeAnalysisStatus as any);

// PATCH /api/analyses/:id/approve - Zatwierdzenie analizy (tylko ADMIN)
router.patch('/:id/approve', authenticateToken as any, authorizeRoles('ADMIN') as any, approveAnalysis as any);

// POST /api/analyses/:id/results - Zapisanie wynikow analizy
router.post('/:id/results', saveAnalysisResults as any);

// POST /api/analyses/:id/recommendations - Dodanie zalecenia
router.post('/:id/recommendations', addRecommendation as any);

// GET /api/analyses/:id/recommendations - Pobranie zalecen analizy
router.get('/:id/recommendations', getRecommendations as any);

// POST /api/analyses/:id/attachments - Upload zdjec do analizy
router.post('/:id/attachments', uploadAttachments.array('files', 10) as any, addAttachments as any);

// DELETE /api/analyses/:id/attachments/:attachmentId - Usun zalacznik
router.delete('/:id/attachments/:attachmentId', deleteAttachment as any);
router.delete('/:id', authorizeRoles('ADMIN') as any, deleteAnalysis as any);

export default router;
