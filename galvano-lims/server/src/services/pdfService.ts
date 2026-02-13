import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { prisma } from '../index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');
const APP_ROOT_DIR = path.join(__dirname, '..', '..');
const UPLOADS_DIR = path.join(APP_ROOT_DIR, 'uploads');
const COLORS = {
  primary: '#1f3a5f',
  primarySoft: '#eef3f8',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#d1d5db',
  zebra: '#f8fafc',
};

function ensureReportsDir(): void {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function resolveLogoPath(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;

  let pathname = logoUrl.trim();
  if (!pathname) return null;

  if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      return null;
    }
  }

  pathname = decodeURIComponent(pathname);
  const normalizedPosixPath = path.posix.normalize(pathname).replace(/^\/+/, '');
  if (normalizedPosixPath.includes('..')) {
    return null;
  }

  const candidatePaths = [
    // Expected format in app settings: /uploads/logos/file.ext
    path.join(APP_ROOT_DIR, normalizedPosixPath),
    // Support legacy relative path variants in DB
    path.join(UPLOADS_DIR, normalizedPosixPath.replace(/^uploads\//, '')),
    path.join(UPLOADS_DIR, 'logos', path.basename(normalizedPosixPath)),
    path.join(UPLOADS_DIR, path.basename(normalizedPosixPath)),
  ];

  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

/** Map SampleType enum to Polish label */
function sampleTypeLabel(type: string): string {
  const map: Record<string, string> = {
    BATH: 'Kąpiel',
    RINSE: 'Płukanie',
    WASTEWATER: 'Ścieki',
    RAW_MATERIAL: 'Surowiec',
    OTHER: 'Inne',
  };
  return map[type] ?? type;
}

/** Map ProcessType enum to Polish label */
function processTypeLabel(type: string): string {
  const map: Record<string, string> = {
    ZINC: 'Cynkowanie',
    NICKEL: 'Niklowanie',
    CHROME: 'Chromowanie',
    COPPER: 'Miedziowanie',
    TIN: 'Cynowanie',
    GOLD: 'Złocenie',
    SILVER: 'Srebrzenie',
    ANODIZING: 'Anodowanie',
    PASSIVATION: 'Pasywacja',
    OTHER: 'Inne',
  };
  return map[type] ?? type;
}

/** Map Deviation enum to Polish label */
function deviationLabel(deviation: string): string {
  const map: Record<string, string> = {
    CRITICAL_LOW: 'Krytycznie niski',
    BELOW_MIN: 'Poniżej minimum',
    WITHIN_RANGE: 'W normie',
    ABOVE_MAX: 'Powyżej maximum',
    CRITICAL_HIGH: 'Krytycznie wysoki',
  };
  return map[deviation] ?? deviation;
}

/** Map AnalysisType enum to Polish label */
function analysisTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CHEMICAL: 'Analiza chemiczna',
    CORROSION_TEST: 'Test korozji (komora solna)',
    SURFACE_ANALYSIS: 'Analiza powierzchni (mikroskop)',
  };
  return map[type] ?? type;
}

/** Map Priority enum to Polish label */
function priorityLabel(priority: string): string {
  const map: Record<string, string> = {
    LOW: 'Niski',
    MEDIUM: 'Średni',
    HIGH: 'Wysoki',
    CRITICAL: 'Krytyczny',
  };
  return map[priority] ?? priority;
}

/** Return color hex for a deviation value */
function deviationColor(deviation: string): string {
  switch (deviation) {
    case 'WITHIN_RANGE':
      return '#27ae60'; // green
    case 'BELOW_MIN':
    case 'ABOVE_MAX':
      return '#f39c12'; // yellow / orange
    case 'CRITICAL_LOW':
    case 'CRITICAL_HIGH':
      return '#e74c3c'; // red
    default:
      return '#2c3e50';
  }
}

