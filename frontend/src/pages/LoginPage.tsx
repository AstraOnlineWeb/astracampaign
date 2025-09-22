import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { useGlobalSettings } from '../hooks/useGlobalSettings';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { settings } = useGlobalSettings();

  console.log('LoginPage settings:', settings);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.senha);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          <div className="lg:w-1/2 p-12 flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #233e4f 0%, #1a2d3b 100%)' }}>
            <div className="text-center">
              <div className="w-24 h-24 bg-white/20 rounded-2xl mx-auto mb-8 flex items-center justify-center backdrop-blur-sm">
                {settings?.iconUrl ? (
                  <img
                    src={settings.iconUrl}
                    alt="Ícone do Sistema"
                    className="w-16 h-16 object-contain"
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                ) : (
                  <img
                    src="/favicon.png"
                    alt="Astra Online"
                    className="w-16 h-16 object-contain"
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                )}
              </div>
              <h1 className="text-4xl font-bold mb-4">
                {settings?.pageTitle || 'Astra Online'}
              </h1>
              <p className="text-xl text-gray-100 mb-8">
                Sistema de Gestão de Campanhas
              </p>
              <p className="text-gray-200 max-w-md">
                Gerencie seus contatos e campanhas de WhatsApp de forma eficiente e organizada.
              </p>
            </div>
          </div>

          <div className="lg:w-1/2 p-12">
            <div className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo!</h2>
                <p className="text-gray-600">Faça login para acessar sua conta</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    E-mail
                  </label>
                  <input
                    {...register('email')}
                    type="email"
                    id="email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-colors"
                    style={{
                      '--tw-ring-color': '#233e4f'
                    } as React.CSSProperties}
                    onFocus={(e) => {
                      const target = e.target as HTMLInputElement;
                      target.style.outline = 'none';
                      target.style.borderColor = '#233e4f';
                      target.style.boxShadow = '0 0 0 2px rgba(35, 62, 79, 0.2)';
                    }}
                    onBlur={(e) => {
                      const target = e.target as HTMLInputElement;
                      target.style.borderColor = '#d1d5db';
                      target.style.boxShadow = 'none';
                    }}
                    placeholder="seu@email.com"
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-2">
                    Senha
                  </label>
                  <input
                    {...register('senha')}
                    type="password"
                    id="senha"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent transition-colors"
                    style={{
                      '--tw-ring-color': '#233e4f'
                    } as React.CSSProperties}
                    onFocus={(e) => {
                      const target = e.target as HTMLInputElement;
                      target.style.outline = 'none';
                      target.style.borderColor = '#233e4f';
                      target.style.boxShadow = '0 0 0 2px rgba(35, 62, 79, 0.2)';
                    }}
                    onBlur={(e) => {
                      const target = e.target as HTMLInputElement;
                      target.style.borderColor = '#d1d5db';
                      target.style.boxShadow = 'none';
                    }}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                  />
                  {errors.senha && (
                    <p className="mt-2 text-sm text-red-600">{errors.senha.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full text-white py-3 px-6 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #233e4f 0%, #1a2d3b 100%)',
                    '--tw-ring-color': '#233e4f'
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    const target = e.target as HTMLButtonElement;
                    target.style.background = 'linear-gradient(135deg, #1a2d3b 0%, #0f1a23 100%)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.target as HTMLButtonElement;
                    target.style.background = 'linear-gradient(135deg, #233e4f 0%, #1a2d3b 100%)';
                  }}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Entrando...
                    </div>
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}