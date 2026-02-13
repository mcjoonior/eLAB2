import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
  getProcesses,
  getProcessTypes,
  createProcessType,
  updateProcessType,
  deleteProcessType,
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
router.get('/types', getProcessTypes as any);
router.post('/types', authorizeRoles('ADMIN') as any, createProcessType as any);
router.put('/types/:id', authorizeRoles('ADMIN') as any, updateProcessType as any);
router.delete('/types/:id', authorizeRoles('ADMIN') as any, deleteProcessType as any);
router.get('/:id', getProcessById as any);
router.post('/', createProcess as any);
router.put('/:id', updateProcess as any);
router.post('/:id/clone', cloneProcess as any);
router.delete('/:id', authorizeRoles('ADMIN') as any, deleteProcess as any);

export default router;
