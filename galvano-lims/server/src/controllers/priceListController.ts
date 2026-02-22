import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';

const createPriceSchema = z.object({
  code: z.string().min(2).max(60),
  name: z.string().min(2).max(120),
  analysisType: z.string().min(2).max(80),
  description: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  priceNet: z.number().positive(),
  vatRate: z.number().min(0).max(100).optional().default(0),
  currency: z.string().min(3).max(3).optional().default('PLN'),
  isActive: z.boolean().optional().default(true),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional().nullable(),
});

const updatePriceSchema = createPriceSchema.partial();

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '_');
}

export const getPriceList = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      analysisType,
      isActive,
      currency,
      asOf,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.AnalysisPriceListWhereInput = {};

    if (analysisType) where.analysisType = analysisType;
    if (currency) where.currency = currency.toUpperCase();
    if (isActive !== undefined) where.isActive = isActive === 'true';

    if (asOf) {
      const date = new Date(asOf);
      where.effectiveFrom = { lte: date };
      where.OR = [{ effectiveTo: null }, { effectiveTo: { gte: date } }];
    }

    const [data, total] = await Promise.all([
      prisma.analysisPriceList.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ analysisType: 'asc' }, { effectiveFrom: 'desc' }, { code: 'asc' }],
      }),
      prisma.analysisPriceList.count({ where }),
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

export const createPriceListItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createPriceSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;
    const code = normalizeCode(data.code);

    const duplicate = await prisma.analysisPriceList.findFirst({
      where: {
        code,
        effectiveFrom: new Date(data.effectiveFrom),
      },
    });

    if (duplicate) {
      res.status(409).json({ error: 'Wersja cennika o tym kodzie i dacie już istnieje.' });
      return;
    }

    const created = await prisma.analysisPriceList.create({
      data: {
        code,
        name: data.name.trim(),
        analysisType: data.analysisType.trim().toUpperCase(),
        description: data.description?.trim() ?? null,
        unit: data.unit?.trim() ?? null,
        priceNet: data.priceNet,
        vatRate: 0,
        currency: (data.currency ?? 'PLN').toUpperCase(),
        isActive: data.isActive ?? true,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'ANALYSIS_PRICE_LIST',
        entityId: created.id,
        details: { code: created.code, analysisType: created.analysisType, effectiveFrom: created.effectiveFrom },
      },
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

export const updatePriceListItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validation = updatePriceSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.analysisPriceList.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Pozycja cennika nie została znaleziona.' });
      return;
    }

    const input = validation.data;

    if (existing.effectiveFrom < new Date() && input.effectiveFrom) {
      res.status(400).json({ error: 'Nie można zmieniać effectiveFrom dla już obowiązującej pozycji.' });
      return;
    }

    const updated = await prisma.analysisPriceList.update({
      where: { id },
      data: {
        code: input.code ? normalizeCode(input.code) : undefined,
        name: input.name?.trim(),
        analysisType: input.analysisType?.trim().toUpperCase(),
        description: input.description !== undefined ? (input.description?.trim() ?? null) : undefined,
        unit: input.unit !== undefined ? (input.unit?.trim() ?? null) : undefined,
        priceNet: input.priceNet,
        vatRate: 0,
        currency: input.currency?.toUpperCase(),
        isActive: input.isActive,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
        effectiveTo: input.effectiveTo !== undefined ? (input.effectiveTo ? new Date(input.effectiveTo) : null) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'ANALYSIS_PRICE_LIST',
        entityId: updated.id,
        details: { code: updated.code, analysisType: updated.analysisType },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};
