import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { lookupCompanyByNipInGus } from '../services/gusService';

// ============================================================
// Walidacja Zod
// ============================================================

const createClientSchema = z.object({
  companyName: z.string().min(2, 'Nazwa firmy musi mieć co najmniej 2 znaki'),
  nip: z.string().length(10, 'NIP musi mieć dokładnie 10 cyfr').regex(/^\d+$/, 'NIP może zawierać wyłącznie cyfry').optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().default('Polska'),
  contactPerson: z.string().optional().nullable(),
  email: z.string().min(1, 'Adres e-mail jest wymagany').email('Nieprawidłowy adres e-mail'),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateClientSchema = createClientSchema.partial();
const lookupGusSchema = z.object({
  nip: z.string().length(10, 'NIP musi mieć dokładnie 10 cyfr').regex(/^\d+$/, 'NIP może zawierać wyłącznie cyfry'),
});

function isValidNipChecksum(nip: string): boolean {
  if (!/^\d{10}$/.test(nip)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(nip[i]), 0);
  const checksum = sum % 11;
  return checksum !== 10 && checksum === Number(nip[9]);
}

// ============================================================
// GET / - Lista klientów z wyszukiwaniem, paginacją, sortowaniem
// ============================================================

export const getClients = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      search,
      companyName,
      nip,
      isActive,
      page = '1',
      limit = '25',
      sortBy = 'companyName',
      sortOrder = 'asc',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ClientWhereInput = {};

    // Filtr aktywności (domyślnie tylko aktywni)
    if (isActive === 'all') {
      // no activity filter
    } else if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    } else {
      where.isActive = true;
    }

    // Wyszukiwanie ogólne
    if (search) {
      where.OR = [
        { companyName: { contains: search as string, mode: 'insensitive' } },
        { nip: { contains: search as string, mode: 'insensitive' } },
        { contactPerson: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { city: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Filtry szczegółowe
    if (companyName) {
      where.companyName = { contains: companyName as string, mode: 'insensitive' };
    }
    if (nip) {
      where.nip = { contains: nip as string, mode: 'insensitive' };
    }

    // Sortowanie
    const allowedSortFields = ['companyName', 'city', 'createdAt', 'updatedAt', 'nip'];
    const sortField = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'companyName';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';

    const [data, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortField]: order },
        include: {
          _count: {
            select: { samples: true },
          },
        },
      }),
      prisma.client.count({ where }),
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
// GET /:id - Szczegóły klienta z historią próbek i analiz
// ============================================================

export const getClientById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        samples: {
          orderBy: { createdAt: 'desc' },
          include: {
            process: { select: { id: true, name: true, processType: true } },
            analyses: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                analysisCode: true,
                status: true,
                analysisDate: true,
                performedBy: true,
                performer: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        processes: {
          select: { id: true, name: true, processType: true, isActive: true },
        },
        _count: {
          select: { samples: true },
        },
      },
    });

    if (!client) {
      res.status(404).json({ error: 'Klient nie został znaleziony' });
      return;
    }

    res.json(client);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST / - Utworzenie nowego klienta
// ============================================================

export const createClient = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createClientSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    // Sprawdź unikalność NIP
    if (data.nip) {
      const existing = await prisma.client.findUnique({ where: { nip: data.nip } });
      if (existing) {
        res.status(409).json({ error: 'Klient z podanym NIP już istnieje w systemie' });
        return;
      }
    }

    const client = await prisma.client.create({
      data: {
        companyName: data.companyName,
        nip: data.nip,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country ?? 'Polska',
        contactPerson: data.contactPerson,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
      },
    });

    // Log audytu
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'CLIENT',
        entityId: client.id,
        details: { companyName: client.companyName },
      },
    });

    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /lookup-gus - Pobranie danych firmy z GUS po NIP
// ============================================================

export const lookupClientInGus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validation = lookupGusSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const nip = validation.data.nip;
    if (!isValidNipChecksum(nip)) {
      res.status(400).json({ error: 'Nieprawidłowy numer NIP (błędna suma kontrolna).' });
      return;
    }

    const found = await lookupCompanyByNipInGus(nip);
    if (!found) {
      res.status(404).json({ error: 'Nie znaleziono podmiotu w bazie GUS dla podanego NIP.' });
      return;
    }

    res.json({
      source: 'GUS',
      data: {
        companyName: found.data.companyName,
        nip: found.data.nip,
        address: found.data.address || '',
        city: found.data.city || '',
        postalCode: found.data.postalCode || '',
        country: found.data.country || 'Polska',
      },
      meta: {
        regon: found.data.regon,
        krs: found.data.krs,
        type: found.data.type,
        silosId: found.data.silosId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PUT /:id - Aktualizacja klienta
// ============================================================

export const updateClient = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const validation = updateClientSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Błąd walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Klient nie został znaleziony' });
      return;
    }

    const data = validation.data;

    // Sprawdź unikalność NIP (jeśli zmieniony)
    if (data.nip && data.nip !== existing.nip) {
      const duplicate = await prisma.client.findUnique({ where: { nip: data.nip } });
      if (duplicate) {
        res.status(409).json({ error: 'Klient z podanym NIP już istnieje w systemie' });
        return;
      }
    }

    const client = await prisma.client.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'CLIENT',
        entityId: client.id,
        details: { updatedFields: Object.keys(data) },
      },
    });

    res.json(client);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DELETE /:id - Soft-delete klienta (isActive = false)
