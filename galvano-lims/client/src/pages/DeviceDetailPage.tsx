import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarClock, Wrench, Activity, User } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { deviceService } from '@/services/deviceService';
import type { DeviceMaintenanceLog, LabDevice, MaintenanceResult, MaintenanceType } from '@/types';
import { formatDate, formatDateTime } from '@/utils/helpers';

function maintenanceTypeLabel(type: MaintenanceType): string {
  if (type === 'CALIBRATION') return 'Kalibracja';
  if (type === 'INSPECTION') return 'Przeglad';
  return 'Serwis';
}

function deviceStatusLabel(status: LabDevice['status']): string {
  if (status === 'ACTIVE') return 'Aktywne';
  if (status === 'INACTIVE') return 'Nieaktywne';
  if (status === 'OUT_OF_SERVICE') return 'Wylaczone';
  return 'Wycofane';
}

function maintenanceResultClass(result: MaintenanceResult): string {
  if (result === 'PASSED') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
  if (result === 'CONDITIONAL') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [device, setDevice] = useState<LabDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [logType, setLogType] = useState<MaintenanceType>('CALIBRATION');
  const [logResult, setLogResult] = useState<MaintenanceResult>('PASSED');
  const [logNotes, setLogNotes] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 16));
  const [savingLog, setSavingLog] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchDevice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchDevice() {
    setLoading(true);
    setError('');
    try {
      const data = await deviceService.getById(id!);
      setDevice(data);
    } catch {
      setError(t('devices.fetchError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddLog(e: FormEvent) {
    e.preventDefault();
    if (!device) return;

    setSavingLog(true);
    setError('');
    try {
      await deviceService.createMaintenanceLog(device.id, {
        maintenanceType: logType,
        result: logResult,
        notes: logNotes || undefined,
        performedAt: new Date(logDate).toISOString(),
      });

      setLogResult('PASSED');
      setLogNotes('');
      setLogType('CALIBRATION');
      setLogDate(new Date().toISOString().slice(0, 16));
      await fetchDevice();
    } catch {
      setError(t('devices.logError'));
    } finally {
      setSavingLog(false);
    }
  }

  if (loading) {
    return <LoadingSpinner text={t('common.loading')} />;
  }

  if (!device) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/devices')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error || t('devices.noDevices')}
        </div>
      </div>
    );
  }

  const logs = (device.maintenanceLogs || []) as DeviceMaintenanceLog[];

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/devices')}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{device.name}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{device.code} • {device.deviceType}</p>
          </div>
          <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
            {deviceStatusLabel(device.status)}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('devices.manufacturer')}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{device.manufacturer || '-'} {device.model || ''}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('devices.serialNumber')}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{device.serialNumber || '-'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('devices.location')}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{device.location || '-'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('devices.nextCalibration')}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{device.nextCalibrationAt ? formatDate(device.nextCalibrationAt) : '-'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('devices.calibrationInterval')}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{device.calibrationIntervalDays ? `${device.calibrationIntervalDays} d` : '-'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('devices.responsible')}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{device.responsibleUser ? `${device.responsibleUser.firstName} ${device.responsibleUser.lastName}` : '-'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <Wrench className="h-4 w-4" />
          {t('devices.addCalibrationLog')}
        </div>
        <form onSubmit={handleAddLog} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select value={logType} onChange={(e) => setLogType(e.target.value as MaintenanceType)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700">
            <option value="CALIBRATION">Kalibracja</option>
            <option value="INSPECTION">Przeglad</option>
            <option value="SERVICE">Serwis</option>
          </select>
          <select value={logResult} onChange={(e) => setLogResult(e.target.value as MaintenanceResult)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700">
            <option value="PASSED">OK</option>
            <option value="CONDITIONAL">Warunkowo</option>
            <option value="FAILED">NOK</option>
          </select>
          <input type="datetime-local" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
          <button type="submit" disabled={savingLog} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {savingLog ? t('common.loading') : t('common.save')}
          </button>
          <input value={logNotes} onChange={(e) => setLogNotes(e.target.value)} placeholder={t('devices.notesOptional')} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm md:col-span-4 dark:border-gray-600 dark:bg-gray-700" />
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <CalendarClock className="h-5 w-5" />
            {t('devices.maintenanceHistory')}
          </h2>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('common.noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-6 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('common.date')}</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('devices.type')}</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('common.status')}</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('devices.nextCalibration')}</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('common.details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-3 text-gray-700 dark:text-gray-300">{formatDateTime(log.performedAt)}</td>
                    <td className="px-6 py-3 text-gray-700 dark:text-gray-300">
                      <span className="inline-flex items-center gap-1">
                        {log.maintenanceType === 'CALIBRATION' ? <Activity className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                        {maintenanceTypeLabel(log.maintenanceType)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${maintenanceResultClass(log.result)}`}>
                        {log.result}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-700 dark:text-gray-300">{log.nextDueAt ? formatDate(log.nextDueAt) : '-'}</td>
                    <td className="px-6 py-3 text-gray-700 dark:text-gray-300">
                      <div className="flex flex-col gap-1">
                        <span>{log.notes || '-'}</span>
                        {log.performer && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <User className="h-3 w-3" />
                            {log.performer.firstName} {log.performer.lastName}
                          </span>
                        )}
                      </div>
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
