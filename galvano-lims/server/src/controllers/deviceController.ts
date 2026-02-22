import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';

const createDeviceSchema = z.object({
  code: z.string().min(2, 'Kod urządzenia jest wymagany').max(40),
  name: z.string().min(2, 'Nazwa urządzenia jest wymagana').max(120),
  deviceType: z.string().min(2, 'Typ urządzenia jest wymagany').max(80),
  manufacturer: z.string().max(120).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  serialNumber: z.string().max(120).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_SERVICE', 'RETIRED']).optional().default('ACTIVE'),
  requiresCalibration: z.boolean().optional().default(true),
  requiresInspection: z.boolean().optional().default(false),
  calibrationIntervalDays: z.number().int().positive().max(3650).optional().nullable(),
  inspectionIntervalDays: z.number().int().positive().max(3650).optional().nullable(),
  lastCalibrationAt: z.string().datetime().optional().nullable(),
  lastInspectionAt: z.string().datetime().optional().nullable(),
  responsibleUserId: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const updateDeviceSchema = createDeviceSchema.partial();

const createMaintenanceLogSchema = z.object({
  maintenanceType: z.enum(['CALIBRATION', 'INSPECTION', 'SERVICE']),
  performedAt: z.string().datetime().optional(),
  result: z.enum(['PASSED', 'FAILED', 'CONDITIONAL']).optional().default('PASSED'),
  certificateNumber: z.string().max(120).optional().nullable(),
  certificatePath: z.string().max(300).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  performedBy: z.string().uuid().optional().nullable(),
  nextDueAt: z.string().datetime().optional().nullable(),
});

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '-');
}