// ============================================================

export const deleteClient = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Klient nie został znaleziony' });
      return;
    }

    const client = await prisma.client.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE',
        entityType: 'CLIENT',
        entityId: client.id,
        details: { companyName: client.companyName, softDelete: true },
      },
    });

    res.json({ message: 'Klient został dezaktywowany', client });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DELETE /:id/permanent - Trwale usuwa klienta (tylko ADMIN)
// ============================================================

export const permanentlyDeleteClient = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.client.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            samples: true,
            processes: true,
          },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Klient nie został znaleziony' });
      return;
    }

    if (existing._count.samples > 0 || existing._count.processes > 0) {
      res.status(409).json({
        error: 'Nie można trwale usunąć klienta z powiązanymi próbkami lub procesami',
      });
      return;
    }

    const deleted = await prisma.client.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE',
        entityType: 'CLIENT',
        entityId: deleted.id,
        details: { companyName: deleted.companyName, softDelete: false, permanentDelete: true },
      },
    });

    res.json({ message: 'Klient został trwale usunięty' });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /export/csv - Eksport listy klientów do CSV
// ============================================================

export const exportClientsCsv = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { isActive } = req.query as Record<string, string | undefined>;

    const where: Prisma.ClientWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    } else {
      where.isActive = true;
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { companyName: 'asc' },
      select: {
        companyName: true,
        nip: true,
        city: true,
        contactPerson: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Nazwa firmy',
      'NIP',
      'Miasto',
      'Osoba kontaktowa',
      'Email',
      'Telefon',
      'Aktywny',
      'Utworzono',
    ].join(';');

    const rows = clients.map((client) => [
      escape(client.companyName),
      escape(client.nip),
      escape(client.city),
      escape(client.contactPerson),
      escape(client.email),
      escape(client.phone),
      escape(client.isActive ? 'TAK' : 'NIE'),
      escape(client.createdAt.toISOString().split('T')[0]),
    ].join(';'));

    const csv = '\uFEFF' + [headers, ...rows].join('\n');
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="klienci_${date}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /:id/export - Eksport danych klienta do CSV
// ============================================================

export const exportClientData = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        samples: {
          include: {
            process: { select: { name: true, processType: true } },
            analyses: {
              include: {
                results: true,
                performer: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!client) {
      res.status(404).json({ error: 'Klient nie został znaleziony' });
      return;
    }

    // Buduj CSV
    const csvHeaders = [
      'Kod próbki',
      'Data pobrania',
      'Typ próbki',
      'Proces',
      'Typ procesu',
      'Status próbki',
      'Kod analizy',
      'Data analizy',
      'Status analizy',
      'Wykonał',
      'Parametr',
      'Wartość',
      'Jednostka',
      'Min',
      'Max',
      'Optymalnie',
      'Odchylenie',
      'Odchylenie %',
    ].join(';');

    const csvRows: string[] = [csvHeaders];

    for (const sample of client.samples) {
      if (sample.analyses.length === 0) {
        csvRows.push([
          sample.sampleCode,
          sample.collectedAt.toISOString().split('T')[0],
          sample.sampleType,
          sample.process.name,
          sample.process.processType,
          sample.status,
          '', '', '', '', '', '', '', '', '', '', '',
        ].join(';'));
      }

      for (const analysis of sample.analyses) {
        if (analysis.results.length === 0) {
          csvRows.push([
            sample.sampleCode,
            sample.collectedAt.toISOString().split('T')[0],
            sample.sampleType,
            sample.process.name,
            sample.process.processType,
            sample.status,
            analysis.analysisCode,
            analysis.analysisDate.toISOString().split('T')[0],
            analysis.status,
            `${analysis.performer.firstName} ${analysis.performer.lastName}`,
            '', '', '', '', '', '', '',
          ].join(';'));
        }

        for (const result of analysis.results) {
          csvRows.push([
            sample.sampleCode,
            sample.collectedAt.toISOString().split('T')[0],
            sample.sampleType,
            sample.process.name,
            sample.process.processType,
            sample.status,
            analysis.analysisCode,
            analysis.analysisDate.toISOString().split('T')[0],
            analysis.status,
            `${analysis.performer.firstName} ${analysis.performer.lastName}`,
            result.parameterName,
            result.value.toString(),
            result.unit,
            result.minReference?.toString() ?? '',
            result.maxReference?.toString() ?? '',
            result.optimalReference?.toString() ?? '',
            result.deviation,
            result.deviationPercent?.toString() ?? '',
          ].join(';'));
        }
      }
    }

    const csv = '\uFEFF' + csvRows.join('\n'); // BOM dla polskich znaków

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="klient_${client.companyName.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
