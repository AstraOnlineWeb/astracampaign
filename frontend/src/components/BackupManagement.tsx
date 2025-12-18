import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface BackupInfo {
  tenantId: string;
  tenantSlug: string;
  size: number;
  createdAt: string;
  status: 'success' | 'failed' | 'in_progress';
  error?: string;
}

interface BackupStats {
  totalTenants: number;
  totalBackups: number;
  totalSize: number;
  scheduledJobs: number;
  tenantStats: {
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    backupCount: number;
    totalSize: number;
    lastBackup: string | null;
    isScheduled: boolean;
  }[];
}

export function BackupManagement() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadBackupStats();
  }, []);

  const loadBackupStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/backup/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        toast.error(t('backup.error'));
      }
    } catch (error) {
      console.error('Erro ao carregar backup stats:', error);
      toast.error(t('backup.error'));
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async (tenantId?: string) => {
    const key = tenantId || 'all';
    setActionLoading(key);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tenantId ? { tenantId } : { all: true })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success(data.message || t('backup.messages.createSuccess'));
          await loadBackupStats(); // Recarrega stats
        } else {
          toast.error(data.message || t('backup.messages.createError'));
        }
      } else {
        toast.error(t('backup.messages.createError'));
      }
    } catch (error) {
      console.error('Erro ao criar backup:', error);
      toast.error(t('backup.messages.createError'));
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSchedule = async (tenantId: string, enabled: boolean) => {
    setActionLoading(`schedule-${tenantId}`);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/backup/schedule', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenantId,
          enabled,
          schedule: '0 2 * * *', // Diariamente às 2h
          retentionDays: 30
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success(data.message);
          await loadBackupStats();
        } else {
          toast.error(data.message || t('backup.messages.saveConfigError'));
        }
      } else {
        toast.error(t('backup.messages.saveConfigError'));
      }
    } catch (error) {
      console.error('Erro ao configurar agendamento:', error);
      toast.error(t('backup.messages.saveConfigError'));
    } finally {
      setActionLoading(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return t('backup.status.never');
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          {t('backup.error')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas Gerais */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('backup.managementTitle')}</h2>
          <p className="text-sm text-gray-600 mt-1">{t('backup.managementSubtitle')}</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalTenants}</div>
              <div className="text-sm text-gray-600">{t('backup.stats.companies')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.totalBackups}</div>
              <div className="text-sm text-gray-600">{t('backup.stats.totalBackups')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatFileSize(stats.totalSize)}</div>
              <div className="text-sm text-gray-600">{t('backup.stats.usedSpace')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.scheduledJobs}</div>
              <div className="text-sm text-gray-600">{t('backup.stats.scheduledJobs')}</div>
            </div>
          </div>

          {/* Botão Backup Global */}
          <div className="text-center mb-6">
            <button
              onClick={() => createBackup()}
              disabled={actionLoading === 'all'}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === 'all' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('backup.actions.creating')}
                </>
              ) : (
                t('backup.actions.globalBackup')
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Empresas */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('backup.list.tenantTitle')}</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.list.headers.tenant')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.list.headers.backups')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.list.headers.size')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.list.headers.lastBackup')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.list.headers.schedule')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('backup.list.headers.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.tenantStats.map((tenant) => (
                <tr key={tenant.tenantId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{tenant.tenantName}</div>
                      <div className="text-sm text-gray-500">{tenant.tenantSlug}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.backupCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatFileSize(tenant.totalSize)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(tenant.lastBackup)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleSchedule(tenant.tenantId, !tenant.isScheduled)}
                      disabled={actionLoading === `schedule-${tenant.tenantId}`}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${tenant.isScheduled
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                    >
                      {actionLoading === `schedule-${tenant.tenantId}` ? (
                        <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <div className={`w-2 h-2 rounded-full mr-1 ${tenant.isScheduled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      )}
                      {tenant.isScheduled ? t('backup.status.active') : t('backup.status.inactive')}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => createBackup(tenant.tenantId)}
                      disabled={actionLoading === tenant.tenantId}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === tenant.tenantId ? (
                        <>
                          <svg className="animate-spin h-3 w-3 mr-1 inline" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('backup.actions.creating')}
                        </>
                      ) : (
                        t('backup.actions.backupNow')
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}