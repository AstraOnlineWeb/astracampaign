import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../contexts/AuthContext';
import { TenantSelector } from './TenantSelector';
import { LanguageSelector } from './LanguageSelector';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { t } = useTranslation();
  const { settings, loading } = useSettings();
  const { user } = useAuth();

  const getUserRoleText = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return t('header.roles.admin');
      case 'USER':
        return t('header.roles.user');
      case 'SUPERADMIN':
        return t('header.roles.superadmin');
      default:
        return t('header.roles.user');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Título e Subtítulo */}
        <div className="flex items-center space-x-4">
          {/* Logo da empresa no header */}
          <div className="flex items-center space-x-3">
            {!loading && (
              <img
                src={settings?.logoUrl || '/assets/default-logo.png'}
                alt={settings?.companyName || 'Astra Online'}
                className="h-8 w-auto object-contain"
              />
            )}
            {loading && (
              <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
            )}
            <div className="border-l border-gray-300 pl-3">
              <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
              {subtitle && (
                <p className="text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
          </div>
        </div>

        {/* Ações da direita */}
        <div className="flex items-center space-x-4">
          {/* Language Selector */}
          <LanguageSelector variant="header" />

          {/* Tenant Selector */}
          <TenantSelector />

          {/* Avatar do usuário */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--astra-dark-blue)' }}>
              <span className="text-white text-sm font-medium">
                {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.nome || t('header.roles.user')}</p>
              <p className="text-xs text-gray-500">{getUserRoleText(user?.role || 'USER')}</p>
            </div>
          </div>

          {/* Ações customizadas */}
          {actions && (
            <div className="flex items-center space-x-2 border-l border-gray-200 pl-4">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}