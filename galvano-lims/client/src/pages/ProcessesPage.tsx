import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Filter, Edit2, Copy, XCircle, X, Trash2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';
import { processService } from '@/services/processService';
import { useAuthStore } from '@/store/authStore';
import { getProcessTypeLabel } from '@/utils/helpers';
import type { Process, ProcessType, ProcessTypeDefinition } from '@/types';

const PROCESS_TYPE_COLOR_MAP: Record<string, string> = {
  ZINC: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  NICKEL: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CHROME: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  COPPER: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  TIN: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  GOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  SILVER: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  ANODIZING: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  PASSIVATION: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

function getProcessTypeColor(type: ProcessType): string {
  return PROCESS_TYPE_COLOR_MAP[type] || PROCESS_TYPE_COLOR_MAP.OTHER;
}

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
  parameterName: string;
  unit: string;
  minValue: string;
  maxValue: string;
  optimalValue: string;
  sortOrder: number;
}

const emptyParameter: ParameterRow = {
  parameterName: '',
  unit: '',
  minValue: '',
  maxValue: '',
  optimalValue: '',
  sortOrder: 0,
};

export default function ProcessesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [processTypes, setProcessTypes] = useState<ProcessTypeDefinition[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filter
  const [filterType, setFilterType] = useState<ProcessType | ''>('');

  // Create/Edit process dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formProcessType, setFormProcessType] = useState<ProcessType>('');
  const [formParameters, setFormParameters] = useState<ParameterRow[]>([{ ...emptyParameter, sortOrder: 1 }]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Clone dialog
  const [cloneProcess, setCloneProcess] = useState<Process | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloning, setCloning] = useState(false);

  // Deactivate confirm
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  // Process type management (admin)
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeCode, setTypeCode] = useState('');
  const [typeName, setTypeName] = useState('');
  const [typeIsActive, setTypeIsActive] = useState(true);
  const [typeSortOrder, setTypeSortOrder] = useState(0);
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeFormError, setTypeFormError] = useState('');

  const activeProcessTypes = useMemo(
    () => processTypes.filter((type) => type.isActive),
    [processTypes]
  );

  const processTypeLabels = useMemo(
    () => Object.fromEntries(processTypes.map((type) => [type.code, type.name])),
    [processTypes]
  );

  const selectableProcessTypes = useMemo(() => {
    const result = [...activeProcessTypes];

    if (formProcessType && !result.some((type) => type.code === formProcessType)) {
      const found = processTypes.find((type) => type.code === formProcessType);
      if (found) result.push(found);
    }

    return result.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  }, [activeProcessTypes, formProcessType, processTypes]);

  function getTypeLabel(code: string): string {
    return processTypeLabels[code] || getProcessTypeLabel(code);
  }

  function resetTypeForm() {
    setEditingTypeId(null);
    setTypeCode('');
    setTypeName('');
    setTypeIsActive(true);
    setTypeSortOrder(processTypes.length + 1);
    setTypeFormError('');
    setTypeFormOpen(false);
  }

  function openTypeCreateForm() {
    setEditingTypeId(null);
    setTypeCode('');
    setTypeName('');
    setTypeIsActive(true);
    setTypeSortOrder(processTypes.length + 1);
    setTypeFormError('');
    setTypeFormOpen(true);
  }

  function openTypeEditForm(type: ProcessTypeDefinition) {
    setEditingTypeId(type.id);
    setTypeCode(type.code);
    setTypeName(type.name);
    setTypeIsActive(type.isActive);
    setTypeSortOrder(type.sortOrder);
    setTypeFormError('');
    setTypeFormOpen(true);
  }

  useEffect(() => {
    fetchProcessTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    fetchProcesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterType]);

  async function fetchProcessTypes() {
    setTypesLoading(true);
    setTypesError('');
    try {
      const types = await processService.getTypes({ all: isAdmin });
      setProcessTypes(types);

      if (!formProcessType && types.length > 0) {
        const defaultType = types.find((type) => type.isActive) || types[0];
        setFormProcessType(defaultType.code);
      }
    } catch (err) {
      setTypesError(getErrorMessage(err, 'Nie udało się pobrać typów procesów.'));
    } finally {
      setTypesLoading(false);
    }
  }

  async function fetchProcesses() {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit };
      if (filterType) params.processType = filterType;
      const res = await processService.getAll(params);
      setProcesses(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(getErrorMessage(err, 'Nie udało się pobrać listy procesów. Spróbuj ponownie.'));
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingProcess(null);
    setFormName('');
    setFormDescription('');
    setFormProcessType(activeProcessTypes[0]?.code || '');
    setFormParameters([{ ...emptyParameter, sortOrder: 1 }]);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(process: Process) {
    setEditingProcess(process);
    setFormName(process.name);
    setFormDescription(process.description || '');
    setFormProcessType(process.processType);
    if (process.parameters && process.parameters.length > 0) {
      setFormParameters(
        process.parameters.map((p) => ({
          parameterName: p.parameterName,
          unit: p.unit,
          minValue: p.minValue != null ? String(p.minValue) : '',
          maxValue: p.maxValue != null ? String(p.maxValue) : '',
          optimalValue: p.optimalValue != null ? String(p.optimalValue) : '',
          sortOrder: p.sortOrder,
        }))
      );
    } else {
      setFormParameters([{ ...emptyParameter, sortOrder: 1 }]);
    }
    setFormError('');
    setDialogOpen(true);
  }

  function addParameterRow() {
    setFormParameters((prev) => [
      ...prev,
      { ...emptyParameter, sortOrder: prev.length + 1 },
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Nazwa procesu jest wymagana.');
      return;
    }

    if (!formProcessType) {
      setFormError('Typ procesu jest wymagany.');
      return;
    }

    setSaving(true);
    setFormError('');
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

      const data: any = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        processType: formProcessType,
        parameters: validParams,
      };

      if (editingProcess) {
        await processService.update(editingProcess.id, data);
      } else {
        await processService.create(data);
      }
      setDialogOpen(false);
      fetchProcesses();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Nie udało się zapisać procesu. Spróbuj ponownie.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleClone() {
    if (!cloneProcess || !cloneName.trim()) return;
    setCloning(true);
    try {
      await processService.clone(cloneProcess.id, cloneName.trim());
      setCloneProcess(null);
      setCloneName('');
      fetchProcesses();
    } catch (err) {
      setError(getErrorMessage(err, 'Nie udało się sklonować procesu.'));
    } finally {
      setCloning(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await processService.delete(id);
      setDeactivateId(null);
      fetchProcesses();
    } catch (err) {
      setError(getErrorMessage(err, 'Nie udało się dezaktywować procesu.'));
      setDeactivateId(null);
    }
  }

  async function handleTypeSubmit(e: FormEvent) {
    e.preventDefault();

    if (!typeCode.trim() || !typeName.trim()) {
      setTypeFormError('Kod i nazwa typu procesu są wymagane.');
      return;
    }

    setTypeSaving(true);
    setTypeFormError('');
    try {
      if (editingTypeId) {
        await processService.updateType(editingTypeId, {
          code: typeCode.trim(),
          name: typeName.trim(),
          isActive: typeIsActive,
          sortOrder: typeSortOrder,
        });
      } else {
        await processService.createType({
          code: typeCode.trim(),
          name: typeName.trim(),
          isActive: typeIsActive,
          sortOrder: typeSortOrder,
        });
      }

      resetTypeForm();
      fetchProcessTypes();
      fetchProcesses();
    } catch (err) {
      setTypeFormError(getErrorMessage(err, 'Nie udało się zapisać typu procesu.'));
    } finally {
      setTypeSaving(false);
    }
  }

  async function handleTypeDelete(type: ProcessTypeDefinition) {
    const confirmed = window.confirm(`Czy na pewno chcesz usunąć typ procesu \"${type.name}\"?`);
    if (!confirmed) return;

    try {
      await processService.deleteType(type.id);
      if (filterType === type.code) {
        setFilterType('');
        setPage(1);
      }
      fetchProcessTypes();
      fetchProcesses();
    } catch (err) {
      setError(getErrorMessage(err, 'Nie udało się usunąć typu procesu.'));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Procesy galwaniczne
        </h1>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Dodaj proces
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.filter')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value as ProcessType | ''); setPage(1); }}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="">Wszystkie typy</option>
            {activeProcessTypes.map((pt) => (
              <option key={pt.id} value={pt.code}>{pt.name}</option>
            ))}
          </select>
        </div>
        {filterType && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => { setFilterType(''); setPage(1); }}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-3 w-3" />
              {t('common.reset')}
            </button>
          </div>
        )}
      </div>

      {/* Process type management */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Typy procesów</h2>
            <button
              onClick={typeFormOpen && !editingTypeId ? () => setTypeFormOpen(false) : openTypeCreateForm}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {typeFormOpen && !editingTypeId ? 'Zamknij formularz' : 'Dodaj typ'}
            </button>
          </div>

          {typesError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
              {typesError}
            </div>
          )}

          {typeFormOpen && (
            <form onSubmit={handleTypeSubmit} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              {typeFormError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                  {typeFormError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kod *</label>
                  <input
                    type="text"
                    value={typeCode}
                    onChange={(e) => setTypeCode(e.target.value)}
                    placeholder="np. ZINC"
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nazwa *</label>
                  <input
                    type="text"
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    placeholder="np. Cynkowanie"
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kolejność</label>
                  <input
                    type="number"
                    value={typeSortOrder}
                    onChange={(e) => setTypeSortOrder(parseInt(e.target.value, 10) || 0)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={typeIsActive}
                      onChange={(e) => setTypeIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Aktywny
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetTypeForm}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={typeSaving}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {editingTypeId ? 'Zapisz typ' : 'Dodaj typ'}
                </button>
              </div>
            </form>
          )}

          {typesLoading ? (
            <LoadingSpinner text="Ładowanie typów procesów..." />
          ) : processTypes.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Brak zdefiniowanych typów procesów.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                    <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Kod</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Nazwa</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Kolejność</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {processTypes.map((type) => (
                    <tr key={type.id}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{type.code}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{type.name}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{type.sortOrder}</td>
                      <td className="px-3 py-2">
                        {type.isActive ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Aktywny</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Nieaktywny</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openTypeEditForm(type)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edytuj
                          </button>
                          <button
                            onClick={() => handleTypeDelete(type)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                          >
                            <Trash2 className="h-3 w-3" />
                            Usuń
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
      ) : processes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">Nie znaleziono procesów.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Nazwa</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Typ</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Opis</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Liczba parametrów</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {processes.map((process) => (
                  <tr
                    key={process.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {process.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getProcessTypeColor(process.processType)}`}>
                        {getTypeLabel(process.processType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {process.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {process.parameters?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/processes/${process.id}`)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                          title="Edytuj"
                        >
                          <Edit2 className="h-3 w-3" />
                          Edytuj
                        </button>
                        <button
                          onClick={() => { setCloneProcess(process); setCloneName(process.name + ' (kopia)'); }}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                          title="Klonuj"
                        >
                          <Copy className="h-3 w-3" />
                          Klonuj
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDeactivateId(process.id)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                            title={t('common.delete')}
                          >
                            <XCircle className="h-3 w-3" />
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

      {/* Clone Dialog */}
      {cloneProcess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setCloneProcess(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Klonuj proces
              </h2>
              <button onClick={() => setCloneProcess(null)} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Klonujesz proces: <strong>{cloneProcess.name}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Nazwa nowego procesu *
              </label>
              <input
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setCloneProcess(null)}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleClone}
                disabled={cloning || !cloneName.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {cloning && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Klonuj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirm Dialog */}
      {deactivateId && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Usunięcie procesu
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Czy na pewno chcesz usunąć ten proces? Operacja jest nieodwracalna.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeactivateId(null)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDeactivate(deactivateId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDialogOpen(false)} />
          <div className="relative z-10 w-full max-w-3xl rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingProcess ? 'Edytuj proces' : 'Dodaj nowy proces'}
              </h2>
              <button onClick={() => setDialogOpen(false)} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                  {formError}
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
                  placeholder="Opcjonalny opis procesu..."
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
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <Plus className="h-3 w-3" />
                    Dodaj parametr
                  </button>
                </div>

                <div className="space-y-2">
                  {formParameters.map((param, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <input
                          type="text"
                          value={param.parameterName}
                          onChange={(e) => updateParameter(index, 'parameterName', e.target.value)}
                          placeholder="Nazwa parametru"
                          className="col-span-2 sm:col-span-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={param.unit}
                          onChange={(e) => updateParameter(index, 'unit', e.target.value)}
                          placeholder="Jednostka"
                          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                        />
                        <input
                          type="number"
                          step="any"
                          value={param.minValue}
                          onChange={(e) => updateParameter(index, 'minValue', e.target.value)}
                          placeholder="Min"
                          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                        />
                        <input
                          type="number"
                          step="any"
                          value={param.maxValue}
                          onChange={(e) => updateParameter(index, 'maxValue', e.target.value)}
                          placeholder="Max"
                          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                        />
                        <input
                          type="number"
                          step="any"
                          value={param.optimalValue}
                          onChange={(e) => updateParameter(index, 'optimalValue', e.target.value)}
                          placeholder="Optymalny"
                          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeParameterRow(index)}
                        className="mt-1 p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {saving && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editingProcess ? 'Zapisz zmiany' : 'Dodaj proces'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
