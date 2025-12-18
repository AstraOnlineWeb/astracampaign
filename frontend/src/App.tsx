import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navigation } from './components/Navigation';
import { ContactsPage } from './pages/ContactsPage';
import { WhatsAppConnectionsPage } from './pages/WhatsAppConnectionsPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { InteractiveCampaignPage } from './pages/InteractiveCampaignPage';
import { FlowBuilderPage } from './pages/FlowBuilderPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { LoginPage } from './pages/LoginPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { SuperAdminManagerPage } from './pages/SuperAdminManagerPage';
import { useGlobalSettings } from './hooks/useGlobalSettings';
import './styles/globals.css';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { settings } = useGlobalSettings();
  const { t } = useTranslation();

  // Aplicar meta tags dinâmicas (título e favicon)
  useEffect(() => {
    // Atualizar título da página
    if (settings?.pageTitle) {
      document.title = settings.pageTitle;
    }

    // Atualizar favicon
    if (settings?.faviconUrl) {
      // Remover favicons existentes
      const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
      existingFavicons.forEach(favicon => favicon.remove());

      // Adicionar novo favicon com cache busting
      const favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.type = 'image/png';
      favicon.href = settings.faviconUrl + '?v=' + Date.now();
      document.head.appendChild(favicon);

      // Adicionar também como shortcut icon para compatibilidade
      const shortcutIcon = document.createElement('link');
      shortcutIcon.rel = 'shortcut icon';
      shortcutIcon.type = 'image/png';
      shortcutIcon.href = settings.faviconUrl + '?v=' + Date.now();
      document.head.appendChild(shortcutIcon);
    }
  }, [settings?.pageTitle, settings?.faviconUrl]);

  // Remove any banners dynamically - more specific targeting
  useEffect(() => {
    const removeBanners = () => {
      // Remove elements with specific version banner text
      const elements = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent && el.textContent.includes('BUILD 2025-09-17-19:02')
      );
      elements.forEach(el => {
        el.remove();
      });
    };

    // Run on mount
    removeBanners();

    // Run every 5 seconds (less aggressive)
    const interval = setInterval(removeBanners, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loadingDots')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <main className="main-content flex-1 flex flex-col">
        <Routes>
          <Route path="/login" element={<Navigate to="/contatos" replace />} />
          <Route path="/" element={<Navigate to="/contatos" replace />} />
          <Route
            path="/contatos"
            element={
              <ProtectedRoute>
                <ContactsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/whatsapp"
            element={
              <ProtectedRoute>
                <WhatsAppConnectionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campanhas"
            element={
              <ProtectedRoute>
                <CampaignsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campanhas/interativa"
            element={
              <ProtectedRoute>
                <InteractiveCampaignPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campanhas/interativa/:id"
            element={
              <ProtectedRoute>
                <FlowBuilderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute superAdminOnly={true}>
                <SuperAdminManagerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/dashboard"
            element={
              <ProtectedRoute superAdminOnly={true}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/tenants"
            element={
              <ProtectedRoute superAdminOnly={true}>
                <SuperAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute adminOnly={true}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <TenantProvider>
          <AppContent />
          <Toaster
            position="top-right"
            containerStyle={{
              top: 80,
            }}
            toastOptions={{
              duration: 4000,
              className: '',
              style: {
                background: '#1e293b',
                color: '#fff',
                borderRadius: '12px',
                fontSize: '14px',
                padding: '12px 16px',
                paddingRight: '40px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              },
              success: {
                className: '',
                style: {
                  background: '#10b981',
                  color: '#fff',
                },
              },
              error: {
                className: '',
                style: {
                  background: '#ef4444',
                  color: '#fff',
                },
              },
              loading: {
                className: '',
                style: {
                  background: '#1e293b',
                  color: '#fff',
                },
              },
            }}
          >
            {(t) => {
              const backgroundColor =
                t.type === 'success' ? '#10b981' :
                t.type === 'error' ? '#ef4444' :
                '#1e293b';

              return (
                <div
                  className="flex items-center gap-2"
                  style={{
                    position: 'relative',
                    background: backgroundColor,
                    color: '#fff',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    paddingRight: '40px',
                    fontSize: '14px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  }}
                >
                  {/* Ícone baseado no tipo */}
                  {t.type === 'success' && (
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {t.type === 'error' && (
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {t.type === 'loading' && (
                    <svg className="w-5 h-5 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}

                  {/* Mensagem */}
                  <div className="flex-1">{t.message as any}</div>

                  {/* Botão fechar */}
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-white/20 rounded-full p-1 transition-colors"
                    aria-label={t('common.closeNotification')}
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            }}
          </Toaster>
        </TenantProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;