function toDate(value?: string | null): Date | null {
  return value ? new Date(value) : null;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export const getDevices = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      status,
      search,
      overdueOnly,
      dueWithinDays,
      page = '1',
      limit = '25',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.LabDeviceWhereInput = {};
    const andConditions: Prisma.LabDeviceWhereInput[] = [];

    if (status) {
      where.status = status as any;
    }

    if (search) {
      andConditions.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
          { manufacturer: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const now = new Date();
    const dueLimit = dueWithinDays ? addDays(now, Math.max(0, parseInt(dueWithinDays, 10) || 0)) : null;

    if (overdueOnly === 'true') {
      andConditions.push({
        OR: [
          { requiresCalibration: true, nextCalibrationAt: { lt: now } },
          { requiresInspection: true, nextInspectionAt: { lt: now } },
        ],
      });
    } else if (dueLimit) {
      andConditions.push({
        OR: [
          {
            requiresCalibration: true,
            nextCalibrationAt: { gte: now, lte: dueLimit },
          },
          {
            requiresInspection: true,
            nextInspectionAt: { gte: now, lte: dueLimit },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const allowedSortFields = ['code', 'name', 'status', 'nextCalibrationAt', 'nextInspectionAt', 'createdAt'];
    const resolvedSortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const resolvedSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      prisma.labDevice.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [resolvedSortField]: resolvedSortOrder },
        include: {
          responsibleUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          _count: {
            select: { maintenanceLogs: true },
          },
        },
      }),
      prisma.labDevice.count({ where }),
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

export const getDeviceById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const device = await prisma.labDevice.findUnique({
      where: { id },
      include: {
        responsibleUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        maintenanceLogs: {
          orderBy: { performedAt: 'desc' },
          include: {
            performer: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!device) {
      res.status(404).json({ error: 'Urządzenie nie zostało znalezione' });
      return;
    }

    res.json(device);
  } catch (error) {
    next(error);
  }
};

export const createDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createDeviceSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    if (data.responsibleUserId) {
      const user = await prisma.user.findFirst({ where: { id: data.responsibleUserId, isActive: true } });
      if (!user) {
        res.status(404).json({ error: 'Odpowiedzialny użytkownik nie został znaleziony' });
        return;
      }
    }

    const code = normalizeCode(data.code);
    const existing = await prisma.labDevice.findFirst({
      where: {
        OR: [
          { code: { equals: code, mode: 'insensitive' } },
          ...(data.serialNumber ? [{ serialNumber: { equals: data.serialNumber.trim(), mode: 'insensitive' as const } }] : []),
        ],
      },
    });

    if (existing) {
      res.status(409).json({ error: 'Urządzenie o podanym kodzie lub numerze seryjnym już istnieje' });
      return;
    }

    const created = await prisma.labDevice.create({
      data: {
        code,
        name: data.name.trim(),
        deviceType: data.deviceType.trim(),
        manufacturer: data.manufacturer?.trim() ?? null,
        model: data.model?.trim() ?? null,
        serialNumber: data.serialNumber?.trim() ?? null,
        location: data.location?.trim() ?? null,
        status: data.status,
        requiresCalibration: data.requiresCalibration,
        requiresInspection: data.requiresInspection,
        calibrationIntervalDays: data.calibrationIntervalDays ?? null,
        inspectionIntervalDays: data.inspectionIntervalDays ?? null,
        lastCalibrationAt: toDate(data.lastCalibrationAt),
        lastInspectionAt: toDate(data.lastInspectionAt),
        nextCalibrationAt:
          data.requiresCalibration && data.lastCalibrationAt && data.calibrationIntervalDays
            ? addDays(new Date(data.lastCalibrationAt), data.calibrationIntervalDays)
            : null,
        nextInspectionAt:
          data.requiresInspection && data.lastInspectionAt && data.inspectionIntervalDays
            ? addDays(new Date(data.lastInspectionAt), data.inspectionIntervalDays)
            : null,
        responsibleUserId: data.responsibleUserId ?? null,
        notes: data.notes?.trim() ?? null,
      },
      include: {
        responsibleUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'LAB_DEVICE',
        entityId: created.id,
        details: { code: created.code, name: created.name },
      },
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

export const updateDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validation = updateDeviceSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.labDevice.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Urządzenie nie zostało znalezione' });
      return;
    }

    const data = validation.data;

    if (data.responsibleUserId) {
      const user = await prisma.user.findFirst({ where: { id: data.responsibleUserId, isActive: true } });
      if (!user) {
        res.status(404).json({ error: 'Odpowiedzialny użytkownik nie został znaleziony' });
        return;
      }
    }

    const nextCode = data.code ? normalizeCode(data.code) : existing.code;
    const nextSerial = data.serialNumber !== undefined ? (data.serialNumber?.trim() ?? null) : existing.serialNumber;

    const duplicate = await prisma.labDevice.findFirst({
      where: {
        id: { not: id },
        OR: [
          { code: { equals: nextCode, mode: 'insensitive' } },
          ...(nextSerial ? [{ serialNumber: { equals: nextSerial, mode: 'insensitive' as const } }] : []),
        ],
      },
    });

    if (duplicate) {
      res.status(409).json({ error: 'Urządzenie o podanym kodzie lub numerze seryjnym już istnieje' });
      return;
    }

    const nextLastCalibrationAt = data.lastCalibrationAt !== undefined ? toDate(data.lastCalibrationAt) : existing.lastCalibrationAt;
    const nextLastInspectionAt = data.lastInspectionAt !== undefined ? toDate(data.lastInspectionAt) : existing.lastInspectionAt;
    const nextCalibrationInterval = data.calibrationIntervalDays !== undefined ? data.calibrationIntervalDays : existing.calibrationIntervalDays;
    const nextInspectionInterval = data.inspectionIntervalDays !== undefined ? data.inspectionIntervalDays : existing.inspectionIntervalDays;
    const nextRequiresCalibration = data.requiresCalibration !== undefined ? data.requiresCalibration : existing.requiresCalibration;
    const nextRequiresInspection = data.requiresInspection !== undefined ? data.requiresInspection : existing.requiresInspection;

    const updated = await prisma.labDevice.update({
      where: { id },
      data: {
        code: nextCode,
        name: data.name?.trim(),
        deviceType: data.deviceType?.trim(),
        manufacturer: data.manufacturer !== undefined ? (data.manufacturer?.trim() ?? null) : undefined,
        model: data.model !== undefined ? (data.model?.trim() ?? null) : undefined,
        serialNumber: data.serialNumber !== undefined ? (data.serialNumber?.trim() ?? null) : undefined,
        location: data.location !== undefined ? (data.location?.trim() ?? null) : undefined,
        status: data.status,
        requiresCalibration: nextRequiresCalibration,
        requiresInspection: nextRequiresInspection,
        calibrationIntervalDays: nextCalibrationInterval,
        inspectionIntervalDays: nextInspectionInterval,
        lastCalibrationAt: nextLastCalibrationAt,
        lastInspectionAt: nextLastInspectionAt,
        nextCalibrationAt:
          nextRequiresCalibration && nextLastCalibrationAt && nextCalibrationInterval
            ? addDays(nextLastCalibrationAt, nextCalibrationInterval)
            : null,
        nextInspectionAt:
          nextRequiresInspection && nextLastInspectionAt && nextInspectionInterval
            ? addDays(nextLastInspectionAt, nextInspectionInterval)
            : null,
        responsibleUserId: data.responsibleUserId !== undefined ? data.responsibleUserId : undefined,
        notes: data.notes !== undefined ? (data.notes?.trim() ?? null) : undefined,
      },
      include: {
        responsibleUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'LAB_DEVICE',
        entityId: updated.id,
        details: { code: updated.code, name: updated.name },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const createDeviceMaintenanceLog = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id: deviceId } = req.params;
    const validation = createMaintenanceLogSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const device = await prisma.labDevice.findUnique({ where: { id: deviceId } });
    if (!device) {
      res.status(404).json({ error: 'Urządzenie nie zostało znalezione' });
      return;
    }

    const data = validation.data;

    if (data.performedBy) {
      const user = await prisma.user.findFirst({ where: { id: data.performedBy, isActive: true } });
      if (!user) {
        res.status(404).json({ error: 'Wykonawca przeglądu/kalibracji nie został znaleziony' });
        return;
      }
    }

    const performedAt = data.performedAt ? new Date(data.performedAt) : new Date();
    let computedNextDue = data.nextDueAt ? new Date(data.nextDueAt) : null;

    if (!computedNextDue && data.maintenanceType === 'CALIBRATION' && device.calibrationIntervalDays) {
      computedNextDue = addDays(performedAt, device.calibrationIntervalDays);
    }
    if (!computedNextDue && data.maintenanceType === 'INSPECTION' && device.inspectionIntervalDays) {
      computedNextDue = addDays(performedAt, device.inspectionIntervalDays);
    }

    const result = await prisma.$transaction(async (tx) => {
      const log = await tx.deviceMaintenanceLog.create({
        data: {
          deviceId,
          maintenanceType: data.maintenanceType,
          performedAt,
          result: data.result,
          certificateNumber: data.certificateNumber?.trim() ?? null,
          certificatePath: data.certificatePath?.trim() ?? null,
          notes: data.notes?.trim() ?? null,
          performedBy: data.performedBy ?? req.user!.userId,
          nextDueAt: computedNextDue,
        },
        include: {
          performer: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      if (data.maintenanceType === 'CALIBRATION') {
        await tx.labDevice.update({
          where: { id: deviceId },
          data: {
            lastCalibrationAt: performedAt,
            nextCalibrationAt: computedNextDue,
          },
        });
      }

      if (data.maintenanceType === 'INSPECTION') {
        await tx.labDevice.update({
          where: { id: deviceId },
          data: {
            lastInspectionAt: performedAt,
            nextInspectionAt: computedNextDue,
          },
        });
      }

      return log;
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'DEVICE_MAINTENANCE_LOG',
        entityId: result.id,
        details: { deviceId, maintenanceType: result.maintenanceType, result: result.result },
      },
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getUpcomingMaintenance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { days = '30' } = req.query as Record<string, string | undefined>;
    const windowDays = Math.max(1, Math.min(365, parseInt(days, 10) || 30));

    const now = new Date();
    const limitDate = addDays(now, windowDays);

    const devices = await prisma.labDevice.findMany({
      where: {
        status: { in: ['ACTIVE', 'OUT_OF_SERVICE'] },
        OR: [
          {
            requiresCalibration: true,
            nextCalibrationAt: { lte: limitDate },
          },
          {
            requiresInspection: true,
            nextInspectionAt: { lte: limitDate },
          },
        ],
      },
      orderBy: [{ nextCalibrationAt: 'asc' }, { nextInspectionAt: 'asc' }],
      include: {
        responsibleUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    res.json({
      windowDays,
      count: devices.length,
      data: devices,
    });
  } catch (error) {
    next(error);
  }
};
