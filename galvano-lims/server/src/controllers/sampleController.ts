import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';

// ============================================================
// Walidacja Zod
// ============================================================

const createSampleSchema = z.object({
  clientId: z.string().uuid('Nieprawidłowy identyfikator klienta'),
  processId: z.string().uuid('Nieprawidłowy identyfikator procesu'),
  collectedBy: z.string().uuid().optional().nullable(),
  collectedAt: z.string().optional().nullable(),
  sampleType: z.enum(['BATH', 'RINSE', 'WASTEWATER', 'RAW_MATERIAL', 'OTHER']).optional().default('BATH'),
  description: z.string().optional().nullable(),
});

const updateSampleSchema = z.object({
  clientId: z.string().uuid().optional(),
  processId: z.string().uuid().optional(),
  collectedBy: z.string().uuid().optional().nullable(),
  collectedAt: z.string().datetime().optional().nullable(),
  sampleType: z.enum(['BATH', 'RINSE', 'WASTEWATER', 'RAW_MATERIAL', 'OTHER']).optional(),
  description: z.string().optional().nullable(),
});

const changeStatusSchema = z.object({
  status: z.enum(['REGISTERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

// ============================================================
// GET /assignees - Lista aktywnych użytkowników do przypisań
// ============================================================

export const getAssignableUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Generowanie kodu próbki: PRB-YYYYMM-XXXX
// ============================================================

async function generateSampleCode(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `PRB-${yearMonth}-`;

  // Znajdź najwyższy numer w bieżącym miesiącu
  const lastSample = await prisma.sample.findFirst({
    where: {
      sampleCode: { startsWith: prefix },
    },
    orderBy: { sampleCode: 'desc' },
  });

  let nextNumber = 1;
  if (lastSample) {
    const lastNumber = parseInt(lastSample.sampleCode.replace(prefix, ''), 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

// ============================================================
// GET / - Lista próbek z filtrami
// ============================================================

export const getSamples = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      status,
      clientId,
      processId,
      sampleType,
      dateFrom,
      dateTo,
      search,
      page = '1',
      limit = '25',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.SampleWhereInput = {};

    if (status) {
      where.status = status as any;
    }
    if (clientId) {
      where.clientId = clientId as string;
    }
    if (processId) {
      where.processId = processId as string;
    }
    if (sampleType) {
      where.sampleType = sampleType as any;
    }

    // Filtry dat
    if (dateFrom || dateTo) {
      where.collectedAt = {};
      if (dateFrom) {
        where.collectedAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.collectedAt.lte = new Date(dateTo as string);
      }
    }

    // Wyszukiwanie
    if (search) {
      where.OR = [
        { sampleCode: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { client: { companyName: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const allowedSortFields = ['sampleCode', 'collectedAt', 'createdAt', 'status', 'sampleType'];
    const sortField = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      prisma.sample.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortField]: order },
        include: {
          client: { select: { id: true, companyName: true } },
          process: { select: { id: true, name: true, processType: true } },
          collector: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { analyses: true } },
        },
      }),
      prisma.sample.count({ where }),
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
// GET /:id - Szczegóły próbki z klientem, procesem i analizami
// ============================================================

export const getSampleById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const sample = await prisma.sample.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, companyName: true, contactPerson: true, email: true, phone: true },
        },
        process: {
          include: {
            parameters: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        collector: { select: { id: true, firstName: true, lastName: true } },
        analyses: {
          orderBy: { createdAt: 'desc' },
          include: {
            performer: { select: { id: true, firstName: true, lastName: true } },
            approver: { select: { id: true, firstName: true, lastName: true } },
            results: { orderBy: { parameterName: 'asc' } },
            recommendations: { orderBy: { priority: 'desc' } },
          },
        },
      },
    });

    if (!sample) {
      res.status(404).json({ error: 'Próbka nie została znaleziona' });
      return;
    }

    res.json(sample);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST / - Utworzenie próbki z automatycznym kodem
// ============================================================

export const createSample = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createSampleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    // Sprawdź czy klient istnieje
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      res.status(404).json({ error: 'Klient nie został znaleziony' });
      return;
    }

    // Sprawdź czy proces istnieje
    const process = await prisma.process.findUnique({ where: { id: data.processId } });
    if (!process) {
      res.status(404).json({ error: 'Proces nie został znaleziony' });
      return;
    }

    const assignedUserId = data.collectedBy ?? req.user!.userId;
    const assignedUser = await prisma.user.findFirst({
      where: { id: assignedUserId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!assignedUser) {
      res.status(404).json({ error: 'Przypisany użytkownik nie został znaleziony' });
      return;
    }

    const sampleCode = await generateSampleCode();

    const sample = await prisma.sample.create({
      data: {
        sampleCode,
        clientId: data.clientId,
        processId: data.processId,
        collectedBy: assignedUser.id,
        collectedAt: data.collectedAt ? new Date(data.collectedAt) : new Date(),
        sampleType: data.sampleType,
        description: data.description,
        status: 'REGISTERED',
      },
      include: {
        client: { select: { id: true, companyName: true } },
        process: { select: { id: true, name: true, processType: true } },
        collector: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (assignedUser.id !== req.user!.userId) {
      await prisma.notification.create({
        data: {
          userId: assignedUser.id,
          title: 'Nowe przypisanie próbki',
          message: `Przypisano Ci próbkę ${sample.sampleCode} dla klienta ${client.companyName}.`,
          type: 'info',
          link: `/samples/${sample.id}`,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'SAMPLE',
        entityId: sample.id,
        details: { sampleCode: sample.sampleCode, clientName: client.companyName },
      },
    });

    res.status(201).json(sample);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PUT /:id - Aktualizacja próbki
// ============================================================

export const updateSample = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const validation = updateSampleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.sample.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Próbka nie została znaleziona' });
      return;
    }

    const data = validation.data;
    const updateData: any = { ...data };
    if (data.collectedAt) {
      updateData.collectedAt = new Date(data.collectedAt);
    }

    const sample = await prisma.sample.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, companyName: true } },
        process: { select: { id: true, name: true, processType: true } },
        collector: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'SAMPLE',
        entityId: id,
        details: { updatedFields: Object.keys(data) },
      },
    });

    res.json(sample);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PATCH /:id/status - Zmiana statusu próbki (workflow)
// ============================================================

export const changeSampleStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const validation = changeStatusSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { status: newStatus } = validation.data;

    const sample = await prisma.sample.findUnique({ where: { id } });
    if (!sample) {
      res.status(404).json({ error: 'Próbka nie została znaleziona' });
      return;
    }

    // Walidacja workflow statusów
    const allowedTransitions: Record<string, string[]> = {
      REGISTERED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [], // status końcowy
      CANCELLED: [], // status końcowy
    };

    const allowed = allowedTransitions[sample.status] || [];
    if (!allowed.includes(newStatus)) {
      res.status(400).json({
        error: `Niedozwolona zmiana statusu z "${sample.status}" na "${newStatus}"`,
        allowedTransitions: allowed,
      });
      return;
    }

    const updated = await prisma.sample.update({
      where: { id },
      data: { status: newStatus },
      include: {
        client: { select: { id: true, companyName: true } },
        process: { select: { id: true, name: true, processType: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'STATUS_CHANGE',
        entityType: 'SAMPLE',
        entityId: id,
        details: {
          sampleCode: sample.sampleCode,
          previousStatus: sample.status,
          newStatus,
        },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};
