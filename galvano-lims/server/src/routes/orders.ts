import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  changeOrderStatus,
  addManualOrderItem,
  removeManualOrderItem,
  recalculateOrderTotals,
} from '../controllers/orderController';

const router = Router();

router.use(authenticateToken as any);

router.get('/', getOrders as any);
router.get('/:id', getOrderById as any);
router.post('/', createOrder as any);
router.put('/:id', updateOrder as any);
router.patch('/:id/status', changeOrderStatus as any);
router.post('/:id/recalculate', recalculateOrderTotals as any);
router.post('/:id/items/manual', addManualOrderItem as any);
router.delete('/:id/items/:itemId', removeManualOrderItem as any);

export default router;
