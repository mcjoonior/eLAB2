import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  exportClientData,
} from '../controllers/clientController';

const router = Router();

// Wszystkie endpointy wymagają autoryzacji
router.use(authenticateToken as any);

router.get('/', getClients as any);
router.get('/:id', getClientById as any);
router.post('/', createClient as any);
router.put('/:id', updateClient as any);
router.delete('/:id', deleteClient as any);
router.get('/:id/export', exportClientData as any);

export default router;
