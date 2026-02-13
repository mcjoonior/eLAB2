import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Send, X, Trash2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { formatDate, formatDateTime } from '@/utils/helpers';
import type { Report } from '@/types';

export default function ReportsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Send email dialog
  const [sendDialogReport, setSendDialogReport] = useState<Report | null>(null);
  const [sendEmail, setSendEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [confirmDeleteReport, setConfirmDeleteReport] = useState<Report | null>(null);

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function fetchReports() {
    setLoading(true);
    setError('');
    try {
      const res = await reportService.getAll({ page, limit });
      setReports(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch {
      setError('Nie udało się pobrać listy raportów. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(report: Report) {
    try {
      const blob = await reportService.download(report.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.reportCode}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Nie udało się pobrać pliku raportu.');
    }
  }

  function openSendDialog(report: Report) {
    setSendDialogReport(report);
    setSendEmail(report.analysis?.sample?.client?.email || '');
    setSendError('');
  }

  async function handleSendEmail() {
    if (!sendDialogReport) return;
    setSending(true);
    setSendError('');
    try {
      await reportService.sendEmail(sendDialogReport.id, sendEmail || undefined);
      setSendDialogReport(null);
      setSuccess('Raport został wysłany na adres e-mail.');
      setTimeout(() => setSuccess(''), 3000);
      fetchReports();
    } catch {
      setSendError('Nie udało się wysłać raportu. Spróbuj ponownie.');
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteReport() {
    if (!confirmDeleteReport) return;
    try {
      await reportService.delete(confirmDeleteReport.id);
      setConfirmDeleteReport(null);
      setSuccess('Raport został usunięty.');
      setTimeout(() => setSuccess(''), 3000);
      fetchReports();
    } catch {
      setError('Nie udało się usunąć raportu. Spróbuj ponownie.');
      setConfirmDeleteReport(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Raporty
        </h1>
      </div>

      {/* Success */}
      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingSpinner text={t('common.loading')} />
      ) : reports.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">Nie znaleziono raportów.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Numer raportu</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Analiza</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Klient</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Wysłano</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {report.reportCode}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {report.analysis?.analysisCode || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {report.analysis?.sample?.client?.companyName || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(report.generatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {report.sentToClient ? (
                        <div>
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Tak
                          </span>
                          {report.sentAt && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              {formatDateTime(report.sentAt)}
                            </span>
                          )}
                          {report.sentToEmail && (
                            <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                              ({report.sentToEmail})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                          Nie
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownload(report)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                          title="Pobierz PDF"
                        >
                          <Download className="h-3 w-3" />
                          PDF
                        </button>
                        <button
                          onClick={() => openSendDialog(report)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                          title="Wyślij e-mail"
                        >
                          <Send className="h-3 w-3" />
                          Wyślij
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setConfirmDeleteReport(report)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-3 w-3" />
                            {t('common.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 px-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {confirmDeleteReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Usuń raport
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Czy na pewno chcesz usunąć raport <strong>{confirmDeleteReport.reportCode}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteReport(null)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteReport}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Dialog */}
      {sendDialogReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSendDialogReport(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Wyślij raport e-mailem
              </h2>
              <button onClick={() => setSendDialogReport(null)} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Raport: <strong>{sendDialogReport.reportCode}</strong>
            </p>

            {sendError && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                {sendError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Adres e-mail
              </label>
              <input
                type="email"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="Adres e-mail klienta (opcjonalnie)"
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Pozostaw puste, aby wysłać na domyślny adres klienta.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSendDialogReport(null)}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Wyślij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