/** Format a Decimal or number value for display */
function fmtVal(val: unknown): string {
  if (val === null || val === undefined) return '-';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  // Remove unnecessary trailing zeros but keep up to 4 decimals
  return parseFloat(n.toFixed(4)).toString();
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Types for the data we pass into the generator
// ---------------------------------------------------------------------------

interface ReportData {
  reportCode: string;
  generatedAt: Date;
  company: {
    companyName: string;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    nip?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    logoUrl?: string | null;
    reportHeaderText?: string | null;
    reportFooterText?: string | null;
  };
  client: {
    companyName: string;
    nip?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  sample: {
    sampleCode: string;
    sampleType: string;
    collectedAt: Date;
    description?: string | null;
  };
  process: {
    name: string;
    processType: string;
    description?: string | null;
  };
  analysis: {
    analysisCode: string;
    analysisType: string;
    analysisDate: Date;
    status: string;
    notes?: string | null;
    performerName: string;
    approverName?: string | null;
    approvedAt?: Date | null;
  };
  attachments: Array<{
    filename: string;
    originalName: string;
    description?: string | null;
  }>;
  results: Array<{
    parameterName: string;
    unit: string;
    value: unknown;
    minReference: unknown;
    maxReference: unknown;
    optimalReference: unknown;
    deviation: string;
    deviationPercent: unknown;
  }>;
  recommendations: Array<{
    parameterName: string;
    description: string;
    priority: string;
    recommendationType: string;
  }>;
}

// ---------------------------------------------------------------------------
// Main PDF generation
// ---------------------------------------------------------------------------

export async function generateReportPdf(analysisId: string, reportCode: string): Promise<string> {
  ensureReportsDir();

  // ---- Fetch all data needed for the report ----
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: {
      sample: {
        include: {
          client: true,
          process: true,
        },
      },
      performer: true,
      approver: true,
      results: { orderBy: { createdAt: 'asc' } },
      recommendations: { orderBy: { priority: 'asc' } },
      attachments: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!analysis) {
    throw new Error('Nie znaleziono analizy o podanym identyfikatorze.');
  }

  const settings = await prisma.companySettings.findFirst();

  const data: ReportData = {
    reportCode,
    generatedAt: new Date(),
    company: {
      companyName: settings?.companyName ?? 'eLAB LIMS',
      address: settings?.address,
      city: settings?.city,
      postalCode: settings?.postalCode,
      nip: settings?.nip,
      phone: settings?.phone,
      email: settings?.email,
      website: settings?.website,
      logoUrl: settings?.logoUrl,
      reportHeaderText: settings?.reportHeaderText,
      reportFooterText: settings?.reportFooterText,
    },
    client: {
      companyName: analysis.sample.client.companyName,
      nip: analysis.sample.client.nip,
      address: analysis.sample.client.address,
      city: analysis.sample.client.city,
      postalCode: analysis.sample.client.postalCode,
      contactPerson: analysis.sample.client.contactPerson,
      email: analysis.sample.client.email,
      phone: analysis.sample.client.phone,
    },
    sample: {
      sampleCode: analysis.sample.sampleCode,
      sampleType: analysis.sample.sampleType,
      collectedAt: analysis.sample.collectedAt,
      description: analysis.sample.description,
    },
    process: {
      name: analysis.sample.process.name,
      processType: analysis.sample.process.processType,
      description: analysis.sample.process.description,
    },
    analysis: {
      analysisCode: analysis.analysisCode,
      analysisType: (analysis as any).analysisType ?? 'CHEMICAL',
      analysisDate: analysis.analysisDate,
      status: analysis.status,
      notes: analysis.notes,
      performerName: `${analysis.performer.firstName} ${analysis.performer.lastName}`,
      approverName: analysis.approver
        ? `${analysis.approver.firstName} ${analysis.approver.lastName}`
        : undefined,
      approvedAt: analysis.approvedAt ?? undefined,
    },
    attachments: ((analysis as any).attachments ?? []).map((a: any) => ({
      filename: a.filename,
      originalName: a.originalName,
      description: a.description,
    })),
    results: analysis.results.map((r) => ({
      parameterName: r.parameterName,
      unit: r.unit,
      value: r.value,
      minReference: r.minReference,
      maxReference: r.maxReference,
      optimalReference: r.optimalReference,
      deviation: r.deviation,
      deviationPercent: r.deviationPercent,
    })),
    recommendations: analysis.recommendations.map((r) => ({
      parameterName: r.parameterName,
      description: r.description,
      priority: r.priority,
      recommendationType: r.recommendationType,
    })),
  };

  // ---- Build PDF ----
  const fileName = `${reportCode.replace(/\//g, '-')}.pdf`;
  const filePath = path.join(REPORTS_DIR, fileName);

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      info: {
        Title: `Raport ${data.reportCode}`,
        Author: data.company.companyName,
        Subject: 'Raport z analizy laboratoryjnej',
      },
    });

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ---- Register fonts with Polish diacritics support ----
    const DEJAVU_DIR = '/usr/share/fonts/dejavu';
    doc.registerFont('DejaVu', path.join(DEJAVU_DIR, 'DejaVuSans.ttf'));
    doc.registerFont('DejaVu-Bold', path.join(DEJAVU_DIR, 'DejaVuSans-Bold.ttf'));
    doc.font('DejaVu');

    // ================================================================
    // HEADER
    // ================================================================
    const headerTop = doc.y;

    // Company logo placeholder
    if (data.company.logoUrl) {
      const logoPath = resolveLogoPath(data.company.logoUrl);
      if (logoPath) {
        try {
          doc.image(logoPath, doc.page.margins.left, headerTop, {
            fit: [80, 80],
          });
        } catch {
          // If image fails, draw a placeholder rectangle
          doc.rect(doc.page.margins.left, headerTop, 80, 80).stroke('#cccccc');
          doc.fontSize(8).fillColor('#999999').text('LOGO', doc.page.margins.left + 25, headerTop + 35);
        }
      } else {
        doc.rect(doc.page.margins.left, headerTop, 80, 80).stroke('#cccccc');
        doc.fontSize(8).fillColor('#999999').text('LOGO', doc.page.margins.left + 25, headerTop + 35);
      }
    } else {
      // Placeholder square for logo
      doc.rect(doc.page.margins.left, headerTop, 80, 80).stroke('#cccccc');
      doc.fontSize(8).fillColor('#999999').text('LOGO', doc.page.margins.left + 25, headerTop + 35);
    }

    // Company name and address (right of logo)
    const companyX = doc.page.margins.left + 95;
    doc.font('DejaVu-Bold').fontSize(16).fillColor(COLORS.primary).text(data.company.companyName, companyX, headerTop, {
      width: pageWidth - 95,
    });

    let companyY = doc.y + 2;
    doc.font('DejaVu').fontSize(8).fillColor(COLORS.muted);
    if (data.company.address) {
      doc.text(
        `${data.company.address}${data.company.postalCode ? ', ' + data.company.postalCode : ''} ${data.company.city ?? ''}`.trim(),
        companyX,
        companyY,
        { width: pageWidth - 95 },
      );
      companyY = doc.y;
    }
    if (data.company.nip) {
      doc.text(`NIP: ${data.company.nip}`, companyX, companyY, { width: pageWidth - 95 });
      companyY = doc.y;
    }
    const contactParts: string[] = [];
    if (data.company.phone) contactParts.push(`Tel: ${data.company.phone}`);
    if (data.company.email) contactParts.push(`Email: ${data.company.email}`);
    if (contactParts.length) {
      doc.text(contactParts.join('  |  '), companyX, companyY, { width: pageWidth - 95 });
    }

    // Horizontal line below header
    const lineY = Math.max(doc.y, headerTop + 85) + 10;
    doc.moveTo(doc.page.margins.left, lineY).lineTo(doc.page.margins.left + pageWidth, lineY).stroke(COLORS.primary);

    // ================================================================
    // REPORT TITLE
    // ================================================================
    doc.y = lineY + 14;
    const titleBoxY = doc.y;
    const headerText = data.company.reportHeaderText ?? 'Raport z analizy laboratoryjnej';
    const titleLineHeight = 16;
    const titlePaddingTop = 10;
    const titlePaddingBottom = 8;
    const metaGap = 4;
    const metaText = `Numer raportu: ${data.reportCode}    |    Data wygenerowania: ${formatDateTime(data.generatedAt)}`;

    doc.font('DejaVu-Bold').fontSize(titleLineHeight);
    const titleTextHeight = doc.heightOfString(headerText, { width: pageWidth - 24, align: 'center' });
    doc.font('DejaVu').fontSize(9);
    const metaTextHeight = doc.heightOfString(metaText, { width: pageWidth - 24, align: 'center' });
    const titleBoxHeight = Math.ceil(titlePaddingTop + titleTextHeight + metaGap + metaTextHeight + titlePaddingBottom);

    doc.roundedRect(doc.page.margins.left, titleBoxY, pageWidth, titleBoxHeight, 6).fill(COLORS.primarySoft);
    doc.y = titleBoxY + titlePaddingTop;

    doc.font('DejaVu-Bold').fontSize(titleLineHeight).fillColor(COLORS.primary).text(headerText, doc.page.margins.left + 12, doc.y, {
      width: pageWidth - 24,
      align: 'center',
    });
    doc.y += metaGap;
    doc.font('DejaVu').fontSize(9).fillColor(COLORS.muted).text(metaText, doc.page.margins.left + 12, doc.y, {
      width: pageWidth - 24,
      align: 'center',
    });
    doc.y = titleBoxY + titleBoxHeight + 10;

    // ================================================================
    // CLIENT INFORMATION
    // ================================================================
    drawSectionHeader(doc, 'Informacje o kliencie', pageWidth);

    const clientInfoLeft: [string, string][] = [
      ['Firma:', data.client.companyName],
      ['NIP:', data.client.nip ?? '-'],
      ['Adres:', [data.client.address, data.client.postalCode, data.client.city].filter(Boolean).join(', ') || '-'],
    ];
    const clientInfoRight: [string, string][] = [
      ['Osoba kontaktowa:', data.client.contactPerson ?? '-'],
      ['Email:', data.client.email ?? '-'],
      ['Telefon:', data.client.phone ?? '-'],
    ];

    drawTwoColumnInfo(doc, clientInfoLeft, clientInfoRight, pageWidth);
    doc.moveDown(0.8);

    // ================================================================
    // SAMPLE INFORMATION
    // ================================================================
    drawSectionHeader(doc, 'Informacje o probce', pageWidth);

    const sampleInfoLeft: [string, string][] = [
      ['Kod probki:', data.sample.sampleCode],
      ['Typ probki:', sampleTypeLabel(data.sample.sampleType)],
    ];
    const sampleInfoRight: [string, string][] = [
      ['Data pobrania:', formatDate(data.sample.collectedAt)],
      ['Opis:', data.sample.description ?? '-'],
    ];

    drawTwoColumnInfo(doc, sampleInfoLeft, sampleInfoRight, pageWidth);
    doc.moveDown(0.8);

    // ================================================================
    // PROCESS INFORMATION
    // ================================================================
    drawSectionHeader(doc, 'Informacje o procesie', pageWidth);

    const processInfoLeft: [string, string][] = [
      ['Nazwa procesu:', data.process.name],
      ['Typ procesu:', processTypeLabel(data.process.processType)],
    ];
    const processInfoRight: [string, string][] = [
      ['Kod analizy:', data.analysis.analysisCode],
      ['Typ analizy:', analysisTypeLabel(data.analysis.analysisType)],
      ['Data analizy:', formatDate(data.analysis.analysisDate)],
    ];

    drawTwoColumnInfo(doc, processInfoLeft, processInfoRight, pageWidth);

    if (data.process.description) {
      doc.moveDown(0.3);
      doc.fontSize(8).fillColor('#7f8c8d').text(`Opis: ${data.process.description}`, {
        width: pageWidth,
      });
    }
    doc.moveDown(1);

    // ================================================================
    // RESULTS TABLE
    // ================================================================
    drawSectionHeader(doc, 'Wyniki analizy', pageWidth);
    doc.moveDown(0.3);

    // Table column definitions
    const colDefs = [
      { header: 'Parametr', width: pageWidth * 0.26 },
      { header: 'J.', width: pageWidth * 0.07 },
      { header: 'Wynik', width: pageWidth * 0.11 },
      { header: 'Min', width: pageWidth * 0.09 },
      { header: 'Max', width: pageWidth * 0.09 },
      { header: 'Opt.', width: pageWidth * 0.10 },
      { header: 'Ocena', width: pageWidth * 0.28 },
    ];

    const tableLeft = doc.page.margins.left;
    const baseRowHeight = 20;
    const headerRowHeight = 24;
    const tableFontSize = 8;
    const headerFontSize = 8;

    if (doc.y + 80 > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
    }

    // Draw table header
    let tableY = doc.y;
    const tableStartY = tableY;
    doc.rect(tableLeft, tableY, pageWidth, headerRowHeight).fill(COLORS.primary);

    let colX = tableLeft;
    doc.font('DejaVu-Bold').fontSize(headerFontSize).fillColor('#ffffff');
    for (const col of colDefs) {
      doc.text(col.header, colX + 4, tableY + 7, { width: col.width - 8, align: 'left' });
      colX += col.width;
    }

    tableY += headerRowHeight;

    // Draw table rows
    for (let i = 0; i < data.results.length; i++) {
      const result = data.results[i];

      const deviationText = deviationLabel(result.deviation);
      doc.font('DejaVu').fontSize(tableFontSize);
      const paramHeight = doc.heightOfString(result.parameterName, { width: colDefs[0].width - 8 });
      const deviationHeight = doc.heightOfString(deviationText, { width: colDefs[6].width - 8 });
      const rowHeight = Math.max(baseRowHeight, Math.ceil(Math.max(paramHeight, deviationHeight) + 8));

      // Check if we need a new page
      if (tableY + rowHeight > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        tableY = doc.y;

        // Redraw header on new page
        doc.rect(tableLeft, tableY, pageWidth, headerRowHeight).fill(COLORS.primary);
        colX = tableLeft;
        doc.font('DejaVu-Bold').fontSize(headerFontSize).fillColor('#ffffff');
        for (const col of colDefs) {
          doc.text(col.header, colX + 4, tableY + 7, { width: col.width - 8, align: 'left' });
          colX += col.width;
        }
        tableY += headerRowHeight;
      }

      // Alternate row background
      const bgColor = i % 2 === 0 ? COLORS.zebra : '#ffffff';
      doc.rect(tableLeft, tableY, pageWidth, rowHeight).fill(bgColor);

      // Draw cell values
      colX = tableLeft;
      doc.font('DejaVu').fontSize(tableFontSize);

      // Parameter name
      doc.fillColor(COLORS.text).text(result.parameterName, colX + 4, tableY + 4, {
        width: colDefs[0].width - 8,
      });
      colX += colDefs[0].width;

      // Unit
      doc.fillColor(COLORS.text).text(result.unit, colX + 4, tableY + 4, {
        width: colDefs[1].width - 8,
        align: 'center',
      });
      colX += colDefs[1].width;

      // Value - colored by deviation
      const valColor = deviationColor(result.deviation);
      doc.font('DejaVu-Bold').fillColor(valColor).text(fmtVal(result.value), colX + 4, tableY + 4, {
        width: colDefs[2].width - 8,
        align: 'center',
      });
      doc.font('DejaVu');
      colX += colDefs[2].width;

      // Min
      doc.fillColor(COLORS.text).text(fmtVal(result.minReference), colX + 4, tableY + 4, {
        width: colDefs[3].width - 8,
        align: 'center',
      });
      colX += colDefs[3].width;

      // Max
      doc.fillColor(COLORS.text).text(fmtVal(result.maxReference), colX + 4, tableY + 4, {
        width: colDefs[4].width - 8,
        align: 'center',
      });
      colX += colDefs[4].width;

      // Optimal
      doc.fillColor(COLORS.text).text(fmtVal(result.optimalReference), colX + 4, tableY + 4, {
        width: colDefs[5].width - 8,
        align: 'center',
      });
      colX += colDefs[5].width;

      // Deviation label - colored
      doc.fillColor(valColor).text(deviationText, colX + 4, tableY + 4, {
        width: colDefs[6].width - 8,
      });

      // Row border
      doc.moveTo(tableLeft, tableY + rowHeight).lineTo(tableLeft + pageWidth, tableY + rowHeight).stroke(COLORS.border);

      tableY += rowHeight;
    }

    // Table outer border
    doc.rect(tableLeft, tableStartY, pageWidth, tableY - tableStartY).stroke(COLORS.border);

    doc.y = tableY + 5;

    // Legend
    doc.moveDown(0.3);
    doc.font('DejaVu').fontSize(7).fillColor(COLORS.muted);
    const legendItems = [
      { color: '#27ae60', label: 'W normie' },
      { color: '#f39c12', label: 'Ponizej min / Powyzej max' },
      { color: '#e74c3c', label: 'Krytycznie niski / wysoki' },
    ];
    let legendX = doc.page.margins.left;
    const legendY = doc.y;
    for (const item of legendItems) {
      doc.rect(legendX, legendY, 8, 8).fill(item.color);
      doc.fillColor(COLORS.muted).text(item.label, legendX + 12, legendY, { lineBreak: false });
      legendX += 130;
    }
    doc.y = legendY + 15;
    doc.moveDown(0.5);

    // ================================================================
    // RECOMMENDATIONS
    // ================================================================
    if (data.recommendations.length > 0) {
      // Check if we need a new page
      if (doc.y + 60 > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
      }

      drawSectionHeader(doc, 'Zalecenia', pageWidth);
      doc.moveDown(0.3);

      for (const rec of data.recommendations) {
        // Check if we need a new page for this recommendation
        if (doc.y + 40 > doc.page.height - doc.page.margins.bottom - 60) {
          doc.addPage();
        }

        const prColor = rec.priority === 'CRITICAL' ? '#e74c3c'
          : rec.priority === 'HIGH' ? '#e67e22'
          : rec.priority === 'MEDIUM' ? '#f39c12'
          : '#27ae60';

        // Priority indicator dot
        doc.circle(doc.page.margins.left + 5, doc.y + 5, 4).fill(prColor);

        doc.fontSize(9).fillColor('#2c3e50').text(
          `[${priorityLabel(rec.priority)}] ${rec.parameterName}`,
          doc.page.margins.left + 15,
          doc.y,
          { width: pageWidth - 15 },
        );
        doc.fontSize(8).fillColor('#555555').text(rec.description, doc.page.margins.left + 15, doc.y, {
          width: pageWidth - 15,
        });
        doc.moveDown(0.5);
      }
    }

    // ================================================================
    // NOTES
    // ================================================================
    if (data.analysis.notes) {
      if (doc.y + 50 > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
      }
      drawSectionHeader(doc, 'Uwagi', pageWidth);
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#555555').text(data.analysis.notes, {
        width: pageWidth,
      });
      doc.moveDown(0.5);
    }

    // ================================================================
    // ATTACHMENTS (images)
    // ================================================================
    if (data.attachments.length > 0) {
      if (doc.y + 60 > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
      }

      drawSectionHeader(doc, 'Załączniki fotograficzne', pageWidth);
      doc.moveDown(0.3);

      const ATTACHMENTS_DIR = path.join(__dirname, '..', '..', 'uploads', 'attachments');
      const imgMaxWidth = pageWidth * 0.8;
      const imgMaxHeight = 300;

      for (const att of data.attachments) {
        const imgPath = path.join(ATTACHMENTS_DIR, att.filename);
        if (!fs.existsSync(imgPath)) continue;

        // Check if we need a new page (allow space for image + caption)
        if (doc.y + imgMaxHeight + 30 > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage();
        }

        try {
          doc.image(imgPath, doc.page.margins.left + (pageWidth - imgMaxWidth) / 2, doc.y, {
            fit: [imgMaxWidth, imgMaxHeight],
            align: 'center',
          });

          // Move below the image
          doc.moveDown(0.5);

          // Caption
          const caption = att.description || att.originalName;
          doc.fontSize(8).fillColor('#7f8c8d').text(caption, {
            width: pageWidth,
            align: 'center',
          });
          doc.moveDown(1);
        } catch {
          doc.fontSize(8).fillColor('#999999').text(`[Nie można załadować: ${att.originalName}]`, {
            width: pageWidth,
          });
          doc.moveDown(0.5);
        }
      }
    }

    // ================================================================
    // FOOTER / SIGNATURES
    // ================================================================
    // Ensure enough space for footer
    if (doc.y + 120 > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }

    // Push footer to the bottom area
    const footerY = Math.max(doc.y + 30, doc.page.height - doc.page.margins.bottom - 120);

    // Separator line
    doc.moveTo(doc.page.margins.left, footerY)
      .lineTo(doc.page.margins.left + pageWidth, footerY)
      .stroke('#bdc3c7');

    // Signatures section
    const sigY = footerY + 15;
    const sigColWidth = pageWidth / 2;

    doc.fontSize(9).fillColor('#2c3e50');
    doc.text('Wykonal:', doc.page.margins.left, sigY, { width: sigColWidth });
    doc.fontSize(8).fillColor('#555555');
    doc.text(data.analysis.performerName, doc.page.margins.left, sigY + 14, { width: sigColWidth });
    doc.text(formatDate(data.analysis.analysisDate), doc.page.margins.left, sigY + 26, { width: sigColWidth });

    // Dotted signature line
    doc.moveTo(doc.page.margins.left, sigY + 55)
      .lineTo(doc.page.margins.left + sigColWidth - 30, sigY + 55)
      .dash(3, { space: 2 })
      .stroke('#bdc3c7');
    doc.undash();
    doc.fontSize(7).fillColor('#999999').text('(podpis)', doc.page.margins.left + 40, sigY + 58);

    // Approver
    const approverX = doc.page.margins.left + sigColWidth;
    doc.fontSize(9).fillColor('#2c3e50');
    doc.text('Zatwierdzil:', approverX, sigY, { width: sigColWidth });
    doc.fontSize(8).fillColor('#555555');
    doc.text(data.analysis.approverName ?? '—', approverX, sigY + 14, { width: sigColWidth });
    if (data.analysis.approvedAt) {
      doc.text(formatDate(data.analysis.approvedAt), approverX, sigY + 26, { width: sigColWidth });
    }

    doc.moveTo(approverX, sigY + 55)
      .lineTo(approverX + sigColWidth - 30, sigY + 55)
      .dash(3, { space: 2 })
      .stroke('#bdc3c7');
    doc.undash();
    doc.fontSize(7).fillColor('#999999').text('(podpis)', approverX + 40, sigY + 58);

    // Footer text
    const footerTextY = sigY + 75;
    const footerText = data.company.reportFooterText ?? 'Dokument wygenerowany automatycznie przez system LIMS';
    doc.fontSize(7).fillColor('#999999').text(footerText, doc.page.margins.left, footerTextY, {
      width: pageWidth,
      align: 'center',
    });
    doc.text(
      `Wygenerowano: ${formatDateTime(data.generatedAt)}`,
      doc.page.margins.left,
      footerTextY + 10,
      { width: pageWidth, align: 'center' },
    );

    // ---- Finalize ----
    doc.end();

    writeStream.on('finish', () => resolve(filePath));
    writeStream.on('error', (err) => reject(err));
  });
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, pageWidth: number): void {
  const y = doc.y;
  doc.roundedRect(doc.page.margins.left, y, pageWidth, 20, 5).fill(COLORS.primarySoft);
  doc.font('DejaVu-Bold').fontSize(11).fillColor(COLORS.primary).text(title, doc.page.margins.left + 10, y + 5, {
    width: pageWidth - 20,
  });
  doc.y = y + 24;
}

