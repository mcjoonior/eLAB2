import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Wrench, CalendarClock, AlertTriangle, Plus } from 'lucide-react';
import { Pagination } from '@/components/common/Pagination';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { deviceService } from '@/services/deviceService';
import type { DeviceStatus, LabDevice, MaintenanceResult } from '@/types';
import { formatDate } from '@/utils/helpers';

const DEVICE_STATUSES: DeviceStatus[] = ['ACTIVE', 'INACTIVE', 'OUT_OF_SERVICE', 'RETIRED'];

function getDeviceStatusLabel(status: DeviceStatus): string {
  const labels: Record<DeviceStatus, string> = {
    ACTIVE: 'Aktywne',
    INACTIVE: 'Nieaktywne',
    OUT_OF_SERVICE: 'Wyłączone',
    RETIRED: 'Wycofane',
  };
  return labels[status] || status;
}

function getDeviceStatusClass(status: DeviceStatus): string {
  if (status === 'ACTIVE') return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200';
  if (status === 'OUT_OF_SERVICE') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200';
  if (status === 'RETIRED') return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
}

function isOverdue(date?: string | null): boolean {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}

export default function DevicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [devices, setDevices] = useState<LabDevice[]>([]);
  const [upcoming, setUpcoming] = useState<LabDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  const [status, setStatus] = useState<DeviceStatus | ''>('');
  const [search, setSearch] = useState('');
  const [dueMode, setDueMode] = useState<'all' | 'overdue' | '30days'>('all');

  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newDevice, setNewDevice] = useState({
    code: '',
    name: '',
    deviceType: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    location: '',
    calibrationIntervalDays: '180',
  });

  const [logDeviceId, setLogDeviceId] = useState('');
  const [logResult, setLogResult] = useState<MaintenanceResult>('PASSED');
  const [logNotes, setLogNotes] = useState('');
  const [logLoading, setLogLoading] = useState(false);

  useEffect(() => {
    fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, dueMode]);

  useEffect(() => {
    fetchUpcoming();
  }, []);

  async function fetchDevices() {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit };
      if (status) params.status = status;
      if (search.trim()) params.search = search.trim();
      if (dueMode === 'overdue') params.overdueOnly = true;
      if (dueMode === '30days') params.dueWithinDays = 30;

      const response = await deviceService.getAll(params);
      setDevices(response.data);
      setTotal(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch {
      setError(t('devices.fetchError'));
    } finally {
      setLoading(false);
    }
  }

  async function fetchUpcoming() {
    try {
      const response = await deviceService.getUpcomingMaintenance(30);
      setUpcoming(response.data.slice(0, 6));
    } catch {
      setUpcoming([]);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newDevice.code || !newDevice.name || !newDevice.deviceType) {
      setCreateError(t('devices.requiredFields'));
      return;
    }

    setCreateLoading(true);
    setCreateError('');
    try {
      await deviceService.create({
        code: newDevice.code,
        name: newDevice.name,
        deviceType: newDevice.deviceType,
        manufacturer: newDevice.manufacturer || undefined,
        model: newDevice.model || undefined,
        serialNumber: newDevice.serialNumber || undefined,
        location: newDevice.location || undefined,
        status: 'ACTIVE',
        requiresCalibration: true,
        calibrationIntervalDays: parseInt(newDevice.calibrationIntervalDays, 10) || 180,
      });

      setShowCreate(false);
      setNewDevice({
        code: '',
        name: '',
        deviceType: '',
        manufacturer: '',
        model: '',
        serialNumber: '',
        location: '',
        calibrationIntervalDays: '180',
      });
      setPage(1);
      await Promise.all([fetchDevices(), fetchUpcoming()]);
    } catch {
      setCreateError(t('devices.createError'));
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleAddCalibration(deviceId: string) {
    setLogLoading(true);
    try {
      await deviceService.createMaintenanceLog(deviceId, {
        maintenanceType: 'CALIBRATION',
        result: logResult,
        notes: logNotes || undefined,
      });
      setLogDeviceId('');
      setLogNotes('');
      setLogResult('PASSED');
      await Promise.all([fetchDevices(), fetchUpcoming()]);
    } catch {
      setError(t('devices.logError'));
    } finally {
      setLogLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('devices.title')}</h1>
        <button
          onClick={() => setShowCreate((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('devices.addDevice')}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <input value={newDevice.code} onChange={(e) => setNewDevice((p) => ({ ...p, code: e.target.value }))} placeholder={t('devices.code')} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
          <input value={newDevice.name} onChange={(e) => setNewDevice((p) => ({ ...p, name: e.target.value }))} placeholder={t('devices.name')} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
          <input value={newDevice.deviceType} onChange={(e) => setNewDevice((p) => ({ ...p, deviceType: e.target.value }))} placeholder={t('devices.type')} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
          <input value={newDevice.manufacturer} onChange={(e) => setNewDevice((p) => ({ ...p, manufacturer: e.target.value }))} placeholder={t('devices.manufacturer')} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
          <input value={newDevice.model} onChange={(e) => setNewDevice((p) => ({ ...p, model: e.target.value }))} placeholder={t('devices.model')} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
          <input value={newDevice.serialNumber} onChange={(e) => setNewDevice((p) => ({ ...p, serialNumber: e.target.value }))} placeholder={t('devices.serialNumber')} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
          <input value={newDevice.location} onChange={(e) => setNewDevice((p) => ({ ...p, location: e.target.value }))} placeholder={t('devices.location')} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
          <input value={newDevice.calibrationIntervalDays} onChange={(e) => setNewDevice((p) => ({ ...p, calibrationIntervalDays: e.target.value }))} type="number" min={1} placeholder={t('devices.calibrationInterval')} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
          <div className="flex items-center justify-end md:col-span-1">
            <button type="submit" disabled={createLoading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {createLoading ? t('common.loading') : t('common.save')}
            </button>
          </div>
          {createError && <p className="md:col-span-3 text-sm text-red-600 dark:text-red-400">{createError}</p>}
        </form>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('devices.search')}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
          />
          <select value={status} onChange={(e) => { setStatus(e.target.value as DeviceStatus | ''); setPage(1); }} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
            <option value="">{t('common.all')} - {t('common.status')}</option>
            {DEVICE_STATUSES.map((s) => (<option key={s} value={s}>{getDeviceStatusLabel(s)}</option>))}
          </select>
          <select value={dueMode} onChange={(e) => { setDueMode(e.target.value as 'all' | 'overdue' | '30days'); setPage(1); }} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
            <option value="all">{t('devices.filterAll')}</option>
            <option value="overdue">{t('devices.filterOverdue')}</option>
            <option value="30days">{t('devices.filter30Days')}</option>
          </select>
          <button onClick={() => { setPage(1); fetchDevices(); }} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            {t('common.filter')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <CalendarClock className="h-4 w-4" />
          {t('devices.upcoming')}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('devices.noUpcoming')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcoming.map((item) => {
              const calibrationLate = isOverdue(item.nextCalibrationAt);
              const inspectionLate = isOverdue(item.nextInspectionAt);
              return (
                <div key={item.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                    {(calibrationLate || inspectionLate) && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.code} • {item.location || '-'}</p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                    {t('devices.nextCalibration')}: {item.nextCalibrationAt ? formatDate(item.nextCalibrationAt) : '-'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {loading ? (
          <div className="p-6"><LoadingSpinner text={t('common.loading')} /></div>
        ) : devices.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">{t('devices.noDevices')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('devices.code')}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('devices.name')}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('devices.type')}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('common.status')}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('devices.nextCalibration')}</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {devices.map((device) => {
                    const overdue = isOverdue(device.nextCalibrationAt);
                    return (
                      <tr
                        key={device.id}
                        onClick={() => navigate(`/devices/${device.id}`)}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
                      >
                        <td className="px-4 py-3">{device.code}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{device.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{device.manufacturer || '-'} {device.model || ''}</div>
                        </td>
                        <td className="px-4 py-3">{device.deviceType}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getDeviceStatusClass(device.status)}`}>
                            {getDeviceStatusLabel(device.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={overdue ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
                            {device.nextCalibrationAt ? formatDate(device.nextCalibrationAt) : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLogDeviceId((prev) => (prev === device.id ? '' : device.id));
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            {t('devices.addCalibrationLog')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 pb-2">
              <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {logDeviceId && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
          <h2 className="mb-3 text-sm font-semibold text-blue-900 dark:text-blue-100">{t('devices.addCalibrationLog')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={logResult} onChange={(e) => setLogResult(e.target.value as MaintenanceResult)} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm dark:border-blue-800 dark:bg-gray-800">
              <option value="PASSED">OK</option>
              <option value="FAILED">NOK</option>
              <option value="CONDITIONAL">Warunkowo</option>
            </select>
            <input value={logNotes} onChange={(e) => setLogNotes(e.target.value)} placeholder={t('devices.notesOptional')} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm dark:border-blue-800 dark:bg-gray-800" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setLogDeviceId('')} className="rounded-lg border border-blue-300 px-3 py-2 text-sm">{t('common.cancel')}</button>
              <button onClick={() => handleAddCalibration(logDeviceId)} disabled={logLoading} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {logLoading ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
