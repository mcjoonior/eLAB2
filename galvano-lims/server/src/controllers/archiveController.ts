import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';

// ============================================================
// GET /analyses - Archiwum analiz z zaawansowanymi filtrami
// ============================================================

export const getArchivedAnalyses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      status,
      clientId,
      processId,
      processType,
      sampleType,
      performedBy,
      dateFrom,
      dateTo,
      deviation,
      parameterName,
      search,
      page = '1',
      limit = '25',
      sortBy = 'analysisDate',
      sortOrder = 'desc',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.AnalysisWhereInput = {};

    if (status) {
      where.status = status as any;
    } else {
      // Domyslnie archiwum: zakonczone i zatwierdzone
      where.status = { in: ['COMPLETED', 'APPROVED'] };
    }

    if (dateFrom || dateTo) {
      where.analysisDate = {};
      if (dateFrom) {
        where.analysisDate.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.analysisDate.lte = new Date(dateTo as string);
      }
    }

    if (performedBy) {
      where.performedBy = performedBy as string;
    }

    // Filtry probki
    const sampleWhere: Prisma.SampleWhereInput = {};
    if (clientId) {
      sampleWhere.clientId = clientId as string;
    }
    if (processId) {
      sampleWhere.processId = processId as string;
    }
    if (sampleType) {
      sampleWhere.sampleType = sampleType as any;
    }
    if (processType) {
      sampleWhere.process = { processType: processType as any };
    }

    if (Object.keys(sampleWhere).length > 0) {
      where.sample = sampleWhere;
    }

    // Filtr odchylen
    if (deviation) {
      where.results = {
        some: {
          deviation: deviation as any,
        },
      };
    }

    // Filtr parametru
    if (parameterName) {
      where.results = {
        ...((where.results as any) || {}),
        some: {
          ...((where.results as any)?.some || {}),
          parameterName: { contains: parameterName as string, mode: 'insensitive' },
        },
      };
    }

    // Wyszukiwanie
    if (search) {
      where.OR = [
        { analysisCode: { contains: search as string, mode: 'insensitive' } },
        { notes: { contains: search as string, mode: 'insensitive' } },
        { sample: { sampleCode: { contains: search as string, mode: 'insensitive' } } },
        { sample: { client: { companyName: { contains: search as string, mode: 'insensitive' } } } },
      ];
    }

    const allowedSortFields = ['analysisCode', 'analysisDate', 'createdAt', 'status'];
    const sortField = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'analysisDate';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      prisma.analysis.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortField]: order },
        include: {
          sample: {
            select: {
              id: true,
              sampleCode: true,
              sampleType: true,
              collectedAt: true,
              client: { select: { id: true, companyName: true } },
              process: { select: { id: true, name: true, processType: true } },
            },
          },
          performer: { select: { id: true, firstName: true, lastName: true } },
          approver: { select: { id: true, firstName: true, lastName: true } },
          results: {
            orderBy: { createdAt: 'asc' },
          },
          _count: { select: { results: true, recommendations: true, reports: true } },
        },
      }),
      prisma.analysis.count({ where }),
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
// GET /trend - Dane trendow do wykresow
// ============================================================

