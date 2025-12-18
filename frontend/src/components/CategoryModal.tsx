import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Category } from '../types';
import { CategoryList } from './CategoryList';
import { CategoryForm } from './CategoryForm';
import { useCategories } from '../hooks/useCategories';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CategoryModal({ isOpen, onClose }: CategoryModalProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();

  const pageSize = 5; // Menor para o modal

  const {
    categories,
    total,
    loading,
    error,
    refresh,
    deleteCategory
  } = useCategories({
    search: search || undefined,
    page: currentPage,
    pageSize,
  });

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingCategory(undefined);
    refresh();
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingCategory(undefined);
  };

  const handleNewCategory = () => {
    setEditingCategory(undefined);
    setIsFormOpen(true);
  };

  if (!isOpen) return null;

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-100">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-red-600 mb-4">{t('common.error')}</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={refresh}
                className="btn-primary py-3 px-6"
              >
                {t('common.retry')}
              </button>
              <button
                onClick={onClose}
                className="bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 font-medium transition-all duration-200 border border-gray-200"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{t('categories.title')}</h2>
                  <p className="text-gray-600">{t('categories.subtitle')}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleNewCategory}
                className="bg-green-600 text-white py-2.5 px-5 rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                + {t('categories.newCategory')}
              </button>
              <button
                onClick={onClose}
                className="bg-gray-100 text-gray-700 py-2.5 px-5 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 font-medium transition-all duration-200 border border-gray-200"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div className="flex-1 max-w-md relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder={t('categories.searchPlaceholder')}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="input-field pl-10"
              />
            </div>
            {search && (
              <button
                onClick={handleClearFilters}
                className="ml-4 px-4 py-2 text-gray-600 hover:text-gray-800 focus:outline-none bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('common.clear')}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          <CategoryList
            categories={categories}
            loading={loading}
            onEdit={handleEdit}
            onDelete={deleteCategory}
          />
        </div>

        {/* Pagination */}
        {total > 5 && (
          <div className="p-6 border-t border-gray-100 bg-white">
            <div className="flex justify-center">
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 font-medium transition-colors"
                >
                  {t('categories.pagination.previous')}
                </button>

                {Array.from({ length: Math.ceil(total / pageSize) }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-4 py-2 border rounded-lg font-medium transition-colors ${currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    style={currentPage === page ? { backgroundColor: 'var(--astra-dark-blue)', borderColor: 'var(--astra-dark-blue)' } : undefined}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(total / pageSize)}
                  className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 font-medium transition-colors"
                >
                  {t('categories.pagination.next')}
                </button>
              </div>
            </div>
            <div className="text-center text-sm text-gray-500 mt-3">
              {t('categories.pagination.showing', { count: categories.length, total: total, currentPage: currentPage, totalPages: Math.ceil(total / pageSize) })}
            </div>
          </div>
        )}

        {/* Category Form Modal */}
        {isFormOpen && (
          <CategoryForm
            category={editingCategory}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}
      </div>
    </div>
  );
}