import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsers } from '../hooks/useUsers';
import { UserList } from '../components/UserList';
import { UserForm } from '../components/UserForm';
import { User, UserInput } from '../types';
import toast from 'react-hot-toast';
import { Header } from '../components/Header';

export function UsersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();

  const pageSize = 20;

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

  const { users, totalPages, loading, error, refresh, deleteUser } = useUsers({
    search: search || undefined,
    page: currentPage,
    pageSize,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleCreateUser = async (data: UserInput) => {
    try {
      const response = await authenticatedFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || t('errors.generic');
        throw new Error(errorMessage);
      }

      toast.success(t('users.messages.created'));
      setIsFormOpen(false);
      refresh();
    } catch (err) {
      console.error('Erro ao criar usuário:', err);
      toast.error(err instanceof Error ? err.message : t('errors.generic'));
    }
  };

  const handleUpdateUser = async (data: UserInput) => {
    if (!editingUser) return;

    try {
      const response = await authenticatedFetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(t('errors.generic'));
      }

      toast.success(t('users.messages.updated'));
      setIsFormOpen(false);
      setEditingUser(undefined);
      refresh();
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err);
      toast.error(t('errors.generic'));
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm(t('users.messages.deleteConfirm'))) {
      return;
    }

    try {
      await deleteUser(id);
      toast.success(t('users.messages.deleted'));
    } catch (err) {
      toast.error(t('errors.generic'));
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingUser(undefined);
  };

  return (
    <>
      <Header
        title={t('users.title')}
        subtitle={t('common.selected', { count: users.length })}
        actions={
          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-colors"
          >
            {t('users.newUser')}
          </button>
        }
      />

      <div className="p-6">
        <div className="mb-4">
          <input
            type="text"
            placeholder={t('common.search') + '...'}
            value={search}
            onChange={handleSearchChange}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <UserList
            users={users}
            loading={loading}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
          />
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center mt-6 space-x-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 rounded-lg ${page === currentPage
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}

        {isFormOpen && (
          <UserForm
            user={editingUser}
            onSubmit={editingUser ? handleUpdateUser : handleCreateUser}
            onCancel={handleCloseForm}
          />
        )}
      </div>
    </>
  );
}