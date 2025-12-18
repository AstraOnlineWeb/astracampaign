import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { SystemBackup } from '../components/SystemBackup';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { useSettings } from '../hooks/useSettings';
import { LanguageSelector } from '../components/LanguageSelector';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  domain?: string;
  active: boolean;
  allowedProviders?: string[]; // ['WAHA', 'EVOLUTION', 'QUEPASA']
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

interface User {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  ultimoLogin?: string | null;
  criadoEm: string;
  atualizadoEm: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    active: boolean;
  } | null;
}

interface TenantFormData {
  name: string;
  adminUser: {
    nome: string;
    email: string;
    senha: string;
  };
  quotas: {
    maxUsers: string;
    maxContacts: string;
    maxCampaigns: string;
    maxConnections: string;
  };
  allowedProviders: string[]; // ['WAHA', 'EVOLUTION', 'QUEPASA']
}

interface UserFormData {
  nome: string;
  email: string;
  senha: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  tenantId?: string; // Mantido para compatibilidade
  tenantIds?: string[]; // Novo: múltiplos tenants
  ativo: boolean;
}

interface SystemStats {
  tenants: {
    total: number;
    active: number;
    inactive: number;
  };
  users: {
    total: number;
    byRole: {
      SUPERADMIN: number;
      ADMIN: number;
      USER: number;
    };
  };
  resources: {
    totalContacts: number;
    totalCampaigns: number;
    totalSessions: number;
    totalMessages: number;
  };
  activity: {
    activeToday: number;
    activeCampaigns: number;
    workingSessions: number;
  };
}

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


interface Settings {
  id: string;
  wahaHost: string;
  wahaApiKey: string;
  evolutionHost: string;
  evolutionApiKey: string;
  quepasaUrl?: string;
  quepasaLogin?: string;
  quepasaPassword?: string;
  logoUrl?: string;
  companyName?: string;
  faviconUrl?: string;
  pageTitle?: string;
  iconUrl?: string;
  openaiApiKey?: string;
  groqApiKey?: string;
}

const createSettingsSchema = (t: any) => z.object({
  wahaHost: z.string().refine((val) => !val || z.string().url().safeParse(val).success, {
    message: t('superAdmin.validation.hostInvalid')
  }),
  wahaApiKey: z.string().refine((val) => !val || val.length >= 10, {
    message: t('superAdmin.validation.apiKeyTooShort')
  }),
  evolutionHost: z.string().refine((val) => !val || z.string().url().safeParse(val).success, {
    message: t('superAdmin.validation.hostInvalid')
  }),
  evolutionApiKey: z.string().refine((val) => !val || val.length >= 10, {
    message: t('superAdmin.validation.apiKeyTooShort')
  }),
  quepasaUrl: z.string().refine((val) => !val || z.string().url().safeParse(val).success, {
    message: t('superAdmin.validation.urlInvalid')
  }),
  quepasaLogin: z.string().optional(),
  quepasaPassword: z.string().optional(),
});

const createGeneralSettingsSchema = (t: any) => z.object({
  companyName: z.string().refine((val) => !val || (val.length >= 1 && val.length <= 100), {
    message: t('superAdmin.validation.companyNameLength')
  }),
  pageTitle: z.string().refine((val) => !val || (val.length >= 1 && val.length <= 100), {
    message: t('superAdmin.validation.pageTitleLength')
  }),
});

type SettingsFormData = z.infer<ReturnType<typeof createSettingsSchema>>;
type GeneralSettingsFormData = z.infer<ReturnType<typeof createGeneralSettingsSchema>>;


