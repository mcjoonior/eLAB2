import { useState, useEffect, useRef, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/adminService';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { CompanySettings } from '@/types';
import { Building2, Mail, FileText, Save, TestTube2, CheckCircle, XCircle, Upload, Trash2, ImageIcon } from 'lucide-react';

type Tab = 'company' | 'smtp' | 'reports';

export default function AdminSettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('company');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpResult, setSmtpResult] = useState<{ success: boolean; message: string } | null>(null);

  // Logo upload
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const data = await adminService.getSettings();
      setSettings(data);
    } catch { setError('Nie udało się pobrać ustawień.'); }
    finally { setLoading(false); }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const updated = await adminService.updateSettings(settings);
      setSettings(updated);
      setSuccess('Ustawienia zostały zapisane pomyślnie.');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Nie udało się zapisać ustawień.'); }
    finally { setSaving(false); }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError('');
    try {
      const result = await adminService.uploadLogo(file);
      setSettings((prev) => prev ? { ...prev, logoUrl: result.logoUrl } : prev);
      setSuccess('Logo zostało przesłane pomyślnie.');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Nie udało się przesłać logo. Dozwolone formaty: PNG, JPG, JPEG (max 5MB).');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleRemoveLogo() {
    setSettings((prev) => prev ? { ...prev, logoUrl: undefined } : prev);
  }

  async function handleTestSmtp() {
    setTestingSmtp(true); setSmtpResult(null);
    try {
      const result = await adminService.testSmtp();
      setSmtpResult(result);
    } catch (err: any) {
      setSmtpResult({ success: false, message: err?.response?.data?.message || 'Błąd testu SMTP' });
    } finally { setTestingSmtp(false); }
  }

  function updateField(field: keyof CompanySettings, value: any) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  }

  if (loading) return <LoadingSpinner text="Ładowanie ustawień..." />;
  if (!settings) return <div className="text-center text-red-500 py-12">Nie udało się załadować ustawień.</div>;

  const logoSrc = settings.logoUrl || null;

  const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: 'company', label: t('admin.companyInfo'), icon: Building2 },
    { id: 'smtp', label: t('admin.smtpSettings'), icon: Mail },
    { id: 'reports', label: t('admin.reportSettings'), icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin.settings')}</h1>

      {success && <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-400">{success}</div>}
      {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-1 py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}>
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSave}>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {/* Company tab */}
          {activeTab === 'company' && (
            <div className="space-y-6 max-w-2xl">
              {/* Logo upload section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logo aplikacji</label>
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                    {logoSrc ? (
                      <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-60 transition-colors"
                      >
                        {uploadingLogo ? (
                          <div className="h-4 w-4 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        Wgraj logo
                      </button>
                      {settings.logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          Usuń
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Dozwolone formaty: PNG, JPG, JPEG. Maksymalny rozmiar: 5MB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Company name & subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nazwa firmy (w sidebarze)</label>
                  <input type="text" value={settings.companyName || ''} onChange={(e) => updateField('companyName', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Podtytuł (pod nazwą)</label>
                  <input type="text" value={settings.appSubtitle || ''} onChange={(e) => updateField('appSubtitle', e.target.value)}
                    placeholder="LIMS"
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
              </div>

              <hr className="border-gray-200 dark:border-gray-700" />

              {/* Rest of company fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adres</label>
                  <input type="text" value={settings.address || ''} onChange={(e) => updateField('address', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Miasto</label>
                  <input type="text" value={settings.city || ''} onChange={(e) => updateField('city', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kod pocztowy</label>
                  <input type="text" value={settings.postalCode || ''} onChange={(e) => updateField('postalCode', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIP</label>
                  <input type="text" value={settings.nip || ''} onChange={(e) => updateField('nip', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefon</label>
                  <input type="text" value={settings.phone || ''} onChange={(e) => updateField('phone', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input type="email" value={settings.email || ''} onChange={(e) => updateField('email', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Strona www</label>
                  <input type="url" value={settings.website || ''} onChange={(e) => updateField('website', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* SMTP tab */}
          {activeTab === 'smtp' && (
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Host SMTP</label>
                  <input type="text" value={settings.smtpHost || ''} onChange={(e) => updateField('smtpHost', e.target.value)} placeholder="smtp.gmail.com"
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port SMTP</label>
                  <input type="number" value={settings.smtpPort || 587} onChange={(e) => updateField('smtpPort', parseInt(e.target.value))}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Użytkownik SMTP</label>
                  <input type="text" value={settings.smtpUser || ''} onChange={(e) => updateField('smtpUser', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hasło SMTP</label>
                  <input type="password" value={settings.smtpPassword || ''} onChange={(e) => updateField('smtpPassword', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adres nadawcy (From)</label>
                <input type="email" value={settings.smtpFrom || ''} onChange={(e) => updateField('smtpFrom', e.target.value)} placeholder="laboratorium@firma.pl"
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
              </div>
              <div className="pt-2">
                <button type="button" onClick={handleTestSmtp} disabled={testingSmtp}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60">
                  {testingSmtp ? <div className="h-4 w-4 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" /> : <TestTube2 className="h-4 w-4" />}
                  {t('admin.testSmtp')}
                </button>
                {smtpResult && (
                  <div className={`mt-3 inline-flex items-center gap-2 text-sm ${smtpResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {smtpResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {smtpResult.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reports tab */}
          {activeTab === 'reports' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nagłówek raportu</label>
                <textarea rows={3} value={settings.reportHeaderText || ''} onChange={(e) => updateField('reportHeaderText', e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stopka raportu</label>
                <textarea rows={3} value={settings.reportFooterText || ''} onChange={(e) => updateField('reportFooterText', e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none" />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {saving ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
            {t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
