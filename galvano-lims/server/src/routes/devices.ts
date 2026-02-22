import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  createDeviceMaintenanceLog,
  getUpcomingMaintenance,
} from '../controllers/deviceController';

const router = Router();

router.use(authenticateToken as any);

router.get('/', getDevices as any);
router.get('/upcoming-maintenance', getUpcomingMaintenance as any);
router.get('/:id', getDeviceById as any);
router.post('/', createDevice as any);
router.put('/:id', updateDevice as any);
router.post('/:id/maintenance-logs', createDeviceMaintenanceLog as any);

export default router;
