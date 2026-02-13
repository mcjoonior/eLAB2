import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { processService } from '@/services/processService';
import { getProcessTypeLabel, formatDate, formatNumber } from '@/utils/helpers';
import type { Process, ProcessType, ProcessTypeDefinition } from '@/types';

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    (error as any).response?.data?.error &&
    typeof (error as any).response.data.error === 'string'
  ) {
    return (error as any).response.data.error;
  }

  return fallback;
}

interface ParameterRow {
  id?: string;
  parameterName: string;
  unit: string;
  minValue: string;
  maxValue: string;
  optimalValue: string;
  sortOrder: number;
}

export default function ProcessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [process, setProcess] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [processTypes, setProcessTypes] = useState<ProcessTypeDefinition[]>([]);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formProcessType, setFormProcessType] = useState<ProcessType>('');
  const [formParameters, setFormParameters] = useState<ParameterRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const processTypeLabels = useMemo(
    () => Object.fromEntries(processTypes.map((type) => [type.code, type.name])),
    [processTypes]
  );

  const selectableProcessTypes = useMemo(() => {
    const activeTypes = processTypes.filter((type) => type.isActive);
    if (formProcessType && !activeTypes.some((type) => type.code === formProcessType)) {
      const current = processTypes.find((type) => type.code === formProcessType);
      if (current) {
        return [...activeTypes, current].sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
      }
    }

    return activeTypes.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  }, [formProcessType, processTypes]);

  function getTypeLabel(code: string): string {
    return processTypeLabels[code] || getProcessTypeLabel(code);
  }

  useEffect(() => {
    if (id) {
      fetchProcess();
      fetchTypes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchTypes() {
    try {
      const types = await processService.getTypes({ all: true });
      setProcessTypes(types);
    } catch {
      // Ignore type loading error here; process details can still be displayed.
    }
  }

  async function fetchProcess() {
    setLoading(true);
    setError('');
    try {
      const data = await processService.getById(id!);
      setProcess(data);
      populateForm(data);
    } catch {
      setError('Nie udało się pobrać szczegółów procesu.');
    } finally {
      setLoading(false);
    }
  }

  function populateForm(p: Process) {
    setFormName(p.name);
    setFormDescription(p.description || '');
    setFormProcessType(p.processType);
    if (p.parameters && p.parameters.length > 0) {
      setFormParameters(
        p.parameters
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((param) => ({
            id: param.id,
            parameterName: param.parameterName,
            unit: param.unit,
            minValue: param.minValue != null ? String(param.minValue) : '',
            maxValue: param.maxValue != null ? String(param.maxValue) : '',
            optimalValue: param.optimalValue != null ? String(param.optimalValue) : '',
            sortOrder: param.sortOrder,
          }))
      );
    } else {
      setFormParameters([]);
    }
  }

  function addParameterRow() {
    setFormParameters((prev) => [
      ...prev,
      {
        parameterName: '',
        unit: '',
        minValue: '',
        maxValue: '',
        optimalValue: '',
        sortOrder: prev.length + 1,
      },
    ]);
  }

  function removeParameterRow(index: number) {
    setFormParameters((prev) => prev.filter((_, i) => i !== index));
  }

  function updateParameter(index: number, field: keyof ParameterRow, value: string) {
    setFormParameters((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      setSaveError('Nazwa procesu jest wymagana.');
      return;
    }
    if (!formProcessType) {
      setSaveError('Typ procesu jest wymagany.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      const validParams = formParameters
        .filter((p) => p.parameterName.trim())
        .map((p, i) => ({
          parameterName: p.parameterName.trim(),
          unit: p.unit.trim(),
          minValue: p.minValue ? parseFloat(p.minValue) : undefined,
          maxValue: p.maxValue ? parseFloat(p.maxValue) : undefined,
          optimalValue: p.optimalValue ? parseFloat(p.optimalValue) : undefined,
          sortOrder: i + 1,
        }));

      const updated = await processService.update(id!, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        processType: formProcessType,
        parameters: validParams as any,
      });
      setProcess(updated);
      populateForm(updated);
      setEditing(false);
      setSaveSuccess('Proces został zapisany pomyślnie.');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Nie udało się zapisać zmian. Spróbuj ponownie.'));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (process) populateForm(process);
    setEditing(false);
    setSaveError('');
  }

  if (loading) {
    return <LoadingSpinner text="Ładowanie procesu..." />;
  }

  if (error || !process) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/processes')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Powrót do listy procesów
        </button>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          {error || 'Nie znaleziono procesu.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/processes')}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Powrót do listy procesów
      </button>

      {/* Success */}
      {saveSuccess && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-400">
          {saveSuccess}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{process.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {getTypeLabel(process.processType)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Utworzono: {formatDate(process.createdAt)}
              </span>
              {process.isActive ? (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Aktywny
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                  Nieaktywny
                </span>
              )}
            </div>
            {process.description && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{process.description}</p>
            )}
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Edytuj
            </button>
          )}
        </div>
      </div>

      {/* Edit form or Parameters table */}
      {editing ? (
        <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          {saveError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Nazwa procesu *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Typ procesu *
              </label>
              <select
                value={formProcessType}
                onChange={(e) => setFormProcessType(e.target.value as ProcessType)}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                required
              >
                {selectableProcessTypes.map((pt) => (
                  <option key={pt.id} value={pt.code}>{pt.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Opis
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
            />
          </div>

          {/* Parameters editor */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Parametry procesu
              </label>
              <button
                type="button"
                onClick={addParameterRow}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Plus className="h-3 w-3" />
                Dodaj parametr
              </button>
            </div>

            {formParameters.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                Brak parametrów. Kliknij "Dodaj parametr" aby dodać.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Nazwa</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Jednostka</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Min</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Max</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Optymalny</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formParameters.map((param, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="px-2 py-1.5">
                          <input type="text" value={param.parameterName} onChange={(e) => updateParameter(index, 'parameterName', e.target.value)} placeholder="Nazwa" className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" value={param.unit} onChange={(e) => updateParameter(index, 'unit', e.target.value)} placeholder="Jednostka" className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="any" value={param.minValue} onChange={(e) => updateParameter(index, 'minValue', e.target.value)} placeholder="Min" className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="any" value={param.maxValue} onChange={(e) => updateParameter(index, 'maxValue', e.target.value)} placeholder="Max" className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="any" value={param.optimalValue} onChange={(e) => updateParameter(index, 'optimalValue', e.target.value)} placeholder="Optymalny" className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none" />
                        </td>
                        <td className="px-2 py-1.5">
                          <button type="button" onClick={() => removeParameterRow(index)} className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={handleCancel} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
              Zapisz zmiany
            </button>
          </div>
        </form>
      ) : (
        /* Read-only parameters table */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Parametry procesu ({process.parameters?.length ?? 0})
            </h2>
          </div>
          {!process.parameters || process.parameters.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Brak zdefiniowanych parametrów dla tego procesu.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">#</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Nazwa parametru</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Jednostka</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Min</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Max</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Optymalny</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {process.parameters
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((param, index) => (
                      <tr key={param.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{param.parameterName}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{param.unit || '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          {param.minValue != null ? formatNumber(param.minValue) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          {param.maxValue != null ? formatNumber(param.maxValue) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          {param.optimalValue != null ? formatNumber(param.optimalValue) : '-'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