export const getTrendData = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      parameterName,
      processId,
      clientId,
      dateFrom,
      dateTo,
      limit = '100',
    } = req.query as Record<string, string | undefined>;

    if (!parameterName) {
      res.status(400).json({ error: 'Parametr "parameterName" jest wymagany' });
      return;
    }

    const limitNum = Math.min(500, Math.max(1, parseInt(limit as string, 10) || 100));

    const where: Prisma.AnalysisResultWhereInput = {
      parameterName: { equals: parameterName as string, mode: 'insensitive' },
      analysis: {
        status: { in: ['COMPLETED', 'APPROVED'] },
      },
    };

    // Filtry dat
    if (dateFrom || dateTo) {
      where.analysis = {
        ...(where.analysis as any),
        analysisDate: {},
      };
      if (dateFrom) {
        (where.analysis as any).analysisDate.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        (where.analysis as any).analysisDate.lte = new Date(dateTo as string);
      }
    }

    // Filtry procesu i klienta
    if (processId || clientId) {
      where.analysis = {
        ...(where.analysis as any),
        sample: {
          ...(processId ? { processId: processId as string } : {}),
          ...(clientId ? { clientId: clientId as string } : {}),
        },
      };
    }

    const results = await prisma.analysisResult.findMany({
      where,
      take: limitNum,
      orderBy: {
        analysis: { analysisDate: 'asc' },
      },
      select: {
        id: true,
        value: true,
        unit: true,
        minReference: true,
        maxReference: true,
        optimalReference: true,
        deviation: true,
        deviationPercent: true,
        analysis: {
          select: {
            id: true,
            analysisCode: true,
            analysisDate: true,
            sample: {
              select: {
                sampleCode: true,
                client: { select: { companyName: true } },
                process: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Oblicz statystyki
    const values = results.map((r) => Number(r.value));
    const stats = values.length > 0
      ? {
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((s, v) => s + v, 0) / values.length,
          median: (() => {
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
          })(),
        }
      : null;

    res.json({
      parameterName: parameterName as string,
      dataPoints: results,
      statistics: stats,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /export/csv - Eksport analiz do CSV
// ============================================================

export const exportAnalysesCsv = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      status,
      clientId,
      processId,
      dateFrom,
      dateTo,
    } = req.query as Record<string, string | undefined>;

    const where: Prisma.AnalysisWhereInput = {};

    if (status) {
      where.status = status as any;
    } else {
      where.status = { in: ['COMPLETED', 'APPROVED'] };
    }

    if (dateFrom || dateTo) {
      where.analysisDate = {};
      if (dateFrom) {
        where.analysisDate.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.analysisDate.lte = new Date(dateTo as string);
      }
    }

    if (clientId) {
      where.sample = { clientId: clientId as string };
    }
    if (processId) {
      where.sample = { ...(where.sample as any), processId: processId as string };
    }

    const analyses = await prisma.analysis.findMany({
      where,
      orderBy: { analysisDate: 'desc' },
      take: 5000, // Limit do 5000 rekordow
      include: {
        sample: {
          include: {
            client: { select: { companyName: true } },
            process: { select: { name: true, processType: true } },
          },
        },
        performer: { select: { firstName: true, lastName: true } },
        approver: { select: { firstName: true, lastName: true } },
        results: { orderBy: { createdAt: 'asc' } },
      },
    });

    // Buduj CSV
    const csvHeaders = [
      'Kod analizy',
      'Data analizy',
      'Status',
      'Kod probki',
      'Typ probki',
      'Klient',
      'Proces',
      'Typ procesu',
      'Wykonal',
      'Zatwierdzil',
      'Parametr',
      'Wartosc',
      'Jednostka',
      'Min',
      'Max',
      'Optymalnie',
      'Odchylenie',
      'Odchylenie %',
      'Uwagi',
    ].join(';');

    const csvRows: string[] = [csvHeaders];

    for (const analysis of analyses) {
      if (analysis.results.length === 0) {
        csvRows.push([
          analysis.analysisCode,
          analysis.analysisDate.toISOString().split('T')[0],
          analysis.status,
          analysis.sample.sampleCode,
          analysis.sample.sampleType,
          analysis.sample.client.companyName,
          analysis.sample.process.name,
          analysis.sample.process.processType,
          `${analysis.performer.firstName} ${analysis.performer.lastName}`,
          analysis.approver ? `${analysis.approver.firstName} ${analysis.approver.lastName}` : '',
          '', '', '', '', '', '', '', '',
          analysis.notes ?? '',
        ].join(';'));
      }

      for (const result of analysis.results) {
        csvRows.push([
          analysis.analysisCode,
          analysis.analysisDate.toISOString().split('T')[0],
          analysis.status,
          analysis.sample.sampleCode,
          analysis.sample.sampleType,
          analysis.sample.client.companyName,
          analysis.sample.process.name,
          analysis.sample.process.processType,
          `${analysis.performer.firstName} ${analysis.performer.lastName}`,
          analysis.approver ? `${analysis.approver.firstName} ${analysis.approver.lastName}` : '',
          result.parameterName,
          result.value.toString(),
          result.unit,
          result.minReference?.toString() ?? '',
          result.maxReference?.toString() ?? '',
          result.optimalReference?.toString() ?? '',
          result.deviation,
          result.deviationPercent?.toString() ?? '',
          analysis.notes ?? '',
        ].join(';'));
      }
    }

    const csv = '\uFEFF' + csvRows.join('\n'); // BOM dla polskich znakow

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="archiwum_analiz_${new Date().toISOString().split('T')[0]}.csv"`
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /deviations - Statystyki odchylen
// ============================================================

export const getDeviationStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      processId,
      clientId,
      dateFrom,
      dateTo,
    } = req.query as Record<string, string | undefined>;

    const where: Prisma.AnalysisResultWhereInput = {
      analysis: {
        status: { in: ['COMPLETED', 'APPROVED'] },
      },
    };

    if (dateFrom || dateTo) {
      where.analysis = {
        ...(where.analysis as any),
        analysisDate: {},
      };
      if (dateFrom) {
        (where.analysis as any).analysisDate.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        (where.analysis as any).analysisDate.lte = new Date(dateTo as string);
      }
    }

    if (processId || clientId) {
      where.analysis = {
        ...(where.analysis as any),
        sample: {
          ...(processId ? { processId: processId as string } : {}),
          ...(clientId ? { clientId: clientId as string } : {}),
        },
      };
    }

    // Grupuj po typie odchylenia
    const [
      withinRange,
      belowMin,
      aboveMax,
      criticalLow,
      criticalHigh,
      total,
    ] = await Promise.all([
      prisma.analysisResult.count({ where: { ...where, deviation: 'WITHIN_RANGE' } }),
      prisma.analysisResult.count({ where: { ...where, deviation: 'BELOW_MIN' } }),
      prisma.analysisResult.count({ where: { ...where, deviation: 'ABOVE_MAX' } }),
      prisma.analysisResult.count({ where: { ...where, deviation: 'CRITICAL_LOW' } }),
      prisma.analysisResult.count({ where: { ...where, deviation: 'CRITICAL_HIGH' } }),
      prisma.analysisResult.count({ where }),
    ]);

    // Najczesciej wystepujace odchylenia po parametrze
    const criticalResults = await prisma.analysisResult.findMany({
      where: {
        ...where,
        deviation: { in: ['CRITICAL_LOW', 'CRITICAL_HIGH', 'BELOW_MIN', 'ABOVE_MAX'] },
      },
      select: {
        parameterName: true,
        deviation: true,
      },
    });

    // Grupuj po parametrze
    const parameterStats: Record<string, Record<string, number>> = {};
    for (const r of criticalResults) {
      if (!parameterStats[r.parameterName]) {
        parameterStats[r.parameterName] = {};
      }
      parameterStats[r.parameterName][r.deviation] = (parameterStats[r.parameterName][r.deviation] || 0) + 1;
    }

    // Posortuj parametry po lacznej liczbie odchylen
    const parameterBreakdown = Object.entries(parameterStats)
      .map(([param, deviations]) => ({
        parameterName: param,
        total: Object.values(deviations).reduce((s, v) => s + v, 0),
        deviations,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    res.json({
      summary: {
        total,
        withinRange,
        belowMin,
        aboveMax,
        criticalLow,
        criticalHigh,
        deviationRate: total > 0 ? ((total - withinRange) / total * 100).toFixed(2) : '0.00',
      },
      parameterBreakdown,
    });
  } catch (error) {
    next(error);
  }
};