export function SuperAdminManagerPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'integrations' | 'tenants' | 'users' | 'backup'>('general');

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [backupStats, setBackupStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    adminUser: {
      nome: '',
      email: '',
      senha: ''
    },
    quotas: {
      maxUsers: '10',
      maxContacts: '1000',
      maxCampaigns: '50',
      maxConnections: '5'
    },
    allowedProviders: ['WAHA', 'EVOLUTION', 'QUEPASA']
  });
  const [userFormData, setUserFormData] = useState<UserFormData>({
    nome: '',
    email: '',
    senha: '',
    role: 'USER',
    tenantId: '',
    tenantIds: [],
    ativo: true
  });
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');

  const [activeModal, setActiveModal] = useState<'waha' | 'evolution' | 'quepasa' | null>(null);
  const [integrationSettings, setIntegrationSettings] = useState<Settings | null>(null);

  // General settings states
  const [generalSettings, setGeneralSettings] = useState<Settings | null>(null);

  // Logo states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Favicon states
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string>('');
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  // Icon states
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>('');
  const [uploadingIcon, setUploadingIcon] = useState(false);

  useEffect(() => {
    loadData();
    if (activeTab === 'integrations') {
      loadIntegrationSettings();
    }
    if (activeTab === 'general' || activeTab === 'appearance') {
      loadGeneralSettings();
    }
  }, [activeTab]);

  const settingsSchema = createSettingsSchema(t);
  const generalSettingsSchema = createGeneralSettingsSchema(t);

  const {
    register,
    handleSubmit: handleFormSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  });

  // General settings form
  const {
    register: registerGeneral,
    handleSubmit: handleGeneralSubmit,
    setValue: setGeneralValue,
    formState: { errors: generalErrors, isSubmitting: isGeneralSubmitting },
  } = useForm<GeneralSettingsFormData>({
    resolver: zodResolver(generalSettingsSchema),
  });

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

  // Helper para uploads (sem Content-Type automatico)
  const authenticatedUpload = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
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

  const loadGeneralSettings = async () => {
    try {
      const response = await authenticatedFetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setGeneralSettings(data);
        setGeneralValue('companyName', data.companyName || '');
        setGeneralValue('pageTitle', data.pageTitle || '');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações gerais:', error);
      toast.error(t('settings.messages.loadError'));
    }
  };

  const onGeneralSubmit = async (data: GeneralSettingsFormData) => {
    try {
      const response = await authenticatedFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast.success(t('settings.messages.saved'));
        loadGeneralSettings();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || t('settings.messages.error'));
      }
    } catch (error) {
      console.error('Erro ao salvar configurações gerais:', error);
      toast.error(t('settings.messages.error'));
    }
  };

  const loadIntegrationSettings = async () => {
    try {
      const response = await authenticatedFetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setIntegrationSettings(data);
        setValue('wahaHost', data.wahaHost);
        setValue('wahaApiKey', data.wahaApiKey);
        setValue('evolutionHost', data.evolutionHost);
        setValue('evolutionApiKey', data.evolutionApiKey);
        setValue('quepasaUrl', data.quepasaUrl || '');
        setValue('quepasaLogin', data.quepasaLogin || '');
        setValue('quepasaPassword', data.quepasaPassword || '');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de integração:', error);
    }
  };

  const onIntegrationSubmit = async (data: SettingsFormData) => {
    try {
      const response = await authenticatedFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast.success(t('settings.messages.saved'));
        setActiveModal(null);
        loadIntegrationSettings();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || t('settings.messages.error'));
      }
    } catch (error) {
      console.error('Erro ao salvar configurações de integração:', error);
      toast.error(t('settings.messages.error'));
    }
  };

  // Logo handlers
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async () => {
    if (!logoFile) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);

      const response = await authenticatedUpload('/api/settings/logo', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast.success(t('settings.messages.saved'));
        loadGeneralSettings();
        setLogoFile(null);
        setLogoPreview('');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || t('settings.messages.error'));
      }
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
      toast.error(t('settings.messages.error'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    try {
      const response = await authenticatedFetch('/api/settings/logo', {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success(t('settings.messages.saved'));
        loadGeneralSettings();
      } else {
        toast.error(t('settings.messages.error'));
      }
    } catch (error) {
      console.error('Erro ao remover logo:', error);
      toast.error(t('settings.messages.error'));
    }
  };

  // Favicon handlers
  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFaviconFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setFaviconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadFavicon = async () => {
    if (!faviconFile) return;

    setUploadingFavicon(true);
    try {
      const formData = new FormData();
      formData.append('favicon', faviconFile);

      const response = await authenticatedUpload('/api/settings/favicon', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast.success(t('settings.messages.saved'));
        loadGeneralSettings();
        setFaviconFile(null);
        setFaviconPreview('');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || t('settings.messages.error'));
      }
    } catch (error) {
      console.error('Erro ao carregar favicon:', error);
      toast.error(t('settings.messages.error'));
    } finally {
      setUploadingFavicon(false);
    }
  };

  const removeFavicon = async () => {
    try {
      const response = await authenticatedFetch('/api/settings/favicon', {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success(t('settings.messages.saved'));
        loadGeneralSettings();
      } else {
        toast.error(t('settings.messages.error'));
      }
    } catch (error) {
      console.error('Erro ao remover favicon:', error);
      toast.error(t('settings.messages.error'));
    }
  };

  // Icon handlers
  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setIconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadIcon = async () => {
    if (!iconFile) return;

    setUploadingIcon(true);
    try {
      const formData = new FormData();
      formData.append('icon', iconFile);

      const response = await authenticatedUpload('/api/settings/icon', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast.success(t('settings.messages.saved'));
        loadGeneralSettings();
        setIconFile(null);
        setIconPreview('');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || t('settings.messages.error'));
      }
    } catch (error) {
      console.error('Erro ao carregar ícone:', error);
      toast.error(t('settings.messages.error'));
    } finally {
      setUploadingIcon(false);
    }
  };

  const removeIcon = async () => {
    try {
      const response = await authenticatedFetch('/api/settings/icon', {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success(t('settings.messages.saved'));
        loadGeneralSettings();
      } else {
        toast.error(t('settings.messages.error'));
      }
    } catch (error) {
      console.error('Erro ao remover ícone:', error);
      toast.error(t('settings.messages.error'));
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');

      if (activeTab === 'tenants') {
        const response = await fetch('/api/tenants', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setTenants(data.tenants || []);
        }
      } else if (activeTab === 'users') {
        // Usar endpoint global para SuperAdmin (visão de todos os usuários)
        const response = await fetch('/api/users/global', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUsers(data.data?.users || []);
        }
      } else if (activeTab === 'backup') {
        const response = await fetch('/api/backup/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setBackupStats(data.stats || null);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
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
        const status = !tenant.active ? t('superAdmin.messages.activated') : t('superAdmin.messages.deactivated');
        toast.success(t('superAdmin.messages.toggleStatusSuccess', { status }));
        loadData();
      } else {
        throw new Error(t('superAdmin.messages.toggleStatusError'));
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCreateTenant = () => {
    setEditingTenant(null);
    setFormData({
      name: '',
      adminUser: {
        nome: '',
        email: '',
        senha: ''
      },
      quotas: {
        maxUsers: '10',
        maxContacts: '1000',
        maxCampaigns: '50',
        maxConnections: '5'
      },
      allowedProviders: ['WAHA', 'EVOLUTION', 'QUEPASA']
    });
    setIsModalOpen(true);
  };

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name,
      adminUser: {
        nome: '',
        email: '',
        senha: ''
      },
      quotas: {
        maxUsers: tenant.quota?.maxUsers?.toString() || '10',
        maxContacts: tenant.quota?.maxContacts?.toString() || '1000',
        maxCampaigns: tenant.quota?.maxCampaigns?.toString() || '50',
        maxConnections: tenant.quota?.maxConnections?.toString() || '5'
      },
      allowedProviders: tenant.allowedProviders || ['WAHA', 'EVOLUTION', 'QUEPASA']
    });
    setIsModalOpen(true);
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (!confirm(t('settings.messages.removeConfirm', { name: tenant.name }))) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/tenants/${tenant.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success(t('contacts.messages.deleteSuccess'));
        loadData();
      } else {
        const error = await response.json();
        throw new Error(error.message || t('common.error'));
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSubmitTenant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || (!editingTenant && (!formData.adminUser.nome || !formData.adminUser.email || !formData.adminUser.senha))) {
      toast.error(t('contacts.validation.nameRequired')); // Using generic required message if available or just generic error
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const url = editingTenant ? `/api/tenants/${editingTenant.id}` : '/api/tenants';
      const method = editingTenant ? 'PUT' : 'POST';

      const body: any = {
        name: formData.name,
        quotas: formData.quotas,
        allowedProviders: formData.allowedProviders
      };

      if (!editingTenant) {
        body.adminUser = formData.adminUser;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        toast.success(editingTenant ? t('superAdmin.messages.updateSuccess') : t('superAdmin.messages.createSuccess'));
        setIsModalOpen(false);
        loadData();
      } else {
        const error = await response.json();
        throw new Error(error.message || (editingTenant ? t('superAdmin.messages.updateError') : t('superAdmin.messages.createError')));
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getUsagePercentage = (current: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  // User management functions
  const loadAvailableTenants = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      console.log('🔍 Loading tenants, token exists:', !!token);

      const response = await fetch('/api/users/tenants', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('🌐 Response status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Tenants data:', data);
        setAvailableTenants(data.data?.tenants || []);
        console.log('✅ Available tenants set:', data.data?.tenants?.length || 0);
      } else {
        const errorData = await response.text();
        console.error('❌ Error response:', response.status, errorData);
      }
    } catch (error) {
      console.error('💥 Exception loading tenants:', error);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setTenantSearchQuery(''); // Limpar busca ao criar novo usuário
    setUserFormData({
      nome: '',
      email: '',
      senha: '',
      role: 'USER',
      tenantId: '',
      tenantIds: [],
      ativo: true
    });
    loadAvailableTenants();
    setIsUserModalOpen(true);
  };

  const handleEditUser = async (user: User) => {
    setEditingUser(user);
    setTenantSearchQuery(''); // Limpar busca ao editar usuário

    // Carregar tenants do usuário via novo endpoint
    let userTenantIds: string[] = [];
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/user-tenants/users/${user.id}/tenants`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Tenants do usuário:', data);
        userTenantIds = (data.tenants || []).map((t: any) => t.id);
      }
    } catch (err) {
      console.error('Erro ao carregar tenants do usuário:', err);
    }

    setUserFormData({
      nome: user.nome,
      email: user.email,
      senha: '',
      role: user.role as 'SUPERADMIN' | 'ADMIN' | 'USER',
      tenantId: user.tenant?.id || '',
      tenantIds: userTenantIds,
      ativo: user.ativo
    });
    loadAvailableTenants();
    setIsUserModalOpen(true);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userFormData.nome || !userFormData.email || (!editingUser && !userFormData.senha)) {
      toast.error(t('users.messages.fillRequiredFields'));
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const body: any = {
        nome: userFormData.nome,
        email: userFormData.email,
        role: userFormData.role,
        ativo: userFormData.ativo
      };

      // Only send password if it's provided
      if (userFormData.senha) {
        body.senha = userFormData.senha;
      }

      // Handle tenant assignment based on role
      // Para SUPERADMIN, não enviamos tenantId (será null no backend)
      // Para outros roles, enviamos o primeiro tenant selecionado como compatibilidade
      if (userFormData.role !== 'SUPERADMIN' && userFormData.tenantIds && userFormData.tenantIds.length > 0) {
        body.tenantId = userFormData.tenantIds[0];
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const result = await response.json();
        const userId = editingUser ? editingUser.id : result.data?.user?.id;

        // Se tem tenants selecionados, criar associações (para qualquer role, incluindo SUPERADMIN)
        if (userFormData.tenantIds && userFormData.tenantIds.length > 0 && userId) {
          // Se estamos editando, primeiro remover associações antigas
          if (editingUser) {
            try {
              // Buscar associações existentes
              const existingAssociationsResponse = await fetch(`/api/user-tenants`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (existingAssociationsResponse.ok) {
                const existingData = await existingAssociationsResponse.json();
                // Remover associações que não estão mais selecionadas
                for (const association of existingData.tenants || []) {
                  if (!userFormData.tenantIds.includes(association.id)) {
                    try {
                      await fetch(`/api/user-tenants/associations/${userId}/${association.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                    } catch (err) {
                      console.warn('Erro ao remover associação:', association.id, err);
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('Erro ao buscar/remover associações antigas:', err);
            }
          }

          // Criar associações para todos os tenants selecionados
          for (const tenantId of userFormData.tenantIds) {
            try {
              const associationResponse = await fetch('/api/user-tenants/associations', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  userId,
                  tenantId,
                  role: userFormData.role
                })
              });

              // Se der erro 400 (já existe), não é problema
              if (!associationResponse.ok && associationResponse.status !== 400) {
                console.warn('Erro ao criar associação para tenant:', tenantId);
              }
            } catch (err) {
              console.warn('Erro ao criar associação para tenant:', tenantId, err);
            }
          }
        }

        toast.success(editingUser ? t('users.messages.updateSuccess') : t('users.messages.createSuccess'));
        setIsUserModalOpen(false);
        loadData();
      } else {
        const error = await response.json();

        // Verificar se é erro de quota
        if (error.upgradeRequired || (error.message && error.message.includes('Limite'))) {
          toast.error(error.message || t('users.messages.userLimitReached'), {
            duration: 6000,
            icon: '⚠️'
          });
          return;
        }

        throw new Error(error.message || (editingUser ? t('users.messages.updateError') : t('users.messages.createError')));
      }
    } catch (error: any) {
      // Não mostrar toast de erro genérico se já mostramos o toast específico de quota
      if (!(error.message && error.message.includes('Limite'))) {
        toast.error(error.message);
      }
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ativo: !user.ativo
        })
      });

      if (response.ok) {
        toast.success(!user.ativo ? t('users.messages.activateSuccess') : t('users.messages.deactivateSuccess'));
        loadData();
      } else {
        const error = await response.json();
        throw new Error(error.message || t('users.messages.statusChangeError'));
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(t('users.messages.deleteConfirmWithName', { name: user.nome }))) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success(t('users.messages.deleteSuccess'));
        loadData();
      } else {
        const error = await response.json();
        throw new Error(error.message || t('users.messages.deleteError'));
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
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
        <div className="flex items-center gap-4">
          <LanguageSelector variant="header" />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'general'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            ⚙️ {t('settings.title')}
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'appearance'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            🎨 {t('settings.tabs.appearance')}
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'integrations'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            🔗 {t('settings.tabs.integrations')}
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'tenants'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            🏢 {t('superAdmin.tenants.listTitle')}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'users'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            👥 {t('superAdmin.stats.users')}
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'backup'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            💾 {t('backup.title')}
          </button>
        </nav>
      </div>

      {/* Empresas Tab */}
      {activeTab === 'tenants' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t('superAdmin.tenants.manage')}</h2>
            <button
              onClick={handleCreateTenant}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('superAdmin.actions.create')}
            </button>
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

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleEditTenant(tenant)}
                      className="px-3 py-2 text-sm rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
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
                    <button
                      onClick={() => handleDeleteTenant(tenant)}
                      className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {tenants.length === 0 && (
              <div className="p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">{t('superAdmin.messages.noTenants')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Gerenciar Usuários</h2>
              <p className="text-sm text-gray-600 mt-1">Visualização e gerenciamento global de todos os usuários do sistema</p>
            </div>
            <button
              onClick={handleCreateUser}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar Usuário
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último Login</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.nome}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.tenant ? (
                        <div>
                          <div className="text-sm text-gray-900">{user.tenant.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{user.tenant.slug}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Sistema</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'SUPERADMIN'
                        ? 'bg-purple-100 text-purple-800'
                        : user.role === 'ADMIN'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                        }`}>
                        {user.role === 'SUPERADMIN' ? t('superAdmin.users.roles.superAdmin') :
                          user.role === 'ADMIN' ? t('superAdmin.users.roles.admin') : t('superAdmin.users.roles.user')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.ativo
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {user.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.ultimoLogin
                        ? new Date(user.ultimoLogin).toLocaleDateString('pt-BR')
                        : 'Nunca'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.criadoEm).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 hover:text-blue-900 text-sm"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(user)}
                          className={`text-sm ${user.ativo
                            ? 'text-red-600 hover:text-red-900'
                            : 'text-green-600 hover:text-green-900'
                            }`}
                        >
                          {user.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        {user.role !== 'SUPERADMIN' && (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-600 hover:text-red-900 text-sm"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">Nenhum usuário encontrado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal for Create/Edit Tenant */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTenant ? 'Editar Empresa' : 'Criar Nova Empresa'}
              </h3>
            </div>

            <form onSubmit={handleSubmitTenant} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coluna Esquerda - Dados da Empresa e Admin */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Dados da Empresa
                    </h4>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Nome da Empresa *
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nome da empresa"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">O identificador único será gerado automaticamente</p>
                  </div>

                  {!editingTenant && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Usuário Administrador
                      </h4>

                      <div className="space-y-3">
                        <div>
                          <label htmlFor="adminNome" className="block text-sm font-medium text-gray-700 mb-1">
                            Nome do Admin *
                          </label>
                          <input
                            type="text"
                            id="adminNome"
                            value={formData.adminUser.nome}
                            onChange={(e) => setFormData({
                              ...formData,
                              adminUser: { ...formData.adminUser, nome: e.target.value }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Nome completo"
                            required={!editingTenant}
                          />
                        </div>

                        <div>
                          <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-1">
                            E-mail do Admin *
                          </label>
                          <input
                            type="email"
                            id="adminEmail"
                            value={formData.adminUser.email}
                            onChange={(e) => setFormData({
                              ...formData,
                              adminUser: { ...formData.adminUser, email: e.target.value }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="admin@exemplo.com"
                            required={!editingTenant}
                          />
                        </div>

                        <div>
                          <label htmlFor="adminSenha" className="block text-sm font-medium text-gray-700 mb-1">
                            Senha do Admin *
                          </label>
                          <input
                            type="password"
                            id="adminSenha"
                            value={formData.adminUser.senha}
                            onChange={(e) => setFormData({
                              ...formData,
                              adminUser: { ...formData.adminUser, senha: e.target.value }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Senha segura"
                            required={!editingTenant}
                            minLength={6}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna Direita - Limites e Provedores */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Limites e Quotas
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="maxUsers" className="block text-sm font-medium text-gray-700 mb-1">
                          Máx. Usuários *
                        </label>
                        <input
                          type="number"
                          id="maxUsers"
                          min="1"
                          value={formData.quotas.maxUsers}
                          onChange={(e) => setFormData({
                            ...formData,
                            quotas: { ...formData.quotas, maxUsers: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="maxConnections" className="block text-sm font-medium text-gray-700 mb-1">
                          Máx. Conexões *
                        </label>
                        <input
                          type="number"
                          id="maxConnections"
                          min="1"
                          value={formData.quotas.maxConnections}
                          onChange={(e) => setFormData({
                            ...formData,
                            quotas: { ...formData.quotas, maxConnections: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="maxContacts" className="block text-sm font-medium text-gray-700 mb-1">
                          Máx. Contatos *
                        </label>
                        <input
                          type="number"
                          id="maxContacts"
                          min="1"
                          value={formData.quotas.maxContacts}
                          onChange={(e) => setFormData({
                            ...formData,
                            quotas: { ...formData.quotas, maxContacts: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="maxCampaigns" className="block text-sm font-medium text-gray-700 mb-1">
                          Máx. Campanhas *
                        </label>
                        <input
                          type="number"
                          id="maxCampaigns"
                          min="1"
                          value={formData.quotas.maxCampaigns}
                          onChange={(e) => setFormData({
                            ...formData,
                            quotas: { ...formData.quotas, maxCampaigns: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-md font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Provedores WhatsApp
                    </h4>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-gray-500">Selecione quais provedores de API a empresa poderá utilizar</p>
                      <button
                        type="button"
                        onClick={() => {
                          const allProviders = ['WAHA', 'EVOLUTION', 'QUEPASA'];
                          const allSelected = allProviders.every(p => formData.allowedProviders.includes(p));
                          setFormData({
                            ...formData,
                            allowedProviders: allSelected ? [] : allProviders
                          });
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {formData.allowedProviders.length === 3 ? 'Desmarcar Todos' : 'Selecionar Todos'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200">
                        <input
                          type="checkbox"
                          checked={formData.allowedProviders.includes('WAHA')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, allowedProviders: [...formData.allowedProviders, 'WAHA'] });
                            } else {
                              setFormData({ ...formData, allowedProviders: formData.allowedProviders.filter(p => p !== 'WAHA') });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <img src="/iconewaha.png" alt="WAHA" className="w-6 h-6 object-contain" />
                        <span className="text-sm font-medium text-gray-700">WAHA</span>
                      </label>
                      <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200">
                        <input
                          type="checkbox"
                          checked={formData.allowedProviders.includes('EVOLUTION')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, allowedProviders: [...formData.allowedProviders, 'EVOLUTION'] });
                            } else {
                              setFormData({ ...formData, allowedProviders: formData.allowedProviders.filter(p => p !== 'EVOLUTION') });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <img src="/iconeevolutionapi.png" alt="Evolution API" className="w-6 h-6 object-contain" />
                        <span className="text-sm font-medium text-gray-700">Evolution API</span>
                      </label>
                      <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200">
                        <input
                          type="checkbox"
                          checked={formData.allowedProviders.includes('QUEPASA')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, allowedProviders: [...formData.allowedProviders, 'QUEPASA'] });
                            } else {
                              setFormData({ ...formData, allowedProviders: formData.allowedProviders.filter(p => p !== 'QUEPASA') });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <img src="/iconequepasa.png" alt="Quepasa" className="w-6 h-6 object-contain" />
                        <span className="text-sm font-medium text-gray-700">Quepasa</span>
                      </label>
                    </div>
                    {formData.allowedProviders.length === 0 && (
                      <p className="text-xs text-red-500 mt-2">Selecione pelo menos um provedor</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  {editingTenant ? 'Atualizar' : 'Criar'} Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Create/Edit User */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingUser ? 'Editar Usuário' : 'Criar Novo Usuário'}
              </h3>
            </div>

            <form onSubmit={handleSubmitUser} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    id="userName"
                    value={userFormData.nome}
                    onChange={(e) => setUserFormData({ ...userFormData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nome completo do usuário"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    id="userEmail"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="email@exemplo.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="userPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Senha {editingUser ? '(deixe vazio para manter)' : '*'}
                  </label>
                  <input
                    type="password"
                    id="userPassword"
                    value={userFormData.senha}
                    onChange={(e) => setUserFormData({ ...userFormData, senha: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Senha segura"
                    required={!editingUser}
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Deve conter pelo menos 6 caracteres, uma maiúscula, uma minúscula e um número
                  </p>
                </div>

                <div>
                  <label htmlFor="userRole" className="block text-sm font-medium text-gray-700 mb-1">
                    Nível de Acesso *
                  </label>
                  <select
                    id="userRole"
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({
                      ...userFormData,
                      role: e.target.value as 'SUPERADMIN' | 'ADMIN' | 'USER'
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="USER">Usuário</option>
                    <option value="ADMIN">Administrador</option>
                    <option value="SUPERADMIN">Super Administrador (acesso global)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {userFormData.role === 'SUPERADMIN'
                      ? 'Super Admin tem acesso a TODAS as empresas automaticamente. Você pode opcionalmente associá-lo a empresas específicas.'
                      : 'Defina o nível de acesso do usuário nas empresas selecionadas'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Empresas {userFormData.role === 'SUPERADMIN' ? '(Opcional)' : '*'}
                  </label>

                  {availableTenants.length === 0 ? (
                    <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      Nenhuma empresa disponível
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Campo de busca */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Buscar empresa..."
                          value={tenantSearchQuery}
                          onChange={(e) => setTenantSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <svg
                          className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                        {tenantSearchQuery && (
                          <button
                            onClick={() => setTenantSearchQuery('')}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Lista de empresas */}
                      <div className="border border-gray-300 rounded-lg p-3 max-h-[250px] overflow-y-auto bg-white">
                        <div className="space-y-2">
                          {(() => {
                            const filteredTenants = availableTenants.filter(tenant =>
                              tenant.name.toLowerCase().includes(tenantSearchQuery.toLowerCase()) ||
                              tenant.slug.toLowerCase().includes(tenantSearchQuery.toLowerCase())
                            );

                            if (filteredTenants.length === 0) {
                              return (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                  </svg>
                                  Nenhuma empresa encontrada
                                </div>
                              );
                            }

                            return filteredTenants.map((tenant) => {
                              const isSelected = (userFormData.tenantIds || []).includes(tenant.id);
                              return (
                                <label
                                  key={tenant.id}
                                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${isSelected
                                    ? 'bg-blue-50 border border-blue-200'
                                    : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const tenantIds = userFormData.tenantIds || [];
                                      if (e.target.checked) {
                                        setUserFormData({
                                          ...userFormData,
                                          tenantIds: [...tenantIds, tenant.id]
                                        });
                                      } else {
                                        setUserFormData({
                                          ...userFormData,
                                          tenantIds: tenantIds.filter(id => id !== tenant.id)
                                        });
                                      }
                                    }}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <div className="ml-3 flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                        {tenant.name}
                                      </span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${tenant.active
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {tenant.active ? 'Ativa' : 'Inativa'}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {tenant.slug}
                                    </span>
                                  </div>
                                </label>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {userFormData.role === 'SUPERADMIN'
                        ? 'Deixe vazio para acesso global a todas as empresas'
                        : 'Selecione pelo menos uma empresa'}
                    </p>
                    {(userFormData.tenantIds || []).length > 0 && (
                      <span className="text-xs font-medium text-blue-600">
                        {(userFormData.tenantIds || []).length} selecionada{(userFormData.tenantIds || []).length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="userActive"
                    checked={userFormData.ativo}
                    onChange={(e) => setUserFormData({ ...userFormData, ativo: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="userActive" className="ml-2 block text-sm text-gray-700">
                    Usuário ativo
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  {editingUser ? 'Atualizar' : 'Criar'} Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Integrações</h2>
              <p className="text-sm text-gray-600 mt-1">Configurações das APIs externas</p>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* WAHA Card */}
              <div
                onClick={() => setActiveModal('waha')}
                className="bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 hover:border-green-300 rounded-lg p-6 cursor-pointer transition-all duration-200 flex flex-col items-center min-h-[180px] group"
              >
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-28 h-16 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img
                      src="/assets/logos/waha.png"
                      alt="WAHA Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div className="mt-auto text-center">
                  <p className="text-xs text-gray-500 mb-2">WhatsApp HTTP API</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${integrationSettings?.wahaHost && integrationSettings?.wahaApiKey
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                    }`}>
                    {integrationSettings?.wahaHost && integrationSettings?.wahaApiKey ? 'Configurado' : 'Não configurado'}
                  </span>
                </div>
              </div>

              {/* Evolution API Card */}
              <div
                onClick={() => setActiveModal('evolution')}
                className="bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 hover:border-green-300 rounded-lg p-6 cursor-pointer transition-all duration-200 flex flex-col items-center min-h-[180px] group"
              >
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-32 h-18 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img
                      src="/assets/logos/evolutionapi.png"
                      alt="Evolution API Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div className="mt-auto text-center">
                  <p className="text-xs text-gray-500 mb-2">WhatsApp API Evolution</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${integrationSettings?.evolutionHost && integrationSettings?.evolutionApiKey
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                    }`}>
                    {integrationSettings?.evolutionHost && integrationSettings?.evolutionApiKey ? 'Configurado' : 'Não configurado'}
                  </span>
                </div>
              </div>

              {/* Quepasa Card */}
              <div
                onClick={() => setActiveModal('quepasa')}
                className="bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 hover:border-purple-300 rounded-lg p-6 cursor-pointer transition-all duration-200 flex flex-col items-center min-h-[180px] group"
              >
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-28 h-16 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img
                      src="/logoquepasa.png?v=2"
                      alt="Quepasa Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div className="mt-auto text-center">
                  <p className="text-xs text-gray-500 mb-2">WhatsApp API Quepasa</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${integrationSettings?.quepasaUrl && integrationSettings?.quepasaLogin && integrationSettings?.quepasaPassword
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                    }`}>
                    {integrationSettings?.quepasaUrl && integrationSettings?.quepasaLogin && integrationSettings?.quepasaPassword ? 'Configurado' : 'Não configurado'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Tab */}
      {activeTab === 'backup' && (
        <SystemBackup />
      )}


      {/* General Settings Tab */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">
            🏢 Informações da Empresa
          </h2>

          <form onSubmit={handleGeneralSubmit(onGeneralSubmit)} className="space-y-4">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Empresa *
              </label>
              <input
                id="companyName"
                type="text"
                {...registerGeneral('companyName')}
                placeholder="Nome da sua empresa"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {generalErrors.companyName && (
                <p className="text-red-500 text-sm mt-1">
                  {generalErrors.companyName.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="pageTitle" className="block text-sm font-medium text-gray-700 mb-1">
                Título da Página *
              </label>
              <input
                id="pageTitle"
                type="text"
                {...registerGeneral('pageTitle')}
                placeholder="Ex: Astra Online - Gestão de Contatos"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {generalErrors.pageTitle && (
                <p className="text-red-500 text-sm mt-1">
                  {generalErrors.pageTitle.message}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Título que aparecerá na aba do navegador
              </p>
            </div>

            <button
              type="submit"
              disabled={isGeneralSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isGeneralSubmitting ? 'Salvando...' : 'Salvar Informações'}
            </button>
          </form>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          {/* Logo da Empresa */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">
              🎨 Logo da Empresa
            </h2>

            {/* Logo Atual */}
            {generalSettings?.logoUrl && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Logo Atual:</p>
                <div className="flex items-center space-x-4">
                  <img
                    src={generalSettings.logoUrl}
                    alt="Logo atual"
                    className="w-20 h-20 object-contain border border-gray-200 rounded-lg"
                  />
                  <button
                    onClick={removeLogo}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Remover
                  </button>
                </div>
              </div>
            )}

            {/* Upload Nova Logo */}
            <div className="space-y-4">
              <div>
                <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-1">
                  Nova Logo
                </label>
                <input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formatos aceitos: JPEG, PNG, GIF, WebP (max 5MB)
                </p>
              </div>

              {/* Preview */}
              {logoPreview && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                  <div className="flex items-center space-x-4">
                    <img
                      src={logoPreview}
                      alt="Preview"
                      className="w-20 h-20 object-contain border border-gray-200 rounded-lg"
                    />
                    <button
                      onClick={uploadLogo}
                      disabled={uploadingLogo}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {uploadingLogo ? 'Carregando...' : 'Carregar Logo'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ícone Geral */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">
              🏷️ Ícone Geral
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Ícone usado na página de login e no menu interno do sistema
            </p>

            {/* Ícone Atual */}
            {generalSettings?.iconUrl && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Ícone Atual:</p>
                <div className="flex items-center space-x-4">
                  <img
                    src={generalSettings.iconUrl}
                    alt="Ícone atual"
                    className="w-12 h-12 object-contain border border-gray-200 rounded"
                  />
                  <button
                    onClick={removeIcon}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Remover
                  </button>
                </div>
              </div>
            )}

            {/* Upload Novo Ícone */}
            <div className="space-y-4">
              <div>
                <label htmlFor="icon" className="block text-sm font-medium text-gray-700 mb-1">
                  Novo Ícone
                </label>
                <input
                  id="icon"
                  type="file"
                  accept="image/*"
                  onChange={handleIconChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Recomendado: PNG, 64x64px ou similar (max 5MB)
                </p>
              </div>

              {/* Preview */}
              {iconPreview && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                  <div className="flex items-center space-x-4">
                    <img
                      src={iconPreview}
                      alt="Preview"
                      className="w-12 h-12 object-contain border border-gray-200 rounded"
                    />
                    <button
                      onClick={uploadIcon}
                      disabled={uploadingIcon}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {uploadingIcon ? 'Carregando...' : 'Carregar Ícone'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Favicon da Plataforma */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">
              🌐 Favicon da Plataforma
            </h2>

            {/* Favicon Atual */}
            {generalSettings?.faviconUrl && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Favicon Atual:</p>
                <div className="flex items-center space-x-4">
                  <img
                    src={generalSettings.faviconUrl}
                    alt="Favicon atual"
                    className="w-8 h-8 object-contain border border-gray-200 rounded"
                  />
                  <button
                    onClick={removeFavicon}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Remover
                  </button>
                </div>
              </div>
            )}

            {/* Upload Novo Favicon */}
            <div className="space-y-4">
              <div>
                <label htmlFor="favicon" className="block text-sm font-medium text-gray-700 mb-1">
                  Novo Favicon
                </label>
                <input
                  id="favicon"
                  type="file"
                  accept="image/*"
                  onChange={handleFaviconChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formatos aceitos: PNG, ICO (recomendado 32x32px ou 16x16px)
                </p>
              </div>

              {/* Preview */}
              {faviconPreview && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                  <div className="flex items-center space-x-4">
                    <img
                      src={faviconPreview}
                      alt="Preview"
                      className="w-8 h-8 object-contain border border-gray-200 rounded"
                    />
                    <button
                      onClick={uploadFavicon}
                      disabled={uploadingFavicon}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {uploadingFavicon ? 'Carregando...' : 'Carregar Favicon'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal WAHA */}
      {activeModal === 'waha' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">🔗 Configurar WAHA</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit(onIntegrationSubmit)} className="space-y-4">
              <div>
                <label htmlFor="wahaHost" className="block text-sm font-medium text-gray-700 mb-1">
                  Host WAHA *
                </label>
                <input
                  id="wahaHost"
                  type="url"
                  {...register('wahaHost')}
                  placeholder="https://waha.exemplo.com.br"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.wahaHost && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.wahaHost.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="wahaApiKey" className="block text-sm font-medium text-gray-700 mb-1">
                  API Key WAHA *
                </label>
                <input
                  id="wahaApiKey"
                  type="password"
                  {...register('wahaApiKey')}
                  placeholder="sua-api-key-aqui"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.wahaApiKey && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.wahaApiKey.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Evolution API */}
      {activeModal === 'evolution' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">🚀 Configurar Evolution API</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit(onIntegrationSubmit)} className="space-y-4">
              <div>
                <label htmlFor="evolutionHost" className="block text-sm font-medium text-gray-700 mb-1">
                  Host Evolution *
                </label>
                <input
                  id="evolutionHost"
                  type="url"
                  {...register('evolutionHost')}
                  placeholder="https://evolution.exemplo.com.br"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.evolutionHost && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.evolutionHost.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="evolutionApiKey" className="block text-sm font-medium text-gray-700 mb-1">
                  API Key Evolution *
                </label>
                <input
                  id="evolutionApiKey"
                  type="password"
                  {...register('evolutionApiKey')}
                  placeholder="sua-api-key-evolution-aqui"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.evolutionApiKey && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.evolutionApiKey.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Quepasa */}
      {activeModal === 'quepasa' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <img src="/logoquepasa.png?v=2" alt="Quepasa" className="w-6 h-6 object-contain" />
                <h3 className="text-lg font-semibold text-gray-900">Configurar Quepasa</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit(onIntegrationSubmit)} className="space-y-4">
              <div>
                <label htmlFor="quepasaUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  URL do Quepasa *
                </label>
                <input
                  id="quepasaUrl"
                  type="url"
                  {...register('quepasaUrl')}
                  placeholder="https://quepasa.exemplo.com.br"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {errors.quepasaUrl && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.quepasaUrl.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="quepasaLogin" className="block text-sm font-medium text-gray-700 mb-1">
                  Login *
                </label>
                <input
                  id="quepasaLogin"
                  type="text"
                  {...register('quepasaLogin')}
                  placeholder="admin"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {errors.quepasaLogin && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.quepasaLogin.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="quepasaPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Senha *
                </label>
                <input
                  id="quepasaPassword"
                  type="password"
                  {...register('quepasaPassword')}
                  placeholder="••••••••••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {errors.quepasaPassword && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.quepasaPassword.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}