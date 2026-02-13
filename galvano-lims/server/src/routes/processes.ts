import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
  getProcesses,
  getProcessById,
  createProcess,
  updateProcess,
  cloneProcess,
  deleteProcess,
} from '../controllers/processController';

const router = Router();

// Wszystkie endpointy wymagają autoryzacji
router.use(authenticateToken as any);

router.get('/', getProcesses as any);
router.get('/:id', getProcessById as any);
router.post('/', createProcess as any);
router.put('/:id', updateProcess as any);
router.post('/:id/clone', cloneProcess as any);
router.delete('/:id', authorizeRoles('ADMIN') as any, deleteProcess as any);

export default router;
