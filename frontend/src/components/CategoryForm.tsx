import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { CategoryInput, Category } from '../types';
import { apiService } from '../services/api';

type CategoryFormData = {
  nome: string;
  cor: string;
  descricao?: string;
};

interface CategoryFormProps {
  category?: Category;
  onSuccess: () => void;
  onCancel: () => void;
}

const defaultColors = [
  '#1e3a5f', // Astra Dark Blue
  '#4a9eff', // Astra Light Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
];

export function CategoryForm({ category, onSuccess, onCancel }: CategoryFormProps) {
  const { t } = useTranslation();

  const categorySchema = z.object({
    nome: z.string().min(1, t('categories.validation.nameRequired')),
    cor: z.string().min(1, t('categories.validation.colorRequired')),
    descricao: z.string().optional(),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      nome: category?.nome || '',
      cor: category?.cor || '#1e3a5f',
      descricao: category?.descricao || '',
    },
  });

  const selectedColor = watch('cor');

  const onSubmit = async (data: CategoryFormData) => {
    try {
      const categoryInput: CategoryInput = {
        nome: data.nome,
        cor: data.cor,
        descricao: data.descricao || undefined,
      };

      if (category) {
        await apiService.updateCategory(category.id, categoryInput);
        toast.success(t('categories.messages.updateSuccess'));
      } else {
        await apiService.createCategory(categoryInput);
        toast.success(t('categories.messages.createSuccess'));
      }

      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('categories.messages.error');
      toast.error(errorMessage);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg border border-gray-100" role="dialog" aria-labelledby="form-title">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h2 id="form-title" className="text-2xl font-bold text-gray-900">
            {category ? t('categories.edit') : t('categories.new')}
          </h2>
          <p className="text-gray-500 mt-2">
            {category ? t('categories.subtitle.edit') : t('categories.subtitle.new')}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="nome" className="block text-sm font-semibold text-gray-700 mb-2">
              {t('categories.form.name')} *
            </label>
            <input
              id="nome"
              type="text"
              {...register('nome')}
              className="input-field"
              placeholder={t('categories.form.namePlaceholder')}
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
            <label htmlFor="cor" className="block text-sm font-semibold text-gray-700 mb-3">
              {t('categories.form.color')} *
            </label>
            <div className="grid grid-cols-5 gap-3 mb-4">
              {defaultColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue('cor', color)}
                  className={`w-12 h-12 rounded-xl border-3 transition-all duration-200 hover:scale-110 ${selectedColor === color ? 'border-gray-800 shadow-lg' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  style={{ backgroundColor: color }}
                  aria-label={t('categories.form.customColorHint')} // Using hint as label for color buttons for now as generic
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input
                id="cor"
                type="color"
                {...register('cor')}
                className="w-16 h-12 border border-gray-300 rounded-xl cursor-pointer"
                aria-invalid={errors.cor ? 'true' : 'false'}
                aria-describedby={errors.cor ? 'cor-error' : undefined}
              />
              <div className="flex-1">
                <div className="text-sm text-gray-600">{t('categories.form.customColor')}</div>
                <div className="text-xs text-gray-400">{t('categories.form.customColorHint')}</div>
              </div>
            </div>
            {errors.cor && (
              <p id="cor-error" className="text-red-500 text-sm mt-1">
                {errors.cor.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="descricao" className="block text-sm font-semibold text-gray-700 mb-2">
              {t('categories.form.description')}
            </label>
            <textarea
              id="descricao"
              {...register('descricao')}
              rows={4}
              className="input-field resize-none"
              placeholder={t('categories.form.descriptionPlaceholder')}
            />
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 font-medium transition-all duration-200 border border-gray-200"
              aria-label={t('categories.form.cancel')}
            >
              {t('categories.form.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1 py-3 px-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              aria-label={category ? t('categories.save') : t('categories.save')}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('categories.form.saving')}
                </>
              ) : (
                t('categories.form.save')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}