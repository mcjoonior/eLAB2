import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { prisma } from '../index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');

function ensureReportsDir(): void {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
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
    analysisDate: Date;
    status: string;
    notes?: string | null;
    performerName: string;
    approverName?: string | null;
    approvedAt?: Date | null;
  };
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
      companyName: settings?.companyName ?? 'Laboratorium Galwaniczne',
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
      analysisDate: analysis.analysisDate,
      status: analysis.status,
      notes: analysis.notes,
      performerName: `${analysis.performer.firstName} ${analysis.performer.lastName}`,
      approverName: analysis.approver
        ? `${analysis.approver.firstName} ${analysis.approver.lastName}`
        : undefined,
      approvedAt: analysis.approvedAt ?? undefined,
    },
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
      const logoPath = path.join(__dirname, '..', '..', 'uploads', path.basename(data.company.logoUrl));
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, doc.page.margins.left, headerTop, { width: 80, height: 80 });
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
    doc.fontSize(16).fillColor('#2c3e50').text(data.company.companyName, companyX, headerTop, {
      width: pageWidth - 95,
    });

    let companyY = doc.y + 2;
    doc.fontSize(8).fillColor('#7f8c8d');
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
    doc.moveTo(doc.page.margins.left, lineY).lineTo(doc.page.margins.left + pageWidth, lineY).stroke('#2c3e50');

    // ================================================================
    // REPORT TITLE
    // ================================================================
    doc.y = lineY + 15;
    const headerText = data.company.reportHeaderText ?? 'Raport z analizy laboratoryjnej';
    doc.fontSize(18).fillColor('#2c3e50').text(headerText, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#34495e').text(`Numer raportu: ${data.reportCode}`, { align: 'center' });
    doc.fontSize(9).fillColor('#7f8c8d').text(`Data wygenerowania: ${formatDateTime(data.generatedAt)}`, { align: 'center' });
    doc.moveDown(1);

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
      { header: 'Parametr', width: pageWidth * 0.24 },
      { header: 'Jednostka', width: pageWidth * 0.10 },
      { header: 'Wartosc', width: pageWidth * 0.11 },
      { header: 'Min', width: pageWidth * 0.09 },
      { header: 'Max', width: pageWidth * 0.09 },
      { header: 'Optimum', width: pageWidth * 0.10 },
      { header: 'Odchylenie', width: pageWidth * 0.27 },
    ];

    const tableLeft = doc.page.margins.left;
    const rowHeight = 20;
    const headerRowHeight = 22;
    const tableFontSize = 8;
    const headerFontSize = 8;

    // Check if we need a new page for the table
    const estimatedTableHeight = headerRowHeight + data.results.length * rowHeight + 20;
    if (doc.y + estimatedTableHeight > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
    }

    // Draw table header
    let tableY = doc.y;
    doc.rect(tableLeft, tableY, pageWidth, headerRowHeight).fill('#2c3e50');

    let colX = tableLeft;
    doc.fontSize(headerFontSize).fillColor('#ffffff');
    for (const col of colDefs) {
      doc.text(col.header, colX + 4, tableY + 6, { width: col.width - 8, align: 'left' });
      colX += col.width;
    }

    tableY += headerRowHeight;

    // Draw table rows
    for (let i = 0; i < data.results.length; i++) {
      const result = data.results[i];

      // Check if we need a new page
      if (tableY + rowHeight > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        tableY = doc.y;

        // Redraw header on new page
        doc.rect(tableLeft, tableY, pageWidth, headerRowHeight).fill('#2c3e50');
        colX = tableLeft;
        doc.fontSize(headerFontSize).fillColor('#ffffff');
        for (const col of colDefs) {
          doc.text(col.header, colX + 4, tableY + 6, { width: col.width - 8, align: 'left' });
          colX += col.width;
        }
        tableY += headerRowHeight;
      }

      // Alternate row background
      const bgColor = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
      doc.rect(tableLeft, tableY, pageWidth, rowHeight).fill(bgColor);

      // Draw cell values
      colX = tableLeft;
      doc.fontSize(tableFontSize);

      // Parameter name
      doc.fillColor('#2c3e50').text(result.parameterName, colX + 4, tableY + 5, {
        width: colDefs[0].width - 8,
        lineBreak: false,
      });
      colX += colDefs[0].width;

      // Unit
      doc.fillColor('#2c3e50').text(result.unit, colX + 4, tableY + 5, {
        width: colDefs[1].width - 8,
        lineBreak: false,
      });
      colX += colDefs[1].width;

      // Value - colored by deviation
      const valColor = deviationColor(result.deviation);
      doc.fillColor(valColor).text(fmtVal(result.value), colX + 4, tableY + 5, {
        width: colDefs[2].width - 8,
        lineBreak: false,
      });
      colX += colDefs[2].width;

      // Min
      doc.fillColor('#2c3e50').text(fmtVal(result.minReference), colX + 4, tableY + 5, {
        width: colDefs[3].width - 8,
        lineBreak: false,
      });
      colX += colDefs[3].width;

      // Max
      doc.fillColor('#2c3e50').text(fmtVal(result.maxReference), colX + 4, tableY + 5, {
        width: colDefs[4].width - 8,
        lineBreak: false,
      });
      colX += colDefs[4].width;

      // Optimal
      doc.fillColor('#2c3e50').text(fmtVal(result.optimalReference), colX + 4, tableY + 5, {
        width: colDefs[5].width - 8,
        lineBreak: false,
      });
      colX += colDefs[5].width;

      // Deviation label - colored
      doc.fillColor(valColor).text(deviationLabel(result.deviation), colX + 4, tableY + 5, {
        width: colDefs[6].width - 8,
        lineBreak: false,
      });

      // Row border
      doc.moveTo(tableLeft, tableY + rowHeight).lineTo(tableLeft + pageWidth, tableY + rowHeight).stroke('#dee2e6');

      tableY += rowHeight;
    }

    // Table outer border
    const tableTop = tableY - data.results.length * rowHeight - headerRowHeight;
    doc.rect(tableLeft, tableTop, pageWidth, tableY - tableTop).stroke('#dee2e6');

    doc.y = tableY + 5;

    // Legend
    doc.moveDown(0.3);
    doc.fontSize(7).fillColor('#7f8c8d');
    const legendItems = [
      { color: '#27ae60', label: 'W normie' },
      { color: '#f39c12', label: 'Ponizej min / Powyzej max' },
      { color: '#e74c3c', label: 'Krytycznie niski / wysoki' },
    ];
    let legendX = doc.page.margins.left;
    const legendY = doc.y;
    for (const item of legendItems) {
      doc.rect(legendX, legendY, 8, 8).fill(item.color);
      doc.fillColor('#7f8c8d').text(item.label, legendX + 12, legendY, { lineBreak: false });
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
  doc.rect(doc.page.margins.left, y, 4, 16).fill('#2c3e50');
  doc.fontSize(12).fillColor('#2c3e50').text(title, doc.page.margins.left + 12, y + 1, {
    width: pageWidth - 12,
  });
  doc.moveDown(0.2);
}

function drawTwoColumnInfo(
  doc: PDFKit.PDFDocument,
  leftItems: [string, string][],
  rightItems: [string, string][],
  pageWidth: number,
): void {
  const colWidth = pageWidth / 2;
  const startY = doc.y;
  const leftX = doc.page.margins.left;
  const rightX = doc.page.margins.left + colWidth;
  let yOffset = 0;

  const maxRows = Math.max(leftItems.length, rightItems.length);
  for (let i = 0; i < maxRows; i++) {
    const y = startY + yOffset;

    if (i < leftItems.length) {
      doc.fontSize(8).fillColor('#7f8c8d').text(leftItems[i][0], leftX, y, { continued: true, width: colWidth });
      doc.fillColor('#2c3e50').text(` ${leftItems[i][1]}`, { width: colWidth });
    }

    if (i < rightItems.length) {
      doc.fontSize(8).fillColor('#7f8c8d').text(rightItems[i][0], rightX, y, { continued: true, width: colWidth });
      doc.fillColor('#2c3e50').text(` ${rightItems[i][1]}`, { width: colWidth });
    }

    yOffset += 14;
  }

  doc.y = startY + yOffset;
}
