import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';

interface ChatwootTag {
  name: string;
  count: number;
}

interface TagMapping {
  chatwootTag: string;
  categoryId: string;
}

interface ChatwootSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChatwootSyncModal({ isOpen, onClose, onSuccess }: ChatwootSyncModalProps) {
  const { t } = useTranslation();
  const [chatwootTags, setChatwootTags] = useState<ChatwootTag[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tagMappings, setTagMappings] = useState<TagMapping[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const loadCategories = async () => {
    try {
      const response = await apiService.getCategories();
      const categoriesData = response.categories || [];
      setCategories(categoriesData);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast.error(t('common.error'));
      setCategories([]);
    }
  };

  const loadChatwootTags = async () => {
    setIsLoadingTags(true);
    try {
      const response = await apiService.getChatwootTags();
      setChatwootTags(response.tags);
      if (response.tags.length === 0) {
        toast(t('chatwootSync.noTags'), { icon: 'ℹ️' });
      } else {
        toast.success(t('chatwootSync.tagsFound', { count: response.tags.length }));
      }
    } catch (error: any) {
      console.error('Erro ao carregar tags do Chatwoot:', error);
      const errorMessage = error.message || t('common.error');

      // Se for erro de configuração, mostrar mensagem específica
      if (errorMessage.includes('Configure') || errorMessage.includes('não configurado')) {
        toast.error(t('chatwootSync.messages.configError'), { duration: 5000 });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoadingTags(false);
    }
  };

  const handleTagMappingChange = (chatwootTag: string, categoryId: string) => {
    setTagMappings((prev) => {
      const existing = prev.find((m) => m.chatwootTag === chatwootTag);
      if (existing) {
        if (!categoryId) {
          // Remove if no category selected
          return prev.filter((m) => m.chatwootTag !== chatwootTag);
        }
        // Update existing
        return prev.map((m) =>
          m.chatwootTag === chatwootTag ? { ...m, categoryId } : m
        );
      } else if (categoryId) {
        // Add new
        return [...prev, { chatwootTag, categoryId }];
      }
      return prev;
    });
  };

  const handleSync = async () => {
    if (tagMappings.length === 0) {
      toast.error(t('chatwootSync.messages.selectTag'));
      return;
    }

    setIsSyncing(true);
    try {
      const response = await apiService.syncChatwootContacts(tagMappings);
      toast.success(
        t('chatwootSync.messages.success', { imported: response.imported, updated: response.updated })
      );
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao sincronizar:', error);
      toast.error(error.message || t('common.error'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClose = () => {
    setChatwootTags([]);
    setTagMappings([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-gray-100 my-8" role="dialog" aria-labelledby="chatwoot-sync-title">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 id="chatwoot-sync-title" className="text-xl font-bold text-gray-900">
                {t('chatwootSync.title')}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t('chatwootSync.subtitle')}
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

          <div className="space-y-4">
            {/* Load Tags Button */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium text-gray-900 text-sm">{t('chatwootSync.columns.tag')}s</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {chatwootTags.length > 0
                    ? t('chatwootSync.tagsFound', { count: chatwootTags.length })
                    : t('chatwootSync.clickToLoad')}
                </p>
              </div>
              <button
                onClick={loadChatwootTags}
                disabled={isLoadingTags}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingTags ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('chatwootSync.loading')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {chatwootTags.length > 0 ? t('chatwootSync.updateTags') : t('chatwootSync.loadTags')}
                  </>
                )}
              </button>
            </div>

            {/* Tag Mappings */}
            {chatwootTags.length > 0 && (
              <div className="border border-gray-200 rounded-lg">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-xs font-medium text-gray-700">
                    <div>{t('chatwootSync.columns.tag')}</div>
                    <div>{t('chatwootSync.columns.contacts')}</div>
                    <div>{t('chatwootSync.columns.category')}</div>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {chatwootTags.map((tag) => (
                    <div
                      key={tag.name}
                      className="px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="grid grid-cols-3 gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {tag.name}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {tag.count} {tag.count === 1 ? 'contato' : 'contatos'}
                        </div>
                        <div>
                          <select
                            value={tagMappings.find((m) => m.chatwootTag === tag.name)?.categoryId || ''}
                            onChange={(e) => handleTagMappingChange(tag.name, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">{t('chatwootSync.placeholders.selectCategory')}</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            {chatwootTags.length === 0 && !isLoadingTags && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 text-sm mb-2">ℹ️ {t('chatwootSync.instructions.title')}</h3>
                <ul className="text-xs text-blue-700 space-y-1">
                  {t<string[]>('chatwootSync.instructions.steps', { returnObjects: true }).map((step: string, index: number) => (
                    <li key={index}>• {step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Selected Mappings Summary */}
            {tagMappings.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-900 text-sm mb-2">
                  ✓ {t('chatwootSync.selection', { count: tagMappings.length })}
                </h3>
                <div className="text-xs text-green-700 space-y-1">
                  {tagMappings.map((mapping) => {
                    const tag = chatwootTags.find((t) => t.name === mapping.chatwootTag);
                    const category = categories.find((c) => c.id === mapping.categoryId);
                    return (
                      <div key={mapping.chatwootTag}>
                        • <strong>{mapping.chatwootTag}</strong> ({tag?.count || 0} contatos) → {category?.nome || t('common.category')}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              onClick={handleClose}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 font-medium transition-colors text-sm"
            >
              {t('csvImport.buttons.close')}
            </button>
            <button
              onClick={handleSync}
              disabled={tagMappings.length === 0 || isSyncing}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSyncing ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('chatwootSync.syncing')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t('chatwootSync.syncButton')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
