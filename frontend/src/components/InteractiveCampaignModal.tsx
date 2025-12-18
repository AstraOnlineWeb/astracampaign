import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Portal } from './Portal';

interface InteractiveCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initialName?: string;
  title?: string;
}

export function InteractiveCampaignModal({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  title,
}: InteractiveCampaignModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const modalTitle = title || t('interactiveCampaigns.modal.title');

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
    }
  }, [isOpen, initialName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    onSave(name);
    handleClose();
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-card max-w-md w-full p-6 z-10">
            <h2 className="text-xl font-semibold text-ui-text mb-4">{modalTitle}</h2>

            <form onSubmit={handleSubmit}>
              {/* Nome */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-ui-text mb-2">
                  {t('interactiveCampaigns.modal.campaignName')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('interactiveCampaigns.modal.campaignNamePlaceholder')}
                  className="w-full px-4 py-2 border border-ui-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  required
                  autoFocus
                />
                <p className="mt-2 text-xs text-ui-sub">
                  {t('interactiveCampaigns.modal.helpText')}
                </p>
              </div>

              {/* Ações */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-ui-sub hover:text-ui-text transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-brand-primary text-white rounded-xl hover:opacity-90 transition-opacity"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Portal>
  );
}
