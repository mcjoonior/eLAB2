import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getSamples,
  getSampleById,
  createSample,
  updateSample,
  changeSampleStatus,
} from '../controllers/sampleController';

const router = Router();

// Wszystkie endpointy wymagaja autoryzacji
router.use(authenticateToken as any);

// GET /api/samples - Lista probek z filtrami i paginacja
router.get('/', getSamples as any);

// GET /api/samples/:id - Szczegoly probki z klientem, procesem i analizami
router.get('/:id', getSampleById as any);

// POST /api/samples - Utworzenie probki z automatycznym kodem PRB-YYYYMM-XXXX
router.post('/', createSample as any);

// PUT /api/samples/:id - Aktualizacja probki
router.put('/:id', updateSample as any);

// PATCH /api/samples/:id/status - Zmiana statusu probki (workflow)
router.patch('/:id/status', changeSampleStatus as any);

export default router;
