import { Prisma, OrderStatus } from '@prisma/client';
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';

const createOrderSchema = z.object({
  clientId: z.string().uuid('Nieprawidłowy identyfikator klienta'),
  sampleIds: z.array(z.string().uuid()).optional().default([]),
  notes: z.string().optional().nullable(),
  currency: z.string().min(3).max(3).optional().default('PLN'),
  manualAdjustmentNet: z.number().optional().default(0),
  manualAdjustmentVatRate: z.number().min(0).max(100).optional().default(0),
});

const updateOrderSchema = z.object({
  sampleIds: z.array(z.string().uuid()).optional(),
  notes: z.string().optional().nullable(),
  manualAdjustmentNet: z.number().optional(),
  manualAdjustmentVatRate: z.number().min(0).max(100).optional().default(0),
});

const changeOrderStatusSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'CANCELLED']),
});

const addManualItemSchema = z.object({
  description: z.string().min(2),
  quantity: z.number().positive().optional().default(1),
  unitPriceNet: z.number().positive(),
  vatRate: z.number().min(0).max(100).optional().default(0),
  sampleId: z.string().uuid().optional().nullable(),
  priceListId: z.string().uuid().optional().nullable(),
});

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function generateOrderCode(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `ORD-${yearMonth}-`;

  const lastOrder = await prisma.order.findFirst({
    where: { orderCode: { startsWith: prefix } },
    orderBy: { orderCode: 'desc' },
  });

  let nextNumber = 1;
  if (lastOrder) {
    const lastNumber = parseInt(lastOrder.orderCode.replace(prefix, ''), 10);
    if (!Number.isNaN(lastNumber)) nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

async function findApplicablePrice(
  analysisType: string,
  currency: string,
  analysisDate: Date,
) {
  return prisma.analysisPriceList.findFirst({
    where: {
      analysisType,
      currency,
      isActive: true,
      effectiveFrom: { lte: analysisDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: analysisDate } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
}

async function recalculateOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        samples: {
          include: {
            analyses: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    await tx.orderItem.deleteMany({
      where: {
        orderId,
        analysisId: { not: null },
      },
    });

    const autoItemsToCreate: any[] = [];

    for (const sample of order.samples) {
      for (const analysis of sample.analyses) {
        let price = null;

        if ((analysis as any).priceListId) {
          price = await tx.analysisPriceList.findUnique({
            where: { id: (analysis as any).priceListId },
          });
        }

        if (!price) {
          price = await findApplicablePrice(analysis.analysisType as any, order.currency, analysis.analysisDate);
        }

        if (!price) continue;

        const unitPriceNet = Number(price.priceNet);
        const vatRate = 0;
        const quantity = 1;
        const lineTotalNet = roundCurrency(unitPriceNet * quantity);
        const lineTotalGross = lineTotalNet;

        autoItemsToCreate.push({
          orderId,
          sampleId: sample.id,
          analysisId: analysis.id,
          priceListId: price.id,
          description: `${price.name} (${analysis.analysisCode})`,
          quantity,
          unitPriceNet,
          vatRate,
          lineTotalNet,
          lineTotalGross,
        });
      }
    }

    if (autoItemsToCreate.length > 0) {
      await tx.orderItem.createMany({ data: autoItemsToCreate });
    }

    const allItems = await tx.orderItem.findMany({ where: { orderId } });

    const itemsNet = roundCurrency(allItems.reduce((sum, i) => sum + Number(i.lineTotalNet), 0));

    const manualAdjustmentNet = Number(order.manualAdjustmentNet);

    const totalNet = roundCurrency(itemsNet + manualAdjustmentNet);
    const totalGross = totalNet;

    return tx.order.update({
      where: { id: orderId },
      data: {
        totalNet,
        totalGross,
      },
      include: {
        client: { select: { id: true, companyName: true } },
        samples: { select: { id: true, sampleCode: true, status: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            sample: { select: { id: true, sampleCode: true } },
            analysis: { select: { id: true, analysisCode: true, analysisType: true } },
            priceList: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  });
}

export const getOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      status,
      clientId,
      search,
      page = '1',
      limit = '25',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status as any;
    if (clientId) where.clientId = clientId;

    if (search) {
      where.OR = [
        { orderCode: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { client: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const allowedSortFields = ['orderCode', 'createdAt', 'updatedAt', 'status', 'totalGross'];
    const resolvedSortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const resolvedSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [resolvedSortField]: resolvedSortOrder },
        include: {
          client: { select: { id: true, companyName: true } },
          _count: { select: { samples: true, items: true } },
        },
      }),
      prisma.order.count({ where }),
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

export const getOrderById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, companyName: true, email: true, contactPerson: true } },
        creator: { select: { id: true, firstName: true, lastName: true } },
        samples: {
          select: {
            id: true,
            sampleCode: true,
            status: true,
            sampleType: true,
            analyses: { select: { id: true, analysisCode: true, status: true, analysisType: true } },
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            sample: { select: { id: true, sampleCode: true } },
            analysis: { select: { id: true, analysisCode: true, analysisType: true } },
            priceList: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!order) {
      res.status(404).json({ error: 'Zlecenie nie zostało znalezione' });
      return;
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createOrderSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Błąd walidacji danych', details: validation.error.flatten().fieldErrors });
      return;
    }

    const data = validation.data;

    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      res.status(404).json({ error: 'Klient nie został znaleziony' });
      return;
    }

    if (data.sampleIds.length > 0) {
      const samplesCount = await prisma.sample.count({
        where: {
          id: { in: data.sampleIds },
          clientId: data.clientId,
        },
      });
      if (samplesCount !== data.sampleIds.length) {
        res.status(400).json({ error: 'Co najmniej jedna próbka nie należy do wskazanego klienta.' });
        return;
      }
    }

    const orderCode = await generateOrderCode();

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderCode,
          clientId: data.clientId,
          notes: data.notes?.trim() ?? null,
          currency: data.currency.toUpperCase(),
          manualAdjustmentNet: data.manualAdjustmentNet,
          manualAdjustmentVatRate: 0,
          createdBy: req.user!.userId,
          status: 'NEW',
        },
      });

      if (data.sampleIds.length > 0) {
        await tx.sample.updateMany({
          where: { id: { in: data.sampleIds } },
          data: { orderId: created.id },
        });
      }

      return created;
    });

    const recalculated = await recalculateOrder(order.id);

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'ORDER',
        entityId: order.id,
        details: { orderCode: order.orderCode, clientId: order.clientId, sampleCount: data.sampleIds.length },
      },
    });

    res.status(201).json(recalculated);
  } catch (error) {
    next(error);
  }
};

