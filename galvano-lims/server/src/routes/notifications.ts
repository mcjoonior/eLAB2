import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from '../controllers/notificationController';

const router = Router();

// Wszystkie endpointy wymagaja autoryzacji
router.use(authenticateToken as any);

// GET /api/notifications - Powiadomienia uzytkownika
router.get('/', getNotifications as any);

// GET /api/notifications/unread-count - Liczba nieprzeczytanych
router.get('/unread-count', getUnreadCount as any);

// PATCH /api/notifications/read-all - Oznacz wszystkie jako przeczytane
router.patch('/read-all', markAllAsRead as any);

// PATCH /api/notifications/:id/read - Oznacz jako przeczytane
router.patch('/:id/read', markAsRead as any);

export default router;
