import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PerfexSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  perfexUrl?: string;
  perfexToken?: string;
  onSave: (url: string, token: string) => void;
}

export function PerfexSyncModal({ isOpen, onClose, perfexUrl = '', perfexToken = '', onSave }: PerfexSyncModalProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(perfexUrl);
  const [token, setToken] = useState(perfexToken);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(url, token);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setUrl(perfexUrl);
    setToken(perfexToken);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-100 my-8" role="dialog" aria-labelledby="perfex-sync-title">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 id="perfex-sync-title" className="text-xl font-bold text-gray-900">
                {t('perfexSync.title')}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t('perfexSync.subtitle')}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={t('common.close')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Perfex URL */}
            <div>
              <label htmlFor="perfexUrl" className="block text-sm font-medium text-gray-700 mb-1">
                {t('perfexSync.fields.url')}
              </label>
              <input
                id="perfexUrl"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('perfexSync.fields.urlPlaceholder')}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('perfexSync.fields.urlHint')}
              </p>
            </div>

            {/* Perfex Token */}
            <div>
              <label htmlFor="perfexToken" className="block text-sm font-medium text-gray-700 mb-1">
                {t('perfexSync.fields.token')}
              </label>
              <input
                id="perfexToken"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('perfexSync.fields.tokenPlaceholder')}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('perfexSync.fields.tokenHint')}
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-medium text-purple-900 text-sm mb-2">ℹ️ {t('perfexSync.instructions.title')}</h3>
              <ul className="text-xs text-purple-700 space-y-1">
                {(t('perfexSync.instructions.steps', { returnObjects: true }) as string[]).map((step, index) => (
                  <li key={index}>• {step}</li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 font-medium transition-colors text-sm"
              >
                {t('perfexSync.buttons.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving || !url || !token}
                className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('perfexSync.buttons.saving')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('perfexSync.buttons.save')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
