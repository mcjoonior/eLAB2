import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { generateReportPdf } from '../services/pdfService';
import { sendReportEmail } from '../services/emailService';

// ============================================================
// Walidacja Zod
// ============================================================

const sendEmailSchema = z.object({
  recipientEmail: z.string().email('Nieprawidlowy adres e-mail'),
});

// ============================================================
// Generowanie kodu raportu: RPT-YYYYMM-XXXX
// ============================================================

async function generateReportCode(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `RPT-${yearMonth}-`;

  const lastReport = await prisma.report.findFirst({
    where: {
      reportCode: { startsWith: prefix },
    },
    orderBy: { reportCode: 'desc' },
  });

  let nextNumber = 1;
  if (lastReport) {
    const lastNumber = parseInt(lastReport.reportCode.replace(prefix, ''), 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

// ============================================================
// GET / - Lista raportow z paginacja
// ============================================================

export const getReports = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      search,
      dateFrom,
      dateTo,
      sentToClient,
      page = '1',
      limit = '25',
      sortBy = 'generatedAt',
      sortOrder = 'desc',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ReportWhereInput = {};

    if (search) {
      where.OR = [
        { reportCode: { contains: search as string, mode: 'insensitive' } },
        { analysis: { analysisCode: { contains: search as string, mode: 'insensitive' } } },
        { analysis: { sample: { sampleCode: { contains: search as string, mode: 'insensitive' } } } },
        { analysis: { sample: { client: { companyName: { contains: search as string, mode: 'insensitive' } } } } },
      ];
    }

    if (dateFrom || dateTo) {
      where.generatedAt = {};
      if (dateFrom) {
        where.generatedAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.generatedAt.lte = new Date(dateTo as string);
      }
    }

    if (sentToClient !== undefined) {
      where.sentToClient = sentToClient === 'true';
    }

    const allowedSortFields = ['reportCode', 'generatedAt', 'sentAt'];
    const sortField = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'generatedAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortField]: order },
        include: {
          analysis: {
            select: {
              id: true,
              analysisCode: true,
              analysisDate: true,
              status: true,
              sample: {
                select: {
                  id: true,
                  sampleCode: true,
                  client: { select: { id: true, companyName: true } },
                  process: { select: { id: true, name: true, processType: true } },
                },
              },
            },
          },
          generator: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.report.count({ where }),
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
// GET /:id - Szczegoly raportu
// ============================================================

export const getReportById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        analysis: {
          include: {
            sample: {
              include: {
                client: { select: { id: true, companyName: true, email: true, contactPerson: true } },
                process: { select: { id: true, name: true, processType: true } },
              },
            },
            performer: { select: { id: true, firstName: true, lastName: true } },
            approver: { select: { id: true, firstName: true, lastName: true } },
            results: { orderBy: { createdAt: 'asc' } },
            recommendations: { orderBy: { priority: 'desc' } },
          },
        },
        generator: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!report) {
      res.status(404).json({ error: 'Raport nie zostal znaleziony' });
      return;
    }

    res.json(report);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /generate/:analysisId - Generowanie raportu PDF
// ============================================================

export const generateReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { analysisId } = req.params;

    // Sprawdz czy analiza istnieje
    const analysis: any = await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        results: true,
        sample: {
          select: {
            sampleCode: true,
            client: { select: { companyName: true } },
          },
        },
      },
    });

    if (!analysis) {
      res.status(404).json({ error: 'Analiza nie zostala znaleziona' });
      return;
    }

    if (analysis.status !== 'COMPLETED' && analysis.status !== 'APPROVED') {
      res.status(400).json({
        error: 'Raport mozna wygenerowac tylko dla analiz o statusie "COMPLETED" lub "APPROVED"',
        currentStatus: analysis.status,
      });
      return;
    }

    if (analysis.results.length === 0) {
      res.status(400).json({
        error: 'Nie mozna wygenerowac raportu dla analizy bez wynikow',
      });
      return;
    }

    // Wygeneruj kod raportu
    const reportCode = await generateReportCode();

    // Wygeneruj PDF
    const pdfPath = await generateReportPdf(analysisId, reportCode);

    // Zapisz rekord raportu
    const report = await prisma.report.create({
      data: {
        reportCode,
        analysisId,
        generatedBy: req.user!.userId,
        pdfPath,
      },
      include: {
        analysis: {
          select: {
            id: true,
            analysisCode: true,
            sample: {
              select: {
                sampleCode: true,
                client: { select: { companyName: true } },
              },
            },
          },
        },
        generator: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'GENERATE_REPORT',
        entityType: 'REPORT',
        entityId: report.id,
        details: {
          reportCode,
          analysisCode: analysis.analysisCode,
          sampleCode: analysis.sample.sampleCode,
        },
      },
    });

    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /:id/download - Pobranie pliku PDF raportu
// ============================================================

export const downloadReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id },
      select: {
        reportCode: true,
        pdfPath: true,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'Raport nie zostal znaleziony' });
      return;
    }

    if (!report.pdfPath) {
      res.status(404).json({ error: 'Plik PDF raportu nie zostal znaleziony' });
      return;
    }

    // Sprawdz czy plik istnieje na dysku
    if (!fs.existsSync(report.pdfPath)) {
      res.status(404).json({ error: 'Plik PDF raportu nie istnieje na serwerze. Wygeneruj raport ponownie.' });
      return;
    }

    const fileName = `${report.reportCode.replace(/\//g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const fileStream = fs.createReadStream(report.pdfPath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /:id/send-email - Wyslanie raportu emailem
// ============================================================

export const sendReportByEmail = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const validation = sendEmailSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Blad walidacji danych',
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { recipientEmail } = validation.data;

    const report: any = await prisma.report.findUnique({
      where: { id },
      include: {
        analysis: {
          include: {
            sample: {
              include: {
                client: { select: { companyName: true } },
                process: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!report) {
      res.status(404).json({ error: 'Raport nie zostal znaleziony' });
      return;
    }

    if (!report.pdfPath || !fs.existsSync(report.pdfPath)) {
      res.status(400).json({ error: 'Plik PDF raportu nie istnieje. Wygeneruj raport ponownie.' });
      return;
    }

    // Wyslij email
    await sendReportEmail({
      reportId: report.id,
      recipientEmail,
      reportCode: report.reportCode,
      pdfPath: report.pdfPath,
      analysisCode: report.analysis.analysisCode,
      clientCompanyName: report.analysis.sample.client.companyName,
      sampleCode: report.analysis.sample.sampleCode,
      processName: report.analysis.sample.process.name,
      analysisDate: report.analysis.analysisDate,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'SEND_REPORT',
        entityType: 'REPORT',
        entityId: report.id,
        details: {
          reportCode: report.reportCode,
          recipientEmail,
          sentAt: new Date().toISOString(),
        },
      },
    });

    res.json({
      message: `Raport ${report.reportCode} zostal wyslany na adres ${recipientEmail}`,
      sentToEmail: recipientEmail,
      sentAt: new Date(),
    });
  } catch (error) {
    next(error);
  }
};
