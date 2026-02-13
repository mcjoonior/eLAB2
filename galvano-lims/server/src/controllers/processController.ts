import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
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
  processType: z.string().min(1, 'Typ procesu jest wymagany'),
  clientId: z.string().uuid().optional().nullable(),
  parameters: z.array(processParameterSchema).optional().default([]),
});

const updateProcessSchema = createProcessSchema.partial();
const createProcessTypeSchema = z.object({
  code: z.string().min(2, 'Kod typu jest wymagany').max(40, 'Kod typu może mieć maksymalnie 40 znaków'),
  name: z.string().min(2, 'Nazwa typu jest wymagana').max(80, 'Nazwa typu może mieć maksymalnie 80 znaków'),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});
const updateProcessTypeSchema = createProcessTypeSchema.partial();

const DEFAULT_PROCESS_TYPES: Array<{ code: string; name: string; sortOrder: number }> = [
  { code: 'ZINC', name: 'Cynkowanie', sortOrder: 1 },
  { code: 'NICKEL', name: 'Niklowanie', sortOrder: 2 },
  { code: 'CHROME', name: 'Chromowanie', sortOrder: 3 },
  { code: 'COPPER', name: 'Miedziowanie', sortOrder: 4 },
  { code: 'TIN', name: 'Cynowanie', sortOrder: 5 },
  { code: 'GOLD', name: 'Złocenie', sortOrder: 6 },
  { code: 'SILVER', name: 'Srebrzenie', sortOrder: 7 },
  { code: 'ANODIZING', name: 'Anodowanie', sortOrder: 8 },
  { code: 'PASSIVATION', name: 'Pasywacja', sortOrder: 9 },
  { code: 'OTHER', name: 'Inne', sortOrder: 10 },
];

function normalizeTypeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

async function ensureDefaultProcessTypes() {
  const count = await prisma.processTypeDefinition.count();
  if (count > 0) return;

  await prisma.processTypeDefinition.createMany({
    data: DEFAULT_PROCESS_TYPES.map((t) => ({
      code: t.code,
      name: t.name,
      isActive: true,
      sortOrder: t.sortOrder,
    })),
    skipDuplicates: true,
  });
}

// ============================================================
// GET / - Lista procesów z filtrami
// ============================================================

export const getProcesses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await ensureDefaultProcessTypes();

    const {
      processType,
      isActive,
      search,
      clientId,
      page = '1',
      limit = '25',
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query as Record<string, string | undefined>;

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
// GET /types - Lista typów procesów
// ============================================================

export const getProcessTypes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await ensureDefaultProcessTypes();
    const { all } = req.query as Record<string, string | undefined>;
    const where = all === 'true' ? {} : { isActive: true };

    const types = await prisma.processTypeDefinition.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    res.json(types);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /types - Dodanie typu procesu
// ============================================================

export const createProcessType = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createProcessTypeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;
    const code = normalizeTypeCode(data.code);

    const duplicate = await prisma.processTypeDefinition.findFirst({
      where: {
        OR: [
          { code: { equals: code, mode: 'insensitive' } },
          { name: { equals: data.name.trim(), mode: 'insensitive' } },
        ],
      },
    });
    if (duplicate) {
      res.status(409).json({ error: 'Typ procesu o podanym kodzie lub nazwie już istnieje.' });
      return;
    }

    const created = await prisma.processTypeDefinition.create({
      data: {
        code,
        name: data.name.trim(),
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'SETTINGS',
        entityId: created.id,
        details: { module: 'process-types', code: created.code, name: created.name },
      },
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PUT /types/:id - Edycja typu procesu
// ============================================================

export const updateProcessType = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validation = updateProcessTypeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.processTypeDefinition.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Typ procesu nie został znaleziony.' });
      return;
    }

    const input = validation.data;
    const nextCode = input.code ? normalizeTypeCode(input.code) : existing.code;
    const nextName = input.name ? input.name.trim() : existing.name;

    const duplicate = await prisma.processTypeDefinition.findFirst({
      where: {
        id: { not: id },
        OR: [
          { code: { equals: nextCode, mode: 'insensitive' } },
          { name: { equals: nextName, mode: 'insensitive' } },
        ],
      },
    });
    if (duplicate) {
      res.status(409).json({ error: 'Typ procesu o podanym kodzie lub nazwie już istnieje.' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (nextCode !== existing.code) {
        await tx.process.updateMany({
          where: { processType: existing.code },
          data: { processType: nextCode },
        });
      }

      return tx.processTypeDefinition.update({
        where: { id },
        data: {
          code: nextCode,
          name: nextName,
          isActive: input.isActive ?? existing.isActive,
          sortOrder: input.sortOrder ?? existing.sortOrder,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'SETTINGS',
        entityId: updated.id,
        details: { module: 'process-types', previousCode: existing.code, code: updated.code, name: updated.name },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DELETE /types/:id - Usunięcie typu procesu
// ============================================================

export const deleteProcessType = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.processTypeDefinition.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Typ procesu nie został znaleziony.' });
      return;
    }

    const usedCount = await prisma.process.count({
      where: { processType: existing.code },
    });
    if (usedCount > 0) {
      res.status(409).json({
        error: `Nie można usunąć typu procesu, bo jest używany w ${usedCount} procesach.`,
      });
      return;
    }

    await prisma.processTypeDefinition.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE',
        entityType: 'SETTINGS',
        entityId: id,
        details: { module: 'process-types', code: existing.code, name: existing.name },
      },
    });

    res.json({ message: 'Typ procesu został usunięty.' });
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
    await ensureDefaultProcessTypes();

    const validation = createProcessSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { parameters, ...processData } = validation.data;
    const processTypeCode = normalizeTypeCode(processData.processType);

    const processType = await prisma.processTypeDefinition.findFirst({
      where: { code: { equals: processTypeCode, mode: 'insensitive' }, isActive: true },
    });
    if (!processType) {
      res.status(400).json({ error: 'Wybrany typ procesu nie istnieje lub jest nieaktywny.' });
      return;
    }

    const process = await (prisma.process.create as any)({
      data: {
        ...processData,
        processType: processType.code,
        parameters: {
          create: parameters.map((p: any, index: number) => ({
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
        userId: req.user!.userId,
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
    await ensureDefaultProcessTypes();

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
    if (processData.processType) {
      const processTypeCode = normalizeTypeCode(processData.processType);
      const processType = await prisma.processTypeDefinition.findFirst({
        where: { code: { equals: processTypeCode, mode: 'insensitive' } },
      });
      if (!processType) {
        res.status(400).json({ error: 'Wybrany typ procesu nie istnieje.' });
        return;
      }
      processData.processType = processType.code;
    }

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
        userId: req.user!.userId,
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

    const original: any = await prisma.process.findUnique({
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
        userId: req.user!.userId,
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
        userId: req.user!.userId,
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