export const updateOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validation = updateOrderSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: 'Błąd walidacji danych', details: validation.error.flatten().fieldErrors });
      return;
    }

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Zlecenie nie zostało znalezione' });
      return;
    }

    const data = validation.data;

    if (data.sampleIds) {
      const samplesCount = await prisma.sample.count({
        where: {
          id: { in: data.sampleIds },
          clientId: existing.clientId,
        },
      });

      if (samplesCount !== data.sampleIds.length) {
        res.status(400).json({ error: 'Co najmniej jedna próbka nie należy do klienta zlecenia.' });
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          notes: data.notes !== undefined ? (data.notes?.trim() ?? null) : undefined,
          manualAdjustmentNet: data.manualAdjustmentNet,
          manualAdjustmentVatRate: 0,
        },
      });

      if (data.sampleIds) {
        await tx.sample.updateMany({ where: { orderId: id }, data: { orderId: null } });
        if (data.sampleIds.length > 0) {
          await tx.sample.updateMany({ where: { id: { in: data.sampleIds } }, data: { orderId: id } });
        }
      }
    });

    const recalculated = await recalculateOrder(id);

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'ORDER',
        entityId: id,
        details: { updatedFields: Object.keys(data) },
      },
    });

    res.json(recalculated);
  } catch (error) {
    next(error);
  }
};

export const changeOrderStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validation = changeOrderStatusSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: 'Błąd walidacji danych', details: validation.error.flatten().fieldErrors });
      return;
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      res.status(404).json({ error: 'Zlecenie nie zostało znalezione' });
      return;
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      NEW: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: ['INVOICED', 'IN_PROGRESS'],
      INVOICED: [],
      CANCELLED: ['IN_PROGRESS'],
    };

    const targetStatus = validation.data.status as OrderStatus;
    if (!allowedTransitions[order.status].includes(targetStatus)) {
      res.status(400).json({
        error: `Niedozwolona zmiana statusu z "${order.status}" na "${targetStatus}"`,
        allowedTransitions: allowedTransitions[order.status],
      });
      return;
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: targetStatus },
      include: {
        client: { select: { id: true, companyName: true } },
        _count: { select: { samples: true, items: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'STATUS_CHANGE',
        entityType: 'ORDER',
        entityId: id,
        details: { previousStatus: order.status, newStatus: targetStatus },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const addManualOrderItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id: orderId } = req.params;
    const validation = addManualItemSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: 'Błąd walidacji danych', details: validation.error.flatten().fieldErrors });
      return;
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      res.status(404).json({ error: 'Zlecenie nie zostało znalezione' });
      return;
    }

    const data = validation.data;
    const quantity = data.quantity ?? 1;
    const lineTotalNet = roundCurrency(data.unitPriceNet * quantity);
    const lineTotalGross = lineTotalNet;

    const item = await prisma.orderItem.create({
      data: {
        orderId,
        sampleId: data.sampleId ?? null,
        priceListId: data.priceListId ?? null,
        description: data.description.trim(),
        quantity,
        unitPriceNet: data.unitPriceNet,
        vatRate: 0,
        lineTotalNet,
        lineTotalGross,
      },
    });

    const recalculated = await recalculateOrder(orderId);

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'ORDER_ITEM',
        entityId: item.id,
        details: { orderId, description: item.description, manual: true },
      },
    });

    res.status(201).json(recalculated);
  } catch (error) {
    next(error);
  }
};

export const removeManualOrderItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id: orderId, itemId } = req.params;

    const item = await prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!item || item.orderId !== orderId) {
      res.status(404).json({ error: 'Pozycja zlecenia nie została znaleziona' });
      return;
    }

    if (item.analysisId) {
      res.status(400).json({ error: 'Automatycznie wyliczonej pozycji nie można usunąć ręcznie.' });
      return;
    }

    await prisma.orderItem.delete({ where: { id: itemId } });
    const recalculated = await recalculateOrder(orderId);

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE',
        entityType: 'ORDER_ITEM',
        entityId: itemId,
        details: { orderId },
      },
    });

    res.json(recalculated);
  } catch (error) {
    next(error);
  }
};

export const recalculateOrderTotals = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Zlecenie nie zostało znalezione' });
      return;
    }

    const recalculated = await recalculateOrder(id);

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'RECALCULATE',
        entityType: 'ORDER',
        entityId: id,
        details: { totalNet: recalculated.totalNet, totalGross: recalculated.totalGross },
      },
    });

    res.json(recalculated);
  } catch (error) {
    if (error instanceof Error && error.message === 'ORDER_NOT_FOUND') {
      res.status(404).json({ error: 'Zlecenie nie zostało znalezione' });
      return;
    }
    next(error);
  }
};
