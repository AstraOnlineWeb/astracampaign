import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Contact } from '../types';
import { formatPhoneNumber } from '../utils/phoneUtils';

interface ContactListProps {
  contacts: Contact[];
  loading: boolean;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  selectedContactIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  selectionMode?: boolean;
}

export function ContactList({
  contacts,
  loading,
  onEdit,
  onDelete,
  selectedContactIds = [],
  onToggleSelect,
  onSelectAll,
  selectionMode = false,
}: ContactListProps) {
  const { t, i18n } = useTranslation();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      onDelete(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label={t('contacts.list.loading')}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: 'var(--astra-dark-blue)' }}></div>
        <span className="ml-2 text-gray-600">{t('contacts.list.loading')}...</span>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>{t('contacts.list.noContacts')}</p>
      </div>
    );
  }

  const allSelected = contacts.length > 0 && selectedContactIds.length === contacts.length;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200" role="table">
        <thead className="bg-gray-50">
          <tr>
            {selectionMode && (
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  aria-label={t('contacts.list.selectAll')}
                />
              </th>
            )}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('common.name')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('common.phone')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('common.email')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('common.category')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('contacts.list.updatedAt')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('common.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {contacts.map((contact) => {
            const isSelected = selectedContactIds.includes(contact.id);
            return (
              <tr key={contact.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                {selectionMode && (
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect?.(contact.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      aria-label={t('contacts.list.selectContact', { name: contact.nome })}
                    />
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {contact.nome}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatPhoneNumber(contact.telefone)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {contact.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {contact.categoria ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ color: 'var(--astra-dark-blue)', backgroundColor: 'rgba(30, 58, 95, 0.1)' }}>
                      {contact.categoria.nome}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(contact.atualizadoEm)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(contact)}
                      className="hover:opacity-80 focus:outline-none focus:underline transition-opacity"
                      style={{ color: 'var(--astra-dark-blue)' }}
                      aria-label={t('contacts.list.editContact', { name: contact.nome })}
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className={`focus:outline-none focus:underline ${deleteConfirm === contact.id
                          ? 'text-red-800 font-semibold'
                          : 'text-red-600 hover:text-red-900'
                        }`}
                      aria-label={
                        deleteConfirm === contact.id
                          ? t('contacts.list.confirmDelete', { name: contact.nome })
                          : t('contacts.list.deleteContact', { name: contact.nome })
                      }
                    >
                      {deleteConfirm === contact.id ? t('contacts.list.confirm') : t('common.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}