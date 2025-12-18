import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { PerfexSyncModal } from '../components/PerfexSyncModal';

interface Settings {
  id: string;
  openaiApiKey?: string;
  groqApiKey?: string;
  chatwootUrl?: string;
  chatwootAccountId?: string;
  chatwootApiToken?: string;
  perfexUrl?: string;
  perfexToken?: string;
}

const settingsSchema = z.object({
  openaiApiKey: z.string().optional(),
  groqApiKey: z.string().optional(),
  chatwootUrl: z.string().optional(),
  chatwootAccountId: z.string().optional(),
  chatwootApiToken: z.string().optional(),
  perfexUrl: z.string().optional(),
  perfexToken: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<'openai' | 'groq' | 'chatwoot' | 'perfex' | null>(null);
  const { user } = useAuth();

  // Helper para fazer requisições autenticadas
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };


  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    loadSettings();

    // Listen for tenant changes from header selector
    const handleTenantChange = () => {
      loadSettings();
    };

    window.addEventListener('superadmin-tenant-changed', handleTenantChange);
    return () => {
      window.removeEventListener('superadmin-tenant-changed', handleTenantChange);
    };
  }, [user]);

  const loadSettings = async () => {
    try {
      let url = '/api/settings';

      if (user?.role === 'SUPERADMIN') {
        const selectedTenantId = localStorage.getItem('superadmin_selected_tenant');
        if (selectedTenantId) {
          url = `/api/settings?tenantId=${selectedTenantId}`;
        }
      }

      const response = await authenticatedFetch(url);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setValue('openaiApiKey', data.openaiApiKey || '');
        setValue('groqApiKey', data.groqApiKey || '');
        setValue('chatwootUrl', data.chatwootUrl || '');
        setValue('chatwootAccountId', data.chatwootAccountId || '');
        setValue('chatwootApiToken', data.chatwootApiToken || '');
        setValue('perfexUrl', data.perfexUrl || '');
        setValue('perfexToken', data.perfexToken || '');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error(t('settings.messages.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    try {
      let requestData = data;

      if (user?.role === 'SUPERADMIN') {
        const selectedTenantId = localStorage.getItem('superadmin_selected_tenant');
        if (selectedTenantId) {
          requestData = { ...data, tenantId: selectedTenantId } as any;
        }
      }

      const response = await authenticatedFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        await response.json();
        toast.success(t('settings.messages.saved'));
        setActiveModal(null);
        await loadSettings();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || t('settings.messages.error'));
      }
    } catch (error) {
      console.error('Erro ao salvar configurações de integração:', error);
      toast.error(t('settings.messages.error'));
    }
  };

  const removeIntegration = async (type: 'openai' | 'groq' | 'chatwoot' | 'perfex') => {
    const integrationNames = {
      openai: 'OpenAI',
      groq: 'Groq',
      chatwoot: 'Chatwoot',
      perfex: 'Perfex CRM'
    };

    if (!confirm(t('settings.messages.removeConfirm', { name: integrationNames[type] }))) {
      return;
    }

    try {
      let requestData: any = {};

      if (type === 'openai') {
        requestData.openaiApiKey = '';
      } else if (type === 'groq') {
        requestData.groqApiKey = '';
      } else if (type === 'chatwoot') {
        requestData.chatwootUrl = '';
        requestData.chatwootAccountId = '';
        requestData.chatwootApiToken = '';
      } else if (type === 'perfex') {
        requestData.perfexUrl = '';
        requestData.perfexToken = '';
      }

      if (user?.role === 'SUPERADMIN') {
        const selectedTenantId = localStorage.getItem('superadmin_selected_tenant');
        if (selectedTenantId) {
          requestData.tenantId = selectedTenantId;
        }
      }

      const response = await authenticatedFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        toast.success(t('settings.messages.integrationRemoved', { name: integrationNames[type] }));
        setActiveModal(null);
        await loadSettings();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || t('common.error'));
      }
    } catch (error) {
      console.error('Erro ao remover integração:', error);
      toast.error(t('common.error'));
    }
  };


  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">{t('common.loading')}...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-6 text-gray-900">
              🔗 {t('settings.aiIntegrations')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('settings.aiIntegrationsDescription')}
            </p>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* OpenAI Button */}
              <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600 font-semibold">🤖</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">OpenAI</h3>
                      <p className="text-sm text-gray-500">ChatGPT, GPT-4</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${settings?.openaiApiKey
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                      }`}>
                      {settings?.openaiApiKey ? t('settings.configured') : t('settings.notConfigured')}
                    </span>
                    <button
                      onClick={() => setActiveModal('openai')}
                      className="px-3 py-1 bg-gray-800 text-white text-sm rounded hover:bg-gray-900"
                    >
                      {t('settings.configure')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Groq Button */}
              <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <span className="text-orange-600 font-semibold">⚡</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Groq</h3>
                      <p className="text-sm text-gray-500">LLaMA, Mixtral (ultra-rápido)</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${settings?.groqApiKey
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                      }`}>
                      {settings?.groqApiKey ? t('settings.configured') : t('settings.notConfigured')}
                    </span>
                    <button
                      onClick={() => setActiveModal('groq')}
                      className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                    >
                      {t('settings.configure')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Integração Chatwoot */}
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h2 className="text-lg font-semibold mb-6 text-gray-900">
              💬 {t('settings.chatwootIntegration')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('settings.chatwootDescription')}
            </p>

            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">💬</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Chatwoot</h3>
                    <p className="text-sm text-gray-500">{t('settings.modals.chatwoot.description')}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${settings?.chatwootUrl && settings?.chatwootAccountId && settings?.chatwootApiToken
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                    }`}>
                    {settings?.chatwootUrl && settings?.chatwootAccountId && settings?.chatwootApiToken ? t('settings.configured') : t('settings.notConfigured')}
                  </span>
                  <button
                    onClick={() => setActiveModal('chatwoot')}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    {t('settings.configure')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Integração Perfex CRM */}
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h2 className="text-lg font-semibold mb-6 text-gray-900">
              🔧 {t('settings.perfexIntegration')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('settings.perfexDescription')}
            </p>

            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 font-semibold">🔧</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Perfex CRM</h3>
                    <p className="text-sm text-gray-500">{t('settings.modals.perfex.description', { defaultValue: 'Sistema de gestão de clientes e projetos' })}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${settings?.perfexUrl && settings?.perfexToken
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                    }`}>
                    {settings?.perfexUrl && settings?.perfexToken ? t('settings.configured') : t('settings.notConfigured')}
                  </span>
                  <button
                    onClick={() => setActiveModal('perfex')}
                    className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                  >
                    {t('settings.configure')}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modais de Integração */}


      {/* Modal OpenAI */}
      {activeModal === 'openai' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">🤖 {t('settings.modals.openai.title')}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="openaiApiKey" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('settings.modals.openai.apiKeyLabel')}
                </label>
                <input
                  id="openaiApiKey"
                  type="password"
                  {...register('openaiApiKey')}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.openaiApiKey && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.openaiApiKey.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {t('settings.modals.openai.description')}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
                {settings?.openaiApiKey && (
                  <button
                    type="button"
                    onClick={() => removeIntegration('openai')}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {t('common.remove')}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:opacity-50"
                >
                  {isSubmitting ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Groq */}
      {activeModal === 'groq' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">⚡ {t('settings.modals.groq.title')}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="groqApiKey" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('settings.modals.groq.apiKeyLabel')}
                </label>
                <input
                  id="groqApiKey"
                  type="password"
                  {...register('groqApiKey')}
                  placeholder="gsk_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.groqApiKey && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.groqApiKey.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {t('settings.modals.groq.description')}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
                {settings?.groqApiKey && (
                  <button
                    type="button"
                    onClick={() => removeIntegration('groq')}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {t('common.remove')}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  {isSubmitting ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chatwoot */}
      {activeModal === 'chatwoot' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">💬 {t('settings.modals.chatwoot.title')}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="chatwootUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('settings.modals.chatwoot.urlLabel')} *
                </label>
                <input
                  id="chatwootUrl"
                  type="url"
                  {...register('chatwootUrl')}
                  placeholder="https://app.chatwoot.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.chatwootUrl && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.chatwootUrl.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {t('settings.modals.chatwoot.urlDescription')}
                </p>
              </div>

              <div>
                <label htmlFor="chatwootAccountId" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('settings.modals.chatwoot.accountIdLabel')} *
                </label>
                <input
                  id="chatwootAccountId"
                  type="text"
                  {...register('chatwootAccountId')}
                  placeholder="123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.chatwootAccountId && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.chatwootAccountId.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {t('settings.modals.chatwoot.accountIdDescription')}
                </p>
              </div>

              <div>
                <label htmlFor="chatwootApiToken" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('settings.modals.chatwoot.apiTokenLabel')} *
                </label>
                <input
                  id="chatwootApiToken"
                  type="password"
                  {...register('chatwootApiToken')}
                  placeholder="••••••••••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.chatwootApiToken && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.chatwootApiToken.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {t('settings.modals.chatwoot.apiTokenDescription')}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
                {settings?.chatwootUrl && settings?.chatwootAccountId && settings?.chatwootApiToken && (
                  <button
                    type="button"
                    onClick={() => removeIntegration('chatwoot')}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {t('common.remove')}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Perfex CRM */}
      <PerfexSyncModal
        isOpen={activeModal === 'perfex'}
        onClose={() => setActiveModal(null)}
        perfexUrl={settings?.perfexUrl || ''}
        perfexToken={settings?.perfexToken || ''}
        onSave={async (url, token) => {
          try {
            let requestData: any = {
              perfexUrl: url,
              perfexToken: token
            };

            if (user?.role === 'SUPERADMIN') {
              const selectedTenantId = localStorage.getItem('superadmin_selected_tenant');
              if (selectedTenantId) {
                requestData.tenantId = selectedTenantId;
              }
            }

            const response = await authenticatedFetch('/api/settings', {
              method: 'PUT',
              body: JSON.stringify(requestData),
            });

            if (response.ok) {
              toast.success(t('settings.messages.saved'));
              await loadSettings();
            } else {
              const errorData = await response.json();
              toast.error(errorData.error || t('settings.messages.error'));
            }
          } catch (error) {
            console.error('Erro ao configurar Perfex CRM:', error);
            toast.error(t('settings.messages.error'));
          }
        }}
      />

    </>
  );
}