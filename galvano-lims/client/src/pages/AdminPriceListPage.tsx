import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { priceListService, type CreatePriceListItemPayload } from '@/services/priceListService';
import { formatDate, formatNumber } from '@/utils/helpers';
import type { AnalysisPriceListItem } from '@/types';

function toIsoFromDateInput(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toISOString();
}

function fromIsoToDateInput(value?: string | null): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export default function AdminPriceListPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<AnalysisPriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [analysisTypeFilter, setAnalysisTypeFilter] = useState('');

  const [form, setForm] = useState({
    code: '',
    name: '',
    analysisType: 'CHEMICAL',
    description: '',
    unit: 'szt.',
    priceNet: '0',
    vatRate: '23',
    currency: 'PLN',
    isActive: true,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
  });

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchItems() {
    setLoading(true);
    setError('');
    try {
      const response = await priceListService.getAll({ limit: 200, analysisType: analysisTypeFilter || undefined });
      setItems(response.data);
    } catch {
      setError(t('priceList.fetchError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisTypeFilter]);

  const analysisTypes = useMemo(() => {
    const values = new Set(items.map((item) => item.analysisType));
    values.add('CHEMICAL');
    return Array.from(values).sort();
  }, [items]);

  function resetForm() {
    setForm({
      code: '',
      name: '',
      analysisType: 'CHEMICAL',
      description: '',
      unit: 'szt.',
      priceNet: '0',
      vatRate: '23',
      currency: 'PLN',
      isActive: true,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
    });
    setEditingId(null);
  }

  function startCreate() {
    resetForm();
    setShowCreate(true);
  }

  function startEdit(item: AnalysisPriceListItem) {
    setEditingId(item.id);
    setShowCreate(true);
    setForm({
      code: item.code,
      name: item.name,
      analysisType: item.analysisType,
      description: item.description || '',
      unit: item.unit || '',
      priceNet: String(item.priceNet),
      vatRate: String(item.vatRate),
      currency: item.currency,
      isActive: item.isActive,
      effectiveFrom: fromIsoToDateInput(item.effectiveFrom),
      effectiveTo: fromIsoToDateInput(item.effectiveTo),
    });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();

    if (!form.code || !form.name || !form.analysisType || !form.effectiveFrom) {
      setError(t('priceList.requiredFields'));
      return;
    }

    setSaving(true);
    setError('');

    const payload: CreatePriceListItemPayload = {
      code: form.code,
      name: form.name,
      analysisType: form.analysisType,
      description: form.description || undefined,
      unit: form.unit || undefined,
      priceNet: parseFloat(form.priceNet) || 0,
      vatRate: parseFloat(form.vatRate) || 23,
      currency: (form.currency || 'PLN').toUpperCase(),
      isActive: form.isActive,
      effectiveFrom: toIsoFromDateInput(form.effectiveFrom),
      effectiveTo: form.effectiveTo ? toIsoFromDateInput(form.effectiveTo) : null,
    };

    try {
      if (editingId) {
        await priceListService.update(editingId, payload);
      } else {
        await priceListService.create(payload);
      }
      setShowCreate(false);
      resetForm();
      await fetchItems();
    } catch {
      setError(editingId ? t('priceList.updateError') : t('priceList.createError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('priceList.title')}</h1>
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {t('priceList.addItem')}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            value={analysisTypeFilter}
            onChange={(e) => setAnalysisTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
          >
            <option value="">{t('common.all')} - {t('analyses.title')}</option>
            {analysisTypes.map((typeValue) => (
              <option key={typeValue} value={typeValue}>{typeValue}</option>
            ))}
          </select>
          <button onClick={fetchItems} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            {t('common.filter')}
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleSave} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingId ? t('priceList.editItem') : t('priceList.addItem')}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                resetForm();
              }}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <X className="h-3.5 w-3.5" />
              {t('common.close')}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} placeholder={t('priceList.code')} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" required />
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={t('priceList.name')} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" required />
            <input value={form.analysisType} onChange={(e) => setForm((prev) => ({ ...prev, analysisType: e.target.value.toUpperCase() }))} placeholder={t('priceList.analysisType')} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" required />
            <input value={form.priceNet} onChange={(e) => setForm((prev) => ({ ...prev, priceNet: e.target.value }))} type="number" step="0.01" placeholder={t('priceList.priceNet')} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" required />
            <input value={form.vatRate} onChange={(e) => setForm((prev) => ({ ...prev, vatRate: e.target.value }))} type="number" step="0.01" placeholder={t('priceList.vatRate')} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" required />
            <input value={form.currency} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} placeholder={t('priceList.currency')} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" required />
            <input value={form.unit} onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))} placeholder={t('priceList.unit')} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
            <input value={form.effectiveFrom} onChange={(e) => setForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))} type="date" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" required />
            <input value={form.effectiveTo} onChange={(e) => setForm((prev) => ({ ...prev, effectiveTo: e.target.value }))} type="date" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
            <input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t('common.details')} className="md:col-span-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
            <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
              {t('common.active')}
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="p-6"><LoadingSpinner text={t('common.loading')} /></div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">{t('common.noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('priceList.code')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('priceList.name')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('priceList.analysisType')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('priceList.priceNet')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">VAT %</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('priceList.effectiveFrom')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('common.status')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.code}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.name}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.analysisType}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatNumber(item.priceNet)} {item.currency}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatNumber(item.vatRate)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(item.effectiveFrom)}</td>
                    <td className="px-4 py-3">
                      {item.isActive ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-200">{t('common.active')}</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800 dark:bg-gray-900 dark:text-gray-200">{t('common.inactive')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => startEdit(item)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        {t('common.edit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
