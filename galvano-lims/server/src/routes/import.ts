import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  handleUpload,
  uploadImport,
  handleValidate,
  handleExecute,
  getJobs,
  getJobById,
  handleRollback,
  getTemplates,
  createTemplate,
} from '../controllers/importController';

const router = Router();

// Wszystkie endpointy wymagaja autoryzacji
router.use(authenticateToken as any);

// POST /api/import/upload - Upload pliku (multer)
router.post('/upload', uploadImport.single('file') as any, handleUpload as any);

// POST /api/import/validate - Walidacja mapowania
router.post('/validate', handleValidate as any);

// POST /api/import/execute - Wykonanie importu
router.post('/execute', handleExecute as any);

// GET /api/import/jobs - Lista zadan importu
router.get('/jobs', getJobs as any);

// GET /api/import/jobs/:id - Szczegoly zadania importu
router.get('/jobs/:id', getJobById as any);

// POST /api/import/jobs/:id/rollback - Wycofanie importu
router.post('/jobs/:id/rollback', handleRollback as any);

// GET /api/import/templates - Lista szablonow importu
router.get('/templates', getTemplates as any);

// POST /api/import/templates - Zapisanie szablonu importu
router.post('/templates', createTemplate as any);

export default router;
