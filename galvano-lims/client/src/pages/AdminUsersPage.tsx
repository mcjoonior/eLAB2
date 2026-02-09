import { useState, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/adminService';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { User, UserRole } from '@/types';
import { formatDate } from '@/utils/helpers';
import { Plus, Edit2, UserX, X, Shield, Microscope, Eye } from 'lucide-react';

const ROLES: { value: UserRole; label: string; color: string; icon: typeof Shield }[] = [
  { value: 'ADMIN', label: 'Administrator', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: Shield },
  { value: 'LABORANT', label: 'Laborant', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Microscope },
  { value: 'VIEWER', label: 'Obserwator', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', icon: Eye },
];

function getRoleBadge(role: UserRole) {
  const r = ROLES.find((x) => x.value === role);
  return r ? { color: r.color, label: r.label } : { color: 'bg-gray-100 text-gray-800', label: role };
}

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', role: 'LABORANT' as string,
  });

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const response = await adminService.getUsers();
      setUsers((response as any).data || response);
    } catch { setError('Nie udało się pobrać użytkowników.'); }
    finally { setLoading(false); }
  }

  function openAdd() {
    setEditingUser(null);
    setForm({ email: '', password: '', firstName: '', lastName: '', role: 'LABORANT' });
    setShowDialog(true);
    setError('');
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setForm({ email: user.email, password: '', firstName: user.firstName, lastName: user.lastName, role: user.role });
    setShowDialog(true);
    setError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingUser) {
        await adminService.updateUser(editingUser.id, {
          firstName: form.firstName, lastName: form.lastName, role: form.role as UserRole,
        });
      } else {
        await adminService.createUser(form);
      }
      setShowDialog(false);
      fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Wystąpił błąd podczas zapisywania.');
    } finally { setSaving(false); }
  }

  async function handleDeactivate(user: User) {
    if (!confirm(`Czy na pewno chcesz dezaktywować użytkownika ${user.firstName} ${user.lastName}?`)) return;
    try {
      await adminService.deactivateUser(user.id);
      fetchUsers();
    } catch { alert('Nie udało się dezaktywować użytkownika.'); }
  }

  if (loading) return <LoadingSpinner text="Ładowanie użytkowników..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin.users')}</h1>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> {t('admin.addUser')}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Imię</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Nazwisko</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Rola</th>
                <th className="text-center px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Aktywny</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Utworzono</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => {
                const badge = getRoleBadge(user.role);
                return (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{user.email}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{user.firstName}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{user.lastName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.isActive ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" /> : <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(user)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title="Edytuj">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {user.isActive && (
                          <button onClick={() => handleDeactivate(user)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600" title="Dezaktywuj">
                            <UserX className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDialog(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingUser ? t('admin.editUser') : t('admin.addUser')}
              </h2>
              <button onClick={() => setShowDialog(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editingUser}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white disabled:opacity-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hasło *</label>
                  <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Imię *</label>
                  <input type="text" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nazwisko *</label>
                  <input type="text" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rola *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowDialog(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
