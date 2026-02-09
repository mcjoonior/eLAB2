import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';

// ============================================================
// GET / - Powiadomienia uzytkownika
// ============================================================

export const getNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '25',
      isRead,
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      userId: req.user!.userId,
    };

    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PATCH /:id/read - Oznacz powiadomienie jako przeczytane
// ============================================================

export const markAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: req.user!.userId,
      },
    });

    if (!notification) {
      res.status(404).json({ error: 'Powiadomienie nie zostalo znalezione' });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PATCH /read-all - Oznacz wszystkie powiadomienia jako przeczytane
// ============================================================

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user!.userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({
      message: `Oznaczono ${result.count} powiadomien jako przeczytane`,
      count: result.count,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /unread-count - Liczba nieprzeczytanych powiadomien
// ============================================================

export const getUnreadCount = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user!.userId,
        isRead: false,
      },
    });

    res.json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
};
