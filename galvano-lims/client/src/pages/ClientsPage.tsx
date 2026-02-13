import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Download, Pencil, XCircle, X } from 'lucide-react';
import { clientService } from '@/services/clientService';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';
import { useAuthStore } from '@/store/authStore';
import { formatDate, downloadCSV } from '@/utils/helpers';
import type { Client } from '@/types';

interface ClientForm {
  companyName: string;
  nip: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  contactPerson: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyForm: ClientForm = {
  companyName: '',
  nip: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'Polska',
  contactPerson: '',
  email: '',
  phone: '',
  notes: '',
};

export default function ClientsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = (user?.role || '').toUpperCase() === 'ADMIN';

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Confirm deactivate
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState<Client | null>(null);

  async function fetchClients() {
    setLoading(true);
    setError('');
    try {
      const isActive =
        activityFilter === 'active'
          ? true
          : activityFilter === 'inactive'
            ? false
            : 'all';
      const res = await clientService.getAll({
        page,
        limit,
        search: search || undefined,
        isActive,
      });
      setClients(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch {
      setError(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchClients();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activityFilter]);

  function openAdd() {
    setEditingClient(null);
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm({
      companyName: client.companyName,
      nip: client.nip || '',
      address: client.address || '',
      city: client.city || '',
      postalCode: client.postalCode || '',
      country: client.country || 'Polska',
      contactPerson: client.contactPerson || '',
      email: client.email || '',
      phone: client.phone || '',
      notes: client.notes || '',
    });
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim()) {
      setFormError(t('common.required'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingClient) {
        await clientService.update(editingClient.id, form);
      } else {
        await clientService.create(form);
      }
      setDialogOpen(false);
      fetchClients();
    } catch {
      setFormError(t('common.errorOccurred'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await clientService.delete(id);
      setConfirmId(null);
      fetchClients();
    } catch {
      setError(t('common.errorOccurred'));
      setConfirmId(null);
    }
  }

  async function handlePermanentDelete() {
    if (!confirmPermanentDelete) return;
    try {
      await clientService.deletePermanent(confirmPermanentDelete.id);
      setConfirmPermanentDelete(null);
      fetchClients();
    } catch (err: any) {
      const message = err?.response?.data?.error as string | undefined;
      setError(message || t('common.errorOccurred'));
      setConfirmPermanentDelete(null);
    }
  }

  async function handleExportCSV() {
    try {
      const csv = await clientService.exportCSV();
      downloadCSV(csv, `klienci_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      setError(t('common.errorOccurred'));
    }
  }

  function updateField(field: keyof ClientForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('clients.title')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            {t('clients.exportCSV')}
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('clients.addClient')}
          </button>
        </div>
      </div>

      {/* Search & activity filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clients.search')}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-10 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
          />
        </div>
        <select
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value as 'active' | 'inactive' | 'all')}
          className="w-full sm:w-52 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
        >
          <option value="active">{t('common.active')}</option>
          <option value="inactive">{t('common.inactive')}</option>
          <option value="all">{t('common.all')}</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSpinner text={t('common.loading')} />
      ) : clients.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">{t('clients.noClients')}</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      {t('clients.companyName')}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      {t('clients.nip')}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      {t('clients.city')}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      {t('clients.contactPerson')}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      {t('clients.email')}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      {t('clients.phone')}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {clients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {client.companyName}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {client.nip || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {client.city || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {client.contactPerson || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {client.email || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {client.phone || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/clients/${client.id}`)}
                            className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            title={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setConfirmId(client.id)}
                              className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                              title={t('admin.deactivate')}
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setConfirmPermanentDelete(client)}
                              className="inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            >
                              {t('clients.deletePermanent')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Confirm deactivate dialog */}
      {confirmId && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('admin.deactivate')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {t('clients.confirmDelete')}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDeactivate(confirmId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                {t('admin.deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm permanent delete dialog */}
      {confirmPermanentDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('clients.deletePermanent')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {t('clients.confirmPermanentDelete', { name: confirmPermanentDelete.companyName })}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmPermanentDelete(null)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handlePermanentDelete}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors"
              >
                {t('clients.deletePermanent')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Dialog header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingClient ? t('clients.editClient') : t('clients.addClient')}
              </h2>
              <button
                onClick={() => setDialogOpen(false)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* companyName */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.companyName')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.companyName}
                    onChange={(e) => updateField('companyName', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                {/* NIP */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.nip')}
                  </label>
                  <input
                    type="text"
                    value={form.nip}
                    onChange={(e) => updateField('nip', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.address')}
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.city')}
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                {/* Postal code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.postalCode')}
                  </label>
                  <input
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => updateField('postalCode', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.country')}
                  </label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                {/* Contact person */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.contactPerson')}
                  </label>
                  <input
                    type="text"
                    value={form.contactPerson}
                    onChange={(e) => updateField('contactPerson', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.email')}
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.phone')}
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('clients.notes')}
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    rows={3}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
