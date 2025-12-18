import { useTranslation } from 'react-i18next';
import { User } from '../types';

interface UserListProps {
  users: User[];
  loading: boolean;
  onEdit: (user: User) => void;
  onDelete: (id: string) => void;
}

export function UserList({ users, loading, onEdit, onDelete }: UserListProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('users.list.noUsers')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.list.headers.name')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.list.headers.email')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.list.headers.role')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.list.headers.status')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.list.headers.lastLogin')}
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.list.headers.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{user.nome}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{user.email}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'ADMIN'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                  }`}>
                  {user.role === 'ADMIN' ? t('users.list.roles.admin') : t('users.list.roles.user')}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.ativo
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                  }`}>
                  {user.ativo ? t('users.list.status.active') : t('users.list.status.inactive')}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {user.ultimoLogin
                  ? new Date(user.ultimoLogin).toLocaleString('pt-BR')
                  : t('users.list.never')
                }
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() => onEdit(user)}
                  className="text-blue-600 hover:text-blue-900 mr-3"
                >
                  {t('users.list.edit')}
                </button>
                <button
                  onClick={() => onDelete(user.id)}
                  className="text-red-600 hover:text-red-900"
                >
                  {t('users.list.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}