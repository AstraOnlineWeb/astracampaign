import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface TenantMetrics {
  totalContacts: number;
  totalCampaigns: number;
  totalMessages: number;
  activeUsers: number;
  campaignsThisMonth: number;
  messagesThisMonth: number;
  contactsThisMonth: number;
  campaignSuccessRate: number;
  averageMessagesPerCampaign: number;
  topPerformingCampaigns: Array<{
    id: string;
    name: string;
    messagesSent: number;
    successRate: number;
  }>;
}

interface TenantAnalytics {
  tenantId: string;
  tenantName: string;
  period: string;
  metrics: TenantMetrics;
}

interface SystemAnalytics {
  totalTenants: number;
  totalSystemContacts: number;
  totalSystemCampaigns: number;
  totalSystemMessages: number;
  systemGrowthRate: number;
  tenantUsageDistribution: Array<{
    tenantId: string;
    tenantName: string;
    contactsCount: number;
    campaignsCount: number;
    messagesCount: number;
    usagePercentage: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    tenants: number;
    contacts: number;
    campaigns: number;
    messages: number;
  }>;
}

interface Props {
  isSystemView?: boolean; // SuperAdmin pode ver dados do sistema
}

export function AnalyticsDashboard({ isSystemView = false }: Props) {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState<TenantAnalytics | SystemAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '12m'>('30d');
  const [exportLoading, setExportLoading] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [isSystemView, selectedPeriod]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const endpoint = isSystemView ? '/api/analytics/system' : '/api/analytics/tenant';

      // Calculate date range based on selected period
      const now = new Date();
      let startDate: Date;

      switch (selectedPeriod) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '12m':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
      });

      const response = await fetch(`${endpoint}?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.data);
      } else {
        toast.error(t('analytics.error'));
      }
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
      toast.error(t('analytics.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'contacts' | 'campaigns' | 'analytics') => {
    setExportLoading(type);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/analytics/export/${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        toast.success(t('analytics.export.success', { type }));
      } else {
        toast.error(t('analytics.export.error'));
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error(t('analytics.export.error'));
    } finally {
      setExportLoading(null);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          {t('analytics.error')}
        </div>
      </div>
    );
  }

  const renderTenantAnalytics = (data: TenantAnalytics) => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('analytics.title.tenant', { name: data.tenantName })}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {t('analytics.period', { period: data.period })}
              </p>
            </div>
            <div className="mt-3 sm:mt-0 flex space-x-2">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">{t('analytics.periods.7d')}</option>
                <option value="30d">{t('analytics.periods.30d')}</option>
                <option value="90d">{t('analytics.periods.90d')}</option>
                <option value="12m">{t('analytics.periods.12m')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Métricas Principais */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{formatNumber(data.metrics.totalContacts)}</div>
              <div className="text-sm text-blue-800">{t('analytics.metrics.totalContacts')}</div>
              <div className="text-xs text-blue-600 mt-1">
                {t('analytics.metrics.thisMonth', { val: data.metrics.contactsThisMonth })}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{formatNumber(data.metrics.totalCampaigns)}</div>
              <div className="text-sm text-green-800">{t('analytics.metrics.totalCampaigns')}</div>
              <div className="text-xs text-green-600 mt-1">
                {t('analytics.metrics.thisMonth', { val: data.metrics.campaignsThisMonth })}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{formatNumber(data.metrics.totalMessages)}</div>
              <div className="text-sm text-purple-800">{t('analytics.metrics.sentMessages')}</div>
              <div className="text-xs text-purple-600 mt-1">
                {t('analytics.metrics.thisMonth', { val: data.metrics.messagesThisMonth })}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">{data.metrics.campaignSuccessRate}%</div>
              <div className="text-sm text-orange-800">{t('analytics.metrics.successRate')}</div>
              <div className="text-xs text-orange-600 mt-1">
                {t('analytics.metrics.avgPerCampaign', { val: data.metrics.averageMessagesPerCampaign.toFixed(1) })}
              </div>
            </div>
          </div>

          {/* Top Campanhas */}
          {data.metrics.topPerformingCampaigns.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">{t('analytics.topCampaigns.title')}</h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('analytics.topCampaigns.headers.campaign')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('analytics.topCampaigns.headers.messages')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('analytics.topCampaigns.headers.rate')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.metrics.topPerformingCampaigns.map((campaign, index) => (
                      <tr key={campaign.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{campaign.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatNumber(campaign.messagesSent)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${campaign.successRate >= 90 ? 'bg-green-100 text-green-800' :
                            campaign.successRate >= 70 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                            {campaign.successRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Botões de Exportação */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{t('analytics.export.title')}</h3>
            <div className="flex flex-wrap gap-3">
              {['contacts', 'campaigns', 'analytics'].map((type) => (
                <button
                  key={type}
                  onClick={() => handleExport(type as any)}
                  disabled={exportLoading === type}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading === type ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2 inline" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('analytics.export.exporting')}
                    </>
                  ) : (
                    t(`analytics.export.${type}`)
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSystemAnalytics = (data: SystemAnalytics) => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('analytics.title.system')}</h2>
              <p className="text-sm text-gray-600 mt-1">{t('analytics.systemSubtitle')}</p>
            </div>
            <div className="mt-3 sm:mt-0">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">{t('analytics.periods.7d')}</option>
                <option value="30d">{t('analytics.periods.30d')}</option>
                <option value="90d">{t('analytics.periods.90d')}</option>
                <option value="12m">{t('analytics.periods.12m')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Métricas do Sistema */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{data.totalTenants}</div>
              <div className="text-sm text-blue-800">{t('analytics.metrics.activeTenants')}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{formatNumber(data.totalSystemContacts)}</div>
              <div className="text-sm text-green-800">{t('analytics.metrics.totalContacts')}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{formatNumber(data.totalSystemCampaigns)}</div>
              <div className="text-sm text-purple-800">{t('analytics.metrics.totalCampaigns')}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">{data.systemGrowthRate > 0 ? '+' : ''}{data.systemGrowthRate}%</div>
              <div className="text-sm text-orange-800">{t('analytics.metrics.growthRate')}</div>
            </div>
          </div>

          {/* Distribuição de Uso por Tenant */}
          {data.tenantUsageDistribution.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">{t('analytics.tenantUsage.title')}</h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('analytics.tenantUsage.headers.tenant')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('analytics.tenantUsage.headers.contacts')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('analytics.tenantUsage.headers.campaigns')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('analytics.tenantUsage.headers.messages')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('analytics.tenantUsage.headers.usage')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.tenantUsageDistribution.map((tenant) => (
                      <tr key={tenant.tenantId}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{tenant.tenantName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatNumber(tenant.contactsCount)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatNumber(tenant.campaignsCount)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatNumber(tenant.messagesCount)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{tenant.usagePercentage.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {isSystemView && 'totalTenants' in analytics ?
        renderSystemAnalytics(analytics as SystemAnalytics) :
        renderTenantAnalytics(analytics as TenantAnalytics)
      }
    </div>
  );
}