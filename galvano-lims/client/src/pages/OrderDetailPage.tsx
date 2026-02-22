import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Calculator } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { orderService } from '@/services/orderService';
import { sampleService } from '@/services/sampleService';
import { formatDate, formatNumber } from '@/utils/helpers';
import type { Order, OrderStatus, Sample } from '@/types';

const ORDER_STATUSES: OrderStatus[] = ['NEW', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'CANCELLED'];

function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    NEW: 'Nowe',
    IN_PROGRESS: 'W toku',
    COMPLETED: 'Zakonczone',
    INVOICED: 'Zafakturowane',
    CANCELLED: 'Anulowane',
  };
  return labels[status] || status;
}

function statusClass(status: OrderStatus): string {
  if (status === 'NEW') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
  if (status === 'IN_PROGRESS') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200';
  if (status === 'COMPLETED') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
  if (status === 'INVOICED') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [order, setOrder] = useState<Order | null>(null);
  const [availableSamples, setAvailableSamples] = useState<Sample[]>([]);
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [manualAdjustmentNet, setManualAdjustmentNet] = useState('0');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [manualItemDescription, setManualItemDescription] = useState('');
  const [manualItemQuantity, setManualItemQuantity] = useState('1');
  const [manualItemPriceNet, setManualItemPriceNet] = useState('');
  const [addingManualItem, setAddingManualItem] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchOrder() {
    setLoading(true);
    setError('');
    try {
      const data = await orderService.getById(id!);
      setOrder(data);
      setNotes(data.notes || '');
      setManualAdjustmentNet(String(data.manualAdjustmentNet || 0));

      const linkedSampleIds = (data.samples || []).map((s) => s.id);
      setSelectedSampleIds(linkedSampleIds);

      if (data.clientId) {
        const sampleRes = await sampleService.getAll({ clientId: data.clientId, limit: 200 });
        setAvailableSamples(sampleRes.data);
      }
    } catch {
      setError(t('orders.fetchError'));
    } finally {
      setLoading(false);
    }
  }

  const manualItems = useMemo(
    () => (order?.items || []).filter((item) => !item.analysisId),
    [order?.items],
  );

  const autoItems = useMemo(
    () => (order?.items || []).filter((item) => !!item.analysisId),
    [order?.items],
  );

  function toggleSample(sampleId: string) {
    setSelectedSampleIds((prev) =>
      prev.includes(sampleId) ? prev.filter((idValue) => idValue !== sampleId) : [...prev, sampleId],
    );
  }

  async function handleSaveOrder(e: FormEvent) {
    e.preventDefault();
    if (!order) return;

    setSaving(true);
    setError('');
    try {
      const updated = await orderService.update(order.id, {
        sampleIds: selectedSampleIds,
        notes: notes || null,
        manualAdjustmentNet: parseFloat(manualAdjustmentNet) || 0,
      });
      setOrder(updated);
    } catch {
      setError(t('orders.updateError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(nextStatus: OrderStatus) {
    if (!order) return;
    try {
      const updated = await orderService.changeStatus(order.id, nextStatus);
      setOrder((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch {
      setError(t('orders.statusError'));
    }
  }

  async function handleRecalculate() {
    if (!order) return;
    try {
      const recalculated = await orderService.recalculate(order.id);
      setOrder(recalculated);
    } catch {
      setError(t('orders.recalculateError'));
    }
  }

  async function handleAddManualItem(e: FormEvent) {
    e.preventDefault();
    if (!order || !manualItemDescription || !manualItemPriceNet) return;

    setAddingManualItem(true);
    try {
      const updated = await orderService.addManualItem(order.id, {
        description: manualItemDescription,
        quantity: parseFloat(manualItemQuantity) || 1,
        unitPriceNet: parseFloat(manualItemPriceNet),
      });
      setOrder(updated);
      setManualItemDescription('');
      setManualItemQuantity('1');
      setManualItemPriceNet('');
    } catch {
      setError(t('orders.manualItemError'));
    } finally {
      setAddingManualItem(false);
    }
  }

  async function handleRemoveManualItem(itemId: string) {
    if (!order) return;
    try {
      const updated = await orderService.removeManualItem(order.id, itemId);
      setOrder(updated);
    } catch {
      setError(t('orders.manualItemDeleteError'));
    }
  }

  if (loading) {
    return <LoadingSpinner text={t('common.loading')} />;
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/orders')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error || t('orders.noOrders')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/orders')}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{order.orderCode}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{order.client?.companyName || '-'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass(order.status)}`}>
              {statusLabel(order.status)}
            </span>
            <select
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700"
            >
              {ORDER_STATUSES.map((statusValue) => (
                <option key={statusValue} value={statusValue}>{statusLabel(statusValue)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('orders.totalNet')}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatNumber(order.totalNet)} {order.currency}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Pozycje</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{order.items?.length || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.createdAt')}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(order.createdAt)}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveOrder} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{t('orders.editOrder')}</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{t('orders.notesOptional')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{t('orders.manualAdjustmentNet')}</label>
            <input
              type="number"
              step="0.01"
              value={manualAdjustmentNet}
              onChange={(e) => setManualAdjustmentNet(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
          <div className="flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={handleRecalculate}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <Calculator className="h-4 w-4" />
              {t('orders.recalculate')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('orders.samplesInOrder')}</h3>
            <button
              type="button"
              onClick={() => navigate(`/samples?orderId=${order.id}&openCreate=1`)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Dodaj próbkę
            </button>
          </div>
          <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            {availableSamples.map((sample) => (
              <label key={sample.id} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={selectedSampleIds.includes(sample.id)}
                  onChange={() => toggleSample(sample.id)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span>{sample.sampleCode}</span>
              </label>
            ))}
            {availableSamples.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noData')}</p>
            )}
          </div>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{t('orders.autoItems')}</h2>
          <div className="space-y-2">
            {autoItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
                <p className="font-medium text-gray-900 dark:text-white">{item.description}</p>
                <p className="text-gray-500 dark:text-gray-400">{formatNumber(item.lineTotalNet)} {order.currency}</p>
              </div>
            ))}
            {autoItems.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noData')}</p>}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{t('orders.manualItems')}</h2>

          <form onSubmit={handleAddManualItem} className="mb-4 grid grid-cols-1 gap-2">
            <input
              value={manualItemDescription}
              onChange={(e) => setManualItemDescription(e.target.value)}
              placeholder={t('orders.itemDescription')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.001"
                value={manualItemQuantity}
                onChange={(e) => setManualItemQuantity(e.target.value)}
                placeholder={t('orders.quantity')}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
              <input
                type="number"
                step="0.01"
                value={manualItemPriceNet}
                onChange={(e) => setManualItemPriceNet(e.target.value)}
                placeholder={t('orders.unitPriceNet')}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                required
              />
            </div>
            <button
              type="submit"
              disabled={addingManualItem}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {addingManualItem ? t('common.loading') : t('orders.addManualItem')}
            </button>
          </form>

          <div className="space-y-2">
            {manualItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{item.description}</p>
                  <p className="text-gray-500 dark:text-gray-400">{formatNumber(item.lineTotalNet)} {order.currency}</p>
                </div>
                <button
                  onClick={() => handleRemoveManualItem(item.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('common.delete')}
                </button>
              </div>
            ))}
            {manualItems.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noData')}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
