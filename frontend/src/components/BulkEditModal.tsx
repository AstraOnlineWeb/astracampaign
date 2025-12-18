import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCategories } from '../hooks/useCategories';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContactIds: string[];
  onSuccess: () => void;
}

export function BulkEditModal({ isOpen, onClose, selectedContactIds, onSuccess }: BulkEditModalProps) {
  const { t } = useTranslation();
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [action, setAction] = useState<'update' | 'delete'>('update');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { categories } = useCategories();

  useEffect(() => {
    if (isOpen) {
      setCategoriaId('');
      setAction('update');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedContactIds.length === 0) {
      toast.error(t('bulkEdit.messages.noSelection'));
      return;
    }

    if (action === 'update' && !categoriaId) {
      toast.error(t('bulkEdit.messages.selectCategory'));
      return;
    }

    setIsSubmitting(true);

    try {
      if (action === 'update') {
        await api.post('/contatos/bulk/update', {
          contactIds: selectedContactIds,
          updates: {
            categoriaId: categoriaId || null,
          },
        });
        toast.success(t('bulkEdit.messages.updateSuccess', { count: selectedContactIds.length }));
      } else {
        const confirmDelete = window.confirm(
          t('bulkEdit.warning', { count: selectedContactIds.length })
        );
        if (!confirmDelete) {
          setIsSubmitting(false);
          return;
        }

        await api.post('/contatos/bulk/delete', {
          contactIds: selectedContactIds,
        });
        toast.success(t('bulkEdit.messages.deleteSuccess', { count: selectedContactIds.length }));
      }
      onSuccess();
    } catch (error: any) {
      console.error('Erro na operação em massa:', error);
      toast.error(error.response?.data?.error || t('bulkEdit.messages.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--astra-dark-blue)' }}>
          {t('bulkEdit.title')}
        </h2>

        <p className="text-sm text-gray-600 mb-6">
          {t('bulkEdit.subtitle', { count: selectedContactIds.length })}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('bulkEdit.actions.label')}
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as 'update' | 'delete')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="update">{t('bulkEdit.actions.update')}</option>
              <option value="delete">{t('bulkEdit.actions.delete')}</option>
            </select>
          </div>

          {action === 'update' && (
            <div>
              <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 mb-2">
                {t('bulkEdit.fields.category')} *
              </label>
              <select
                id="categoria"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={action === 'update'}
              >
                <option value="">{t('bulkEdit.messages.selectCategory')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {action === 'delete' && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-800">
                ⚠️ {t('bulkEdit.warning', { count: selectedContactIds.length })}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              {t('bulkEdit.buttons.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 px-4 py-2 rounded-md text-white focus:outline-none focus:ring-2 disabled:opacity-50 ${action === 'delete'
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
            >
              {isSubmitting
                ? t('bulkEdit.buttons.processing')
                : action === 'delete'
                  ? t('bulkEdit.buttons.delete')
                  : t('bulkEdit.buttons.update')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
