import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  domain?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    contacts: number;
    campaigns: number;
    whatsappSessions: number;
  };
  quota?: {
    maxUsers: number;
    maxContacts: number;
    maxCampaigns: number;
    maxConnections: number;
  };
}

interface TenantFormData {
  slug: string;
  name: string;
  domain: string;
  adminUser: {
    nome: string;
    email: string;
    senha: string;
  };
  quotas: {
    maxUsers: number;
    maxContacts: number;
    maxCampaigns: number;
    maxConnections: number;
  };
}

export function SuperAdminPage() {
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState<TenantFormData>({
    slug: '',
    name: '',
    domain: '',
    adminUser: {
      nome: '',
      email: '',
      senha: ''
    },
    quotas: {
      maxUsers: 10,
      maxContacts: 1000,
      maxCampaigns: 50,
      maxConnections: 5
    }
  });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/tenants', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTenants(data);
      } else {
        throw new Error(t('superAdmin.messages.loadError'));
      }
    } catch (error) {
      toast.error(t('superAdmin.messages.loadError'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(t('superAdmin.messages.createSuccess'));
        setShowCreateModal(false);
        resetForm();
        loadTenants();
      } else {
        const error = await response.json();
        throw new Error(error.error || t('superAdmin.messages.createError'));
      }
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    }
  };

  const handleUpdateTenant = async () => {
    if (!selectedTenant) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/tenants/${selectedTenant.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          domain: formData.domain || null,
          active: selectedTenant.active,
          quotas: formData.quotas
        })
      });

      if (response.ok) {
        toast.success(t('superAdmin.messages.updateSuccess'));
        setShowEditModal(false);
        setSelectedTenant(null);
        resetForm();
        loadTenants();
      } else {
        const error = await response.json();
        throw new Error(error.error || t('superAdmin.messages.updateError'));
      }
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    }
  };

  const handleToggleTenantStatus = async (tenant: Tenant) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/tenants/${tenant.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...tenant,
          active: !tenant.active
        })
      });

      if (response.ok) {
        toast.success(t('superAdmin.messages.toggleStatusSuccess', { status: !tenant.active ? t('superAdmin.messages.activated') : t('superAdmin.messages.deactivated') }));
        loadTenants();
      } else {
        const error = await response.json();
        throw new Error(error.error || t('superAdmin.messages.toggleStatusError'));
      }
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    }
  };

  const openEditModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      slug: tenant.slug,
      name: tenant.name,
      domain: tenant.domain || '',
      adminUser: {
        nome: '',
        email: '',
        senha: ''
      },
      quotas: tenant.quota || {
        maxUsers: 10,
        maxContacts: 1000,
        maxCampaigns: 50,
        maxConnections: 5
      }
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      slug: '',
      name: '',
      domain: '',
      adminUser: {
        nome: '',
        email: '',
        senha: ''
      },
      quotas: {
        maxUsers: 10,
        maxContacts: 1000,
        maxCampaigns: 50,
        maxConnections: 5
      }
    });
  };

  const getUsagePercentage = (current: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('superAdmin.page.title')}</h1>
          <p className="text-gray-600 mt-2">{t('superAdmin.page.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('superAdmin.actions.new')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('superAdmin.stats.total')}</p>
              <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('superAdmin.stats.active')}</p>
              <p className="text-2xl font-bold text-gray-900">{tenants.filter(t => t.active).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('superAdmin.stats.inactive')}</p>
              <p className="text-2xl font-bold text-gray-900">{tenants.filter(t => !t.active).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('superAdmin.stats.users')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {tenants.reduce((acc, t) => acc + (t._count?.users || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tenants List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('superAdmin.tenants.listTitle')}</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {tenants.map((tenant) => (
            <div key={tenant.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{tenant.name}</h3>
                      <p className="text-sm text-gray-600">
                        <span className="font-mono">{tenant.slug}</span>
                        {tenant.domain && (
                          <>
                            {' • '}
                            <span className="text-blue-600">{tenant.domain}</span>
                          </>
                        )}
                      </p>
                    </div>

                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${tenant.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }`}>
                      {tenant.active ? t('superAdmin.status.active') : t('superAdmin.status.inactive')}
                    </span>
                  </div>

                  {/* Usage Stats */}
                  {tenant._count && tenant.quota && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: t('superAdmin.quotas.users'), current: tenant._count.users, max: tenant.quota.maxUsers },
                        { label: t('superAdmin.quotas.contacts'), current: tenant._count.contacts, max: tenant.quota.maxContacts },
                        { label: t('superAdmin.quotas.campaigns'), current: tenant._count.campaigns, max: tenant.quota.maxCampaigns },
                        { label: t('superAdmin.quotas.connections'), current: tenant._count.whatsappSessions, max: tenant.quota.maxConnections }
                      ].map((stat) => {
                        const percentage = getUsagePercentage(stat.current, stat.max);
                        return (
                          <div key={stat.label} className="text-center">
                            <div className={`text-xs px-2 py-1 rounded-full ${getUsageColor(percentage)}`}>
                              {stat.current}/{stat.max} ({percentage}%)
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(tenant)}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    {t('superAdmin.actions.edit')}
                  </button>
                  <button
                    onClick={() => handleToggleTenantStatus(tenant)}
                    className={`px-3 py-2 text-sm rounded-lg ${tenant.active
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                  >
                    {tenant.active ? t('superAdmin.actions.deactivate') : t('superAdmin.actions.activate')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">{t('superAdmin.modals.create.title')}</h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Tenant Info */}
              <div>
                <h3 className="text-lg font-medium mb-4">{t('superAdmin.form.sections.info')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.form.fields.slug')} *
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="empresa-abc"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.form.fields.name')} *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Empresa ABC Ltda"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.form.fields.domain')}
                    </label>
                    <input
                      type="text"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="empresa.com.br"
                    />
                  </div>
                </div>
              </div>

              {/* Admin User */}
              <div>
                <h3 className="text-lg font-medium mb-4">{t('superAdmin.form.sections.admin')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.form.fields.adminName')} *
                    </label>
                    <input
                      type="text"
                      value={formData.adminUser.nome}
                      onChange={(e) => setFormData({
                        ...formData,
                        adminUser: { ...formData.adminUser, nome: e.target.value }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.form.fields.email')} *
                    </label>
                    <input
                      type="email"
                      value={formData.adminUser.email}
                      onChange={(e) => setFormData({
                        ...formData,
                        adminUser: { ...formData.adminUser, email: e.target.value }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.form.fields.password')} *
                    </label>
                    <input
                      type="password"
                      value={formData.adminUser.senha}
                      onChange={(e) => setFormData({
                        ...formData,
                        adminUser: { ...formData.adminUser, senha: e.target.value }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder={t('superAdmin.form.fields.passwordPlaceholder')}
                    />
                  </div>
                </div>
              </div>

              {/* Quotas */}
              <div>
                <h3 className="text-lg font-medium mb-4">{t('superAdmin.form.sections.quotas')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.quotas.maxUsers')}
                    </label>
                    <input
                      type="number"
                      value={formData.quotas.maxUsers}
                      onChange={(e) => setFormData({
                        ...formData,
                        quotas: { ...formData.quotas, maxUsers: parseInt(e.target.value) }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.quotas.maxContacts')}
                    </label>
                    <input
                      type="number"
                      value={formData.quotas.maxContacts}
                      onChange={(e) => setFormData({
                        ...formData,
                        quotas: { ...formData.quotas, maxContacts: parseInt(e.target.value) }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.quotas.maxCampaigns')}
                    </label>
                    <input
                      type="number"
                      value={formData.quotas.maxCampaigns}
                      onChange={(e) => setFormData({
                        ...formData,
                        quotas: { ...formData.quotas, maxCampaigns: parseInt(e.target.value) }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.quotas.maxConnections')}
                    </label>
                    <input
                      type="number"
                      value={formData.quotas.maxConnections}
                      onChange={(e) => setFormData({
                        ...formData,
                        quotas: { ...formData.quotas, maxConnections: parseInt(e.target.value) }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreateTenant}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('superAdmin.actions.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">{t('superAdmin.modals.edit.title')}</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">{t('superAdmin.form.sections.info')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.form.fields.slug')}
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      disabled
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.form.fields.name')} *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.form.fields.domain')}
                    </label>
                    <input
                      type="text"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-4">{t('superAdmin.form.sections.quotas')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.quotas.maxUsers')}
                    </label>
                    <input
                      type="number"
                      value={formData.quotas.maxUsers}
                      onChange={(e) => setFormData({
                        ...formData,
                        quotas: { ...formData.quotas, maxUsers: parseInt(e.target.value) }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.quotas.maxContacts')}
                    </label>
                    <input
                      type="number"
                      value={formData.quotas.maxContacts}
                      onChange={(e) => setFormData({
                        ...formData,
                        quotas: { ...formData.quotas, maxContacts: parseInt(e.target.value) }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.quotas.maxCampaigns')}
                    </label>
                    <input
                      type="number"
                      value={formData.quotas.maxCampaigns}
                      onChange={(e) => setFormData({
                        ...formData,
                        quotas: { ...formData.quotas, maxCampaigns: parseInt(e.target.value) }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('superAdmin.quotas.maxConnections')}
                    </label>
                    <input
                      type="number"
                      value={formData.quotas.maxConnections}
                      onChange={(e) => setFormData({
                        ...formData,
                        quotas: { ...formData.quotas, maxConnections: parseInt(e.target.value) }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTenant(null);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleUpdateTenant}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('common.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}