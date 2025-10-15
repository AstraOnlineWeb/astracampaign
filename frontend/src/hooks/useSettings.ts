import { useState, useEffect } from 'react';

interface Settings {
  id: string;
  wahaHost: string;
  wahaApiKey: string;
  evolutionHost: string;
  evolutionApiKey: string;
  digitalSacHost: string;
  digitalSacToken: string;
  logoUrl?: string;
  companyName?: string;
  faviconUrl?: string;
  pageTitle?: string;
  iconUrl?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      // Só carrega se houver token (usuário autenticado)
      if (!token) {
        setLoading(false);
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      (headers as Record<string, string>).Authorization = `Bearer ${token}`;

      const response = await fetch('/api/settings', { headers });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        setError('Erro ao carregar configurações');
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      setError('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    refetch: loadSettings
  };
}