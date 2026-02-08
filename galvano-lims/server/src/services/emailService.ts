import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from '../index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

interface SendReportEmailParams {
  reportId: string;
  recipientEmail: string;
  reportCode: string;
  pdfPath: string;
  analysisCode: string;
  clientCompanyName: string;
  sampleCode: string;
  processName: string;
  analysisDate: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Load SMTP settings from CompanySettings table. */
async function loadSmtpConfig(): Promise<SmtpConfig> {
  const settings = await prisma.companySettings.findFirst();

  if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPassword) {
    throw new Error(
      'Konfiguracja SMTP nie jest kompletna. Uzupelnij ustawienia serwera pocztowego w panelu administracyjnym.',
    );
  }

  return {
    host: settings.smtpHost,
    port: settings.smtpPort ?? 587,
    user: settings.smtpUser,
    password: settings.smtpPassword,
    from: settings.smtpFrom ?? settings.smtpUser,
  };
}

/** Create a Nodemailer transporter from SMTP config. */
function createTransporter(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/** Format a Date to Polish locale string. */
function formatDatePl(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// HTML email template
// ---------------------------------------------------------------------------

function buildReportEmailHtml(params: {
  companyName: string;
  reportCode: string;
  analysisCode: string;
  clientCompanyName: string;
  sampleCode: string;
  processName: string;
  analysisDate: Date;
  footerText?: string | null;
}): string {
  const {
    companyName,
    reportCode,
    analysisCode,
    clientCompanyName,
    sampleCode,
    processName,
    analysisDate,
    footerText,
  } = params;

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Raport z analizy laboratoryjnej</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding:30px 15px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#2c3e50; padding:25px 30px;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:600;">
                ${companyName}
              </h1>
              <p style="margin:5px 0 0; color:#bdc3c7; font-size:13px;">
                System LIMS - Raport z analizy laboratoryjnej
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;">
              <p style="margin:0 0 20px; color:#2c3e50; font-size:15px; line-height:1.6;">
                Szanowni Panstwo,
              </p>
              <p style="margin:0 0 20px; color:#555555; font-size:14px; line-height:1.6;">
                W zalaczeniu przesylamy raport z analizy laboratoryjnej wykonanej dla Panstwa firmy.
                Ponizej znajduje sie podsumowanie:
              </p>

              <!-- Summary table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 25px; border:1px solid #e8e8e8; border-radius:6px; overflow:hidden;">
                <tr style="background-color:#f8f9fa;">
                  <td style="padding:10px 15px; border-bottom:1px solid #e8e8e8; color:#7f8c8d; font-size:12px; width:40%;">
                    Numer raportu
                  </td>
                  <td style="padding:10px 15px; border-bottom:1px solid #e8e8e8; color:#2c3e50; font-size:13px; font-weight:600;">
                    ${reportCode}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 15px; border-bottom:1px solid #e8e8e8; color:#7f8c8d; font-size:12px;">
                    Kod analizy
                  </td>
                  <td style="padding:10px 15px; border-bottom:1px solid #e8e8e8; color:#2c3e50; font-size:13px;">
                    ${analysisCode}
                  </td>
                </tr>
                <tr style="background-color:#f8f9fa;">
                  <td style="padding:10px 15px; border-bottom:1px solid #e8e8e8; color:#7f8c8d; font-size:12px;">
                    Klient
                  </td>
                  <td style="padding:10px 15px; border-bottom:1px solid #e8e8e8; color:#2c3e50; font-size:13px;">
                    ${clientCompanyName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 15px; border-bottom:1px solid #e8e8e8; color:#7f8c8d; font-size:12px;">
                    Kod probki
                  </td>
                  <td style="padding:10px 15px; border-bottom:1px solid #e8e8e8; color:#2c3e50; font-size:13px;">
                    ${sampleCode}
                  </td>
                </tr>
                <tr style="background-color:#f8f9fa;">
                  <td style="padding:10px 15px; border-bottom:1px solid #e8e8e8; color:#7f8c8d; font-size:12px;">
                    Proces
                  </td>
                  <td style="padding:10px 15px; border-bottom:1px solid #e8e8e8; color:#2c3e50; font-size:13px;">
                    ${processName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 15px; color:#7f8c8d; font-size:12px;">
                    Data analizy
                  </td>
                  <td style="padding:10px 15px; color:#2c3e50; font-size:13px;">
                    ${formatDatePl(analysisDate)}
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px; color:#555555; font-size:14px; line-height:1.6;">
                Pelny raport z wynikami analizy oraz zaleceniami znajduje sie w zalaczonym pliku PDF.
              </p>

              <p style="margin:0 0 5px; color:#555555; font-size:14px; line-height:1.6;">
                W razie pytan prosimy o kontakt.
              </p>
              <p style="margin:0 0 0; color:#555555; font-size:14px; line-height:1.6;">
                Z powazaniem,<br>
                <strong>${companyName}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fa; padding:20px 30px; border-top:1px solid #e8e8e8;">
              <p style="margin:0; color:#999999; font-size:11px; line-height:1.5; text-align:center;">
                ${footerText ?? 'Dokument wygenerowany automatycznie przez system LIMS.'}
              </p>
              <p style="margin:8px 0 0; color:#bbbbbb; font-size:10px; text-align:center;">
                Ta wiadomosc zostala wygenerowana automatycznie. Prosimy nie odpowiadac na ten adres.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a report PDF via email to the specified recipient.
 * Implements retry logic (max 3 attempts).
 * Updates the report record with sentToClient / sentAt / sentToEmail on success.
 */
export async function sendReportEmail(params: SendReportEmailParams): Promise<void> {
  const smtpConfig = await loadSmtpConfig();
  const transporter = createTransporter(smtpConfig);

  const settings = await prisma.companySettings.findFirst();
  const companyName = settings?.companyName ?? 'Laboratorium Galwaniczne';
  const footerText = settings?.reportFooterText;

  const html = buildReportEmailHtml({
    companyName,
    reportCode: params.reportCode,
    analysisCode: params.analysisCode,
    clientCompanyName: params.clientCompanyName,
    sampleCode: params.sampleCode,
    processName: params.processName,
    analysisDate: params.analysisDate,
    footerText,
  });

  const mailOptions = {
    from: `"${companyName}" <${smtpConfig.from}>`,
    to: params.recipientEmail,
    subject: `Raport z analizy laboratoryjnej - ${params.reportCode}`,
    html,
    attachments: [
      {
        filename: `${params.reportCode.replace(/\//g, '-')}.pdf`,
        path: params.pdfPath,
        contentType: 'application/pdf',
      },
    ],
  };

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await transporter.sendMail(mailOptions);

      // Update report record
      await prisma.report.update({
        where: { id: params.reportId },
        data: {
          sentToClient: true,
          sentAt: new Date(),
          sentToEmail: params.recipientEmail,
        },
      });

      return; // success
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[EmailService] Proba ${attempt}/${MAX_RETRIES} wysylki emaila nie powiodla sie: ${lastError.message}`,
      );

      if (attempt < MAX_RETRIES) {
        // Wait before retrying (exponential back-off: 1s, 2s, 4s)
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }

  throw new Error(
    `Nie udalo sie wyslac emaila po ${MAX_RETRIES} probach. Ostatni blad: ${lastError?.message ?? 'nieznany'}`,
  );
}

/**
 * Test the SMTP connection using current CompanySettings.
 * Returns true on success, throws on failure.
 */
export async function testSmtpConnection(): Promise<boolean> {
  const smtpConfig = await loadSmtpConfig();
  const transporter = createTransporter(smtpConfig);

  try {
    await transporter.verify();
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Test polaczenia SMTP nie powiodl sie: ${message}`);
  }
}
