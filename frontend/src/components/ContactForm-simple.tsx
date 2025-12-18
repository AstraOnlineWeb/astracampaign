import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { ContactInput, Contact } from '../types';
import { apiService } from '../services/api';
import { validatePhone } from '../utils/phoneUtils';

const createContactSchema = (t: any) => z.object({
  nome: z.string().min(1, t('contacts.validation.nameRequired')),
  telefone: z.string().min(1, t('contacts.validation.phoneRequired')).refine(validatePhone, {
    message: t('contacts.validation.phoneInvalid'),
  }),
  email: z.string().email(t('contacts.validation.emailInvalid')).optional().or(z.literal('')),
  observacoes: z.string().optional(),
});

type ContactFormData = z.infer<ReturnType<typeof createContactSchema>>;

interface ContactFormProps {
  contact?: Contact;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContactForm({ contact, onSuccess, onCancel }: ContactFormProps) {
  const { t } = useTranslation();

  const contactSchema = createContactSchema(t);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nome: contact?.nome || '',
      telefone: contact?.telefone || '',
      email: contact?.email || '',
      observacoes: contact?.observacoes || '',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      const contactInput: ContactInput = {
        nome: data.nome,
        telefone: data.telefone,
        email: data.email || undefined,
        observacoes: data.observacoes || undefined,
      };

      if (contact) {
        await apiService.updateContact(contact.id, contactInput);
        toast.success(t('contacts.messages.updateSuccess'));
      } else {
        await apiService.createContact(contactInput);
        toast.success(t('contacts.messages.createSuccess'));
      }

      reset();
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('contacts.messages.genericError');
      toast.error(errorMessage);
    }
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md" role="dialog" aria-labelledby="form-title">
        <h2 id="form-title" className="text-xl font-semibold mb-4">
          {contact ? t('contacts.form.title.edit') : t('contacts.form.title.new')}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
              {t('contacts.form.name')} *
            </label>
            <input
              id="nome"
              type="text"
              {...register('nome')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-invalid={errors.nome ? 'true' : 'false'}
              aria-describedby={errors.nome ? 'nome-error' : undefined}
            />
            {errors.nome && (
              <p id="nome-error" className="text-red-500 text-sm mt-1">
                {errors.nome.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="telefone" className="block text-sm font-medium text-gray-700 mb-1">
              {t('contacts.form.phone')} *
            </label>
            <input
              id="telefone"
              type="tel"
              {...register('telefone')}
              placeholder={t('contacts.form.phonePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-invalid={errors.telefone ? 'true' : 'false'}
              aria-describedby={errors.telefone ? 'telefone-error' : undefined}
            />
            {errors.telefone && (
              <p id="telefone-error" className="text-red-500 text-sm mt-1">
                {errors.telefone.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('contacts.form.email')}
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className="text-red-500 text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>


          <div>
            <label htmlFor="observacoes" className="block text-sm font-medium text-gray-700 mb-1">
              {t('contacts.form.notes')}
            </label>
            <textarea
              id="observacoes"
              {...register('observacoes')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={contact ? t('contacts.form.title.edit') : t('contacts.form.title.new')}
            >
              {isSubmitting ? t('contacts.form.saving') : t('contacts.form.save')}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              aria-label={t('common.cancel')}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}