import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface BackupFile {
  fileName: string;
  size: number;
  createdAt: string;
  status: 'success' | 'failed' | 'in_progress';
  type: 'full' | 'database' | 'uploads';
}

interface BackupConfig {
  enabled: boolean;
  schedule: string;
  retentionDays: number;
  storageType: 'local' | 's3';
}

export function SystemBackup() {
  const { t } = useTranslation();

  const SCHEDULE_OPTIONS = [
    { value: '0 */6 * * *', label: t('backup.modals.config.check.6h') },
    { value: '0 */12 * * *', label: t('backup.modals.config.check.12h') },
    { value: '0 2 * * *', label: t('backup.modals.config.check.daily2h') },
    { value: '0 2 * * 0', label: t('backup.modals.config.check.weekly') },
    { value: '0 2 1 * *', label: t('backup.modals.config.check.monthly') }
  ];

  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [config, setConfig] = useState<BackupConfig>({
    enabled: false,
    schedule: '0 2 * * *',
    retentionDays: 30,
    storageType: 'local'
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadBackups();
    loadConfig();
  }, []);

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: `Bearer ${token}`
      }
    });
  };

  const loadBackups = async () => {
    try {
      const response = await authenticatedFetch('/api/backup/system');
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
      } else {
        throw new Error('Erro ao carregar backups');
      }
    } catch (error) {
      console.error('Erro ao carregar backups:', error);
      toast.error(t('backup.messages.listError'));
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await authenticatedFetch('/api/backup/system/config');
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig(data.config);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const response = await authenticatedFetch('/api/backup/system', {
        method: 'POST'
      });

      if (response.ok) {
        toast.success(t('backup.messages.createSuccess'));
        await loadBackups();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao criar backup');
      }
    } catch (error: any) {
      console.error('Erro ao criar backup:', error);
      toast.error(error.message || t('backup.messages.createError'));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const response = await authenticatedFetch('/api/backup/system/configure', {
        method: 'POST',
        body: JSON.stringify(config)
      });

      if (response.ok) {
        toast.success(t('backup.messages.saveConfigSuccess'));
        setShowConfigModal(false);
        await loadConfig();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao salvar configuração');
      }
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      toast.error(error.message || t('backup.messages.saveConfigError'));
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;

    setRestoring(true);
    try {
      const confirmed = window.confirm(t('backup.messages.confirmRestore'));

      if (!confirmed) {
        setRestoring(false);
        return;
      }

      const response = await authenticatedFetch('/api/backup/system/restore', {
        method: 'POST',
        body: JSON.stringify({ fileName: selectedBackup.fileName })
      });

      if (response.ok) {
        toast.success(t('backup.messages.restoreSuccess'));
        setShowRestoreModal(false);
        setSelectedBackup(null);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao restaurar backup');
      }
    } catch (error: any) {
      console.error('Erro ao restaurar backup:', error);
      toast.error(error.message || t('backup.messages.restoreError'));
    } finally {
      setRestoring(false);
    }
  };

  const handleDownloadBackup = async (fileName: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/backup/system/download/${fileName}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao fazer download do backup');
      }

      // Criar blob e fazer download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(t('backup.messages.downloadStart'));
    } catch (error: any) {
      console.error('Erro ao fazer download:', error);
      toast.error(error.message || t('backup.messages.downloadError'));
    }
  };

  const handleUploadAndRestore = async () => {
    if (!uploadFile) {
      toast.error(t('backup.messages.selectFile'));
      return;
    }

    // Validar extensão do arquivo
    if (!uploadFile.name.endsWith('.tar.gz')) {
      toast.error(t('backup.messages.invalidFile'));
      return;
    }

    const confirmed = window.confirm(t('backup.messages.confirmUpload'));

    if (!confirmed) {
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('backup', uploadFile);

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/backup/system/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(t('backup.messages.uploadSuccess'));

        // Agora restaurar o backup que acabou de fazer upload
        const restoreResponse = await authenticatedFetch('/api/backup/system/restore', {
          method: 'POST',
          body: JSON.stringify({ fileName: data.fileName })
        });

        if (restoreResponse.ok) {
          toast.success(t('backup.messages.uploadRestoreSuccess'));
          setShowUploadModal(false);
          setUploadFile(null);
          await loadBackups();
        } else {
          const error = await restoreResponse.json();
          throw new Error(error.message || 'Erro ao restaurar backup');
        }
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao enviar arquivo de backup');
      }
    } catch (error: any) {
      console.error('Erro ao fazer upload e restaurar:', error);
      toast.error(error.message || t('backup.messages.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header e Ações */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{t('backup.systemTitle')}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('backup.systemSubtitle')}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t('backup.actions.configure')}
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {t('backup.actions.restoreFile')}
            </button>
            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              {creating ? t('backup.actions.creating') : t('backup.actions.create')}
            </button>
          </div>
        </div>

        {/* Status do Backup Automático */}
        <div className={`px-4 py-3 rounded-lg ${config.enabled ? 'bg-green-50' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${config.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {config.enabled ? t('backup.status.autoActive') : t('backup.status.autoDisabled')}
                </p>
                {config.enabled && (
                  <p className="text-xs text-gray-600 mt-1">
                    {t('backup.status.next', { time: SCHEDULE_OPTIONS.find(opt => opt.value === config.schedule)?.label || config.schedule })}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowConfigModal(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {config.enabled ? t('backup.status.modify') : t('backup.status.activate')}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Backups */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('backup.list.title')}</h3>
          <p className="text-sm text-gray-600 mt-1">{t('backup.list.found', { count: backups.length })}</p>
        </div>

        {backups.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-4 text-sm text-gray-500">{t('backup.list.empty')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('backup.list.start')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {backups.map((backup) => (
              <div key={backup.fileName} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{backup.fileName}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-gray-500">{formatFileSize(backup.size)}</span>
                          <span className="text-xs text-gray-500">{formatDate(backup.createdAt)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${backup.status === 'success' ? 'bg-green-100 text-green-800' :
                              backup.status === 'failed' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                            }`}>
                            {backup.status === 'success' ? t('backup.status.success') :
                              backup.status === 'failed' ? t('backup.status.failed') : t('backup.status.inProgress')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadBackup(backup.fileName)}
                      className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {t('backup.actions.download')}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBackup(backup);
                        setShowRestoreModal(true);
                      }}
                      className="px-3 py-2 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t('backup.actions.restore')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Configuração */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{t('backup.modals.config.title')}</h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
                  {t('backup.modals.config.enable')}
                </label>
              </div>

              {config.enabled && (
                <>
                  <div>
                    <label htmlFor="schedule" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('backup.modals.config.frequency')}
                    </label>
                    <select
                      id="schedule"
                      value={config.schedule}
                      onChange={(e) => setConfig({ ...config, schedule: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {SCHEDULE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="retention" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('backup.modals.config.retention')}
                    </label>
                    <input
                      type="number"
                      id="retention"
                      min="1"
                      max="365"
                      value={config.retentionDays}
                      onChange={(e) => setConfig({ ...config, retentionDays: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('backup.modals.config.retentionHint')}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {t('backup.modals.config.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Restauração */}
      {showRestoreModal && selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-red-900">{t('backup.modals.restore.title')}</h3>
            </div>

            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-medium">{t('backup.modals.restore.warningTitle')}</p>
                <p className="text-xs text-red-700 mt-2">
                  {t('backup.modals.restore.warningText')}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900">{t('backup.modals.restore.selected')}</p>
                <p className="text-xs text-gray-600 mt-1">{selectedBackup.fileName}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Criado em: {formatDate(selectedBackup.createdAt)}
                </p>
                <p className="text-xs text-gray-500">
                  Tamanho: {formatFileSize(selectedBackup.size)}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRestoreModal(false);
                  setSelectedBackup(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={restoring}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {restoring ? t('backup.modals.restore.restoring') : t('backup.modals.restore.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Upload de Backup */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-orange-900">{t('backup.modals.upload.title')}</h3>
            </div>

            <div className="p-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-orange-800 font-medium">{t('backup.modals.upload.useFor')}</p>
                <ul className="text-xs text-orange-700 mt-2 ml-4 space-y-1 list-disc">
                  {(t('backup.modals.upload.useForPoints', { returnObjects: true }) as string[]).map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-medium">{t('backup.modals.upload.warningTitle')}</p>
                <p className="text-xs text-red-700 mt-2">
                  {t('backup.modals.upload.warningText')}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="backupFile" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('backup.modals.upload.selectFile')}
                  </label>
                  <input
                    type="file"
                    id="backupFile"
                    accept=".tar.gz"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  {uploadFile && (
                    <div className="mt-2 text-sm text-gray-600">
                      <p className="font-medium">Arquivo selecionado:</p>
                      <p className="text-xs">{uploadFile.name}</p>
                      <p className="text-xs">Tamanho: {formatFileSize(uploadFile.size)}</p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600">
                    <strong>{t('backup.modals.upload.process')}</strong>
                  </p>
                  <ol className="text-xs text-gray-600 mt-1 ml-4 space-y-1 list-decimal">
                    {(t('backup.modals.upload.processSteps', { returnObjects: true }) as string[]).map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleUploadAndRestore}
                disabled={!uploadFile || uploading}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {uploading ? t('backup.modals.upload.uploading') : t('backup.modals.upload.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
