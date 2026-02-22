import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
  getPriceList,
  createPriceListItem,
  updatePriceListItem,
} from '../controllers/priceListController';

const router = Router();

router.use(authenticateToken as any);

router.get('/', getPriceList as any);
router.post('/', authorizeRoles('ADMIN') as any, createPriceListItem as any);
router.put('/:id', authorizeRoles('ADMIN') as any, updatePriceListItem as any);

export default router;
