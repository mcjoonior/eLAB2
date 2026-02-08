import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../index';
import { AuthenticatedRequest } from '../middleware/auth';

// ============================================================
// Walidacja Zod
// ============================================================

const processParameterSchema = z.object({
  id: z.string().uuid().optional(),
  parameterName: z.string().min(1, 'Nazwa parametru jest wymagana'),
  unit: z.string().min(1, 'Jednostka jest wymagana'),
  minValue: z.number().optional().nullable(),
  maxValue: z.number().optional().nullable(),
  optimalValue: z.number().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const createProcessSchema = z.object({
  name: z.string().min(2, 'Nazwa procesu musi mieć co najmniej 2 znaki'),
  description: z.string().optional().nullable(),
  processType: z.enum(['ZINC', 'NICKEL', 'CHROME', 'COPPER', 'TIN', 'GOLD', 'SILVER', 'ANODIZING', 'PASSIVATION', 'OTHER']),
  clientId: z.string().uuid().optional().nullable(),
  parameters: z.array(processParameterSchema).optional().default([]),
});

const updateProcessSchema = createProcessSchema.partial();

// ============================================================
// GET / - Lista procesów z filtrami
// ============================================================

export const getProcesses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      processType,
      isActive,
      search,
      clientId,
      page = '1',
      limit = '25',
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ProcessWhereInput = {};

    if (processType) {
      where.processType = processType as any;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    } else {
      where.isActive = true;
    }

    if (clientId) {
      where.clientId = clientId as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const allowedSortFields = ['name', 'processType', 'createdAt', 'updatedAt'];
    const sortField = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'name';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';

    const [data, total] = await Promise.all([
      prisma.process.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortField]: order },
        include: {
          parameters: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          client: {
            select: { id: true, companyName: true },
          },
          _count: {
            select: { samples: true },
          },
        },
      }),
      prisma.process.count({ where }),
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
// GET /:id - Szczegóły procesu z parametrami
// ============================================================

export const getProcessById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const process = await prisma.process.findUnique({
      where: { id },
      include: {
        parameters: {
          orderBy: { sortOrder: 'asc' },
        },
        client: {
          select: { id: true, companyName: true },
        },
        _count: {
          select: { samples: true },
        },
      },
    });

    if (!process) {
      res.status(404).json({ error: 'Proces nie został znaleziony' });
      return;
    }

    res.json(process);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST / - Utworzenie procesu z parametrami
// ============================================================

export const createProcess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createProcessSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { parameters, ...processData } = validation.data;

    const process = await prisma.process.create({
      data: {
        ...processData,
        parameters: {
          create: parameters.map((p, index) => ({
            parameterName: p.parameterName,
            unit: p.unit,
            minValue: p.minValue,
            maxValue: p.maxValue,
            optimalValue: p.optimalValue,
            isActive: p.isActive ?? true,
            sortOrder: p.sortOrder ?? index,
          })),
        },
      },
      include: {
        parameters: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE',
        entityType: 'PROCESS',
        entityId: process.id,
        details: { name: process.name, processType: process.processType },
      },
    });

    res.status(201).json(process);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PUT /:id - Aktualizacja procesu i parametrów
// ============================================================

export const updateProcess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const validation = updateProcessSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.process.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Proces nie został znaleziony' });
      return;
    }

    const { parameters, ...processData } = validation.data;

    // Aktualizacja procesu i parametrów w transakcji
    const process = await prisma.$transaction(async (tx) => {
      // Aktualizuj dane procesu
      const updated = await tx.process.update({
        where: { id },
        data: processData,
      });

      // Jeśli przekazano parametry, zaktualizuj je
      if (parameters !== undefined) {
        // Pobierz istniejące parametry
        const existingParams = await tx.processParameter.findMany({
          where: { processId: id },
        });
        const existingIds = existingParams.map((p) => p.id);
        const incomingIds = parameters.filter((p) => p.id).map((p) => p.id!);

        // Usuń parametry, które nie są w przesłanej liście
        const toDelete = existingIds.filter((eid) => !incomingIds.includes(eid));
        if (toDelete.length > 0) {
          await tx.processParameter.deleteMany({
            where: { id: { in: toDelete } },
          });
        }

        // Upsert parametrów
        for (const param of parameters) {
          if (param.id && existingIds.includes(param.id)) {
            // Aktualizuj istniejący
            await tx.processParameter.update({
              where: { id: param.id },
              data: {
                parameterName: param.parameterName,
                unit: param.unit,
                minValue: param.minValue,
                maxValue: param.maxValue,
                optimalValue: param.optimalValue,
                isActive: param.isActive ?? true,
                sortOrder: param.sortOrder ?? 0,
              },
            });
          } else {
            // Utwórz nowy
            await tx.processParameter.create({
              data: {
                processId: id,
                parameterName: param.parameterName,
                unit: param.unit,
                minValue: param.minValue,
                maxValue: param.maxValue,
                optimalValue: param.optimalValue,
                isActive: param.isActive ?? true,
                sortOrder: param.sortOrder ?? 0,
              },
            });
          }
        }
      }

      return updated;
    });

    // Pobierz zaktualizowany proces z parametrami
    const result = await prisma.process.findUnique({
      where: { id },
      include: {
        parameters: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE',
        entityType: 'PROCESS',
        entityId: id,
        details: { updatedFields: Object.keys(validation.data) },
      },
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /:id/clone - Klonowanie procesu z parametrami
// ============================================================

export const cloneProcess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Nazwa nowego procesu jest wymagana (min. 2 znaki)' });
      return;
    }

    const original = await prisma.process.findUnique({
      where: { id },
      include: { parameters: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!original) {
      res.status(404).json({ error: 'Proces źródłowy nie został znaleziony' });
      return;
    }

    const cloned = await prisma.process.create({
      data: {
        name: name.trim(),
        description: original.description ? `Kopia: ${original.description}` : `Kopia procesu "${original.name}"`,
        processType: original.processType,
        clientId: original.clientId,
        parameters: {
          create: original.parameters.map((p) => ({
            parameterName: p.parameterName,
            unit: p.unit,
            minValue: p.minValue,
            maxValue: p.maxValue,
            optimalValue: p.optimalValue,
            isActive: p.isActive,
            sortOrder: p.sortOrder,
          })),
        },
      },
      include: {
        parameters: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CLONE',
        entityType: 'PROCESS',
        entityId: cloned.id,
        details: { sourceProcessId: id, sourceName: original.name, newName: name },
      },
    });

    res.status(201).json(cloned);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DELETE /:id - Soft-delete procesu
// ============================================================

export const deleteProcess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.process.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Proces nie został znaleziony' });
      return;
    }

    const process = await prisma.process.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE',
        entityType: 'PROCESS',
        entityId: id,
        details: { name: process.name, softDelete: true },
      },
    });

    res.json({ message: 'Proces został dezaktywowany', process });
  } catch (error) {
    next(error);
  }
};
