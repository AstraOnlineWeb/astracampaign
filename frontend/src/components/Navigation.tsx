import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSelector } from './LanguageSelector';

export function Navigation() {
  const { t } = useTranslation();
  const location = useLocation();
  const { settings, loading } = useSettings();
  const { user, logout } = useAuth();

  const menuItems = [
    {
      path: '/whatsapp',
      label: t('navigation.connections'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    },
    {
      path: '/contatos',
      label: t('navigation.contacts'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      path: '/campanhas',
      label: t('navigation.campaigns'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      )
    },
    {
      path: '/campanhas/interativa',
      label: t('navigation.interactiveCampaign'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    ...(['ADMIN', 'TENANT_ADMIN', 'SUPERADMIN'].includes(user?.role || '') ? [{
      path: '/usuarios',
      label: t('navigation.users'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      )
    }] : []),
    {
      path: '/configuracoes',
      label: t('navigation.settings'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    ...(user?.role === 'SUPERADMIN' ? [{
      path: '/super-admin',
      label: t('navigation.superAdmin'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    }] : [])
  ];

  return (
    <nav className="sidebar-navigation w-20 shadow-lg flex flex-col" style={{ background: 'var(--sidebar-bg)' }}>
      <div className="p-4 flex-1">
        {/* Ícone */}
        <div className="mb-8 flex items-center justify-center">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
            {loading ? (
              <div className="h-8 w-8 bg-white/20 animate-pulse rounded"></div>
            ) : settings?.iconUrl ? (
              <img
                src={settings.iconUrl}
                alt={settings?.companyName || 'Sistema'}
                className="max-h-8 max-w-8 object-contain"
              />
            ) : (
              <span className="text-white font-bold text-lg">
                {settings?.companyName?.charAt(0)?.toUpperCase() || 'A'}
              </span>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <ul className="space-y-3">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${location.pathname === item.path
                    ? 'bg-white shadow-lg'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                style={location.pathname === item.path ?
                  { color: 'var(--astra-dark-blue)' } : undefined
                }
                title={item.label}
              >
                {item.icon}

                {/* Tooltip */}
                <div className="absolute left-16 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Language Selector and Logout - Fixed to footer */}
      <div className="p-4 relative z-50 space-y-3">
        {/* Language Selector */}
        <div className="flex justify-center">
          <LanguageSelector variant="navigation" />
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 text-white/70 hover:text-white hover:bg-red-500/20 mx-auto z-50"
          title={t('navigation.logout')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>

          {/* Tooltip */}
          <div className="absolute left-16 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            {t('navigation.logout')}
          </div>
        </button>
      </div>
    </nav>
  );
}