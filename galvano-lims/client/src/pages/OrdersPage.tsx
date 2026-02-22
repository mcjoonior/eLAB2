import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Calculator } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';
import { orderService } from '@/services/orderService';
import { clientService } from '@/services/clientService';
import { formatDate, formatNumber } from '@/utils/helpers';
import type { Client, Order, OrderStatus } from '@/types';

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

export default function OrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');

  const [showCreate, setShowCreate] = useState(false);
  const [createClientId, setCreateClientId] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  useEffect(() => {
    clientService.getAll({ limit: 200, isActive: true }).then((res) => setClients(res.data)).catch(() => {});
  }, []);

  async function fetchOrders() {
    setLoading(true);
    setError('');
    try {
      const response = await orderService.getAll({
        page,
        limit,
        status: status || undefined,
        search: search.trim() || undefined,
      });
      setOrders(response.data);
      setTotal(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch {
      setError(t('orders.fetchError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!createClientId) return;
    setCreateLoading(true);
    try {
      await orderService.create({
        clientId: createClientId,
        notes: createNotes || undefined,
      });
      setShowCreate(false);
      setCreateClientId('');
      setCreateNotes('');
      setPage(1);
      await fetchOrders();
    } catch {
      setError(t('orders.createError'));
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleRecalculate(orderId: string) {
    try {
      await orderService.recalculate(orderId);
      await fetchOrders();
    } catch {
      setError(t('orders.recalculateError'));
    }
  }

  async function handleStatusChange(orderId: string, nextStatus: OrderStatus) {
    try {
      await orderService.changeStatus(orderId, nextStatus);
      await fetchOrders();
    } catch {
      setError(t('orders.statusError'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('orders.title')}</h1>
        <button
          onClick={() => setShowCreate((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {t('orders.addOrder')}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              value={createClientId}
              onChange={(e) => setCreateClientId(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              required
            >
              <option value="">{t('orders.selectClient')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
            <input
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              placeholder={t('orders.notesOptional')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
            <button
              type="submit"
              disabled={createLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {createLoading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('orders.search')}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as OrderStatus | ''); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
          >
            <option value="">{t('common.all')} - {t('common.status')}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          <button onClick={fetchOrders} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            {t('common.filter')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="p-6"><LoadingSpinner text={t('common.loading')} /></div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">{t('orders.noOrders')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('orders.orderCode')}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('samples.client')}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('common.status')}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('orders.totalNet')}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('common.createdAt')}</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{order.orderCode}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{order.client?.companyName || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{formatNumber(order.totalNet)} {order.currency}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(order.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRecalculate(order.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                          >
                            <Calculator className="h-3.5 w-3.5" />
                            {t('orders.recalculate')}
                          </button>
                          <select
                            value={order.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700"
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s} value={s}>{statusLabel(s)}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 pb-2">
              <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
