import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { User, UserInput } from '../types';

export function UserForm({ user, onSubmit, onCancel }: UserFormProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Schema definition inside component to use t()
  const createUserSchema = z.object({
    nome: z.string().min(2, t('users.validation.nameMin')),
    email: z.string().email(t('users.validation.emailInvalid')),
    senha: z.string()
      .min(6, t('users.validation.passwordMin'))
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, t('users.validation.passwordRegex')),
    role: z.enum(['ADMIN', 'USER']),
    ativo: z.boolean(),
  });

  const updateUserSchema = z.object({
    nome: z.string().min(2, t('users.validation.nameMin')),
    email: z.string().email(t('users.validation.emailInvalid')),
    senha: z.string()
      .min(6, t('users.validation.passwordMin'))
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, t('users.validation.passwordRegex'))
      .optional(),
    role: z.enum(['ADMIN', 'USER']),
    ativo: z.boolean(),
  });

  type UserFormData = z.infer<typeof createUserSchema> | z.infer<typeof updateUserSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(user ? updateUserSchema : createUserSchema),
    defaultValues: user ? {
      nome: user.nome,
      email: user.email,
      role: user.role as 'ADMIN' | 'USER',
      ativo: user.ativo,
    } : {
      nome: '',
      email: '',
      senha: '',
      role: 'USER',
      ativo: true,
    },
  });

  const handleFormSubmit = async (data: UserFormData) => {
    setIsSubmitting(true);
    try {
      const submitData: UserInput = {
        nome: data.nome,
        email: data.email,
        role: data.role,
        ativo: data.ativo,
      };

      if (data.senha) {
        submitData.senha = data.senha;
      }

      await onSubmit(submitData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {user ? t('users.form.title.edit') : t('users.form.title.new')}
          </h3>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.form.name')}
              </label>
              <input
                {...register('nome')}
                type="text"
                id="nome"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
              {errors.nome && (
                <p className="mt-1 text-sm text-red-600">{errors.nome.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.form.email')}
              </label>
              <input
                {...register('email')}
                type="email"
                id="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">
                {user ? t('users.form.newPassword') : t('users.form.password')}
              </label>
              <input
                {...register('senha')}
                type="password"
                id="senha"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
                placeholder={user ? '' : t('users.form.passwordPlaceholder')}
              />
              {!user && (
                <p className="mt-1 text-xs text-gray-500">
                  {t('users.form.passwordHint')}
                </p>
              )}
              {errors.senha && (
                <p className="mt-1 text-sm text-red-600">{errors.senha.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                {t('users.form.role')}
              </label>
              <select
                {...register('role')}
                id="role"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              >
                <option value="USER">{t('users.form.roles.user')}</option>
                <option value="ADMIN">{t('users.form.roles.admin')}</option>
              </select>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
              )}
            </div>

            <div className="flex items-center">
              <input
                {...register('ativo')}
                type="checkbox"
                id="ativo"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={isSubmitting}
              />
              <label htmlFor="ativo" className="ml-2 block text-sm text-gray-900">
                {t('users.form.active')}
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={isSubmitting}
              >
                {t('users.form.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('users.form.saving') : (user ? t('users.form.update') : t('users.form.create'))}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface UserFormProps {
  user?: User;
  onSubmit: (data: UserInput) => Promise<void>;
  onCancel: () => void;
}