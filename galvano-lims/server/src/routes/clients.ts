import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
  getClients,
  getClientById,
  createClient,
  lookupClientInGus,
  updateClient,
  deleteClient,
  permanentlyDeleteClient,
  exportClientsCsv,
  exportClientData,
} from '../controllers/clientController';

const router = Router();

// Wszystkie endpointy wymagają autoryzacji
router.use(authenticateToken as any);

router.get('/', getClients as any);
router.get('/export/csv', exportClientsCsv as any);
router.post('/lookup-gus', lookupClientInGus as any);
router.get('/:id', getClientById as any);
router.post('/', createClient as any);
router.put('/:id', updateClient as any);
router.delete('/:id', authorizeRoles('ADMIN') as any, deleteClient as any);
router.delete('/:id/permanent', authorizeRoles('ADMIN') as any, permanentlyDeleteClient as any);
router.get('/:id/export', exportClientData as any);

export default router;