function drawTwoColumnInfo(
  doc: PDFKit.PDFDocument,
  leftItems: [string, string][],
  rightItems: [string, string][],
  pageWidth: number,
): void {
  const gutter = 12;
  const colWidth = (pageWidth - gutter) / 2;
  const startY = doc.y;
  const leftX = doc.page.margins.left;
  const rightX = doc.page.margins.left + colWidth + gutter;
  let yOffset = 0;

  const getItemHeight = (item: [string, string] | undefined): number => {
    if (!item) return 0;
    const innerWidth = colWidth - 12;
    doc.font('DejaVu-Bold').fontSize(7);
    const labelH = doc.heightOfString(item[0], { width: innerWidth });
    doc.font('DejaVu').fontSize(9);
    const valueH = doc.heightOfString(item[1], { width: innerWidth });
    return Math.max(30, Math.ceil(labelH + valueH + 12));
  };

  const drawInfoBox = (item: [string, string] | undefined, x: number, y: number, boxHeight: number): void => {
    doc.roundedRect(x, y, colWidth, boxHeight, 4).fillAndStroke('#ffffff', COLORS.border);
    if (!item) return;

    doc.font('DejaVu-Bold').fontSize(7).fillColor(COLORS.muted).text(item[0], x + 6, y + 5, {
      width: colWidth - 12,
    });
    doc.font('DejaVu').fontSize(9).fillColor(COLORS.text).text(item[1], x + 6, y + 14, {
      width: colWidth - 12,
    });
  };

  const maxRows = Math.max(leftItems.length, rightItems.length);
  for (let i = 0; i < maxRows; i++) {
    const y = startY + yOffset;
    const leftItem = leftItems[i];
    const rightItem = rightItems[i];
    const rowHeight = Math.max(getItemHeight(leftItem), getItemHeight(rightItem));

    drawInfoBox(leftItem, leftX, y, rowHeight);
    drawInfoBox(rightItem, rightX, y, rowHeight);

    yOffset += rowHeight + 8;
  }

  doc.y = startY + yOffset;
}
