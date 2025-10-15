import { settingsService } from './settingsService';

/**
 * Serviço para validação da API DigitalSac
 * 
 * IMPORTANTE: DigitalSac é uma API DIRETA - não há gerenciamento de conexão!
 * - A conexão já existe no DigitalSac (via Baileys)
 * - Não precisa "conectar", "desconectar", escanear QR Code, etc
 * - Basta ter: Host + Token + ConnectionUUID e enviar mensagens
 * 
 * Este serviço apenas:
 * - Valida se as configurações (host/token) estão preenchidas
 * - Retorna status (sempre WORKING se configurado)
 */
export class DigitalSacApiService {
  private static instance: DigitalSacApiService;

  public static getInstance(): DigitalSacApiService {
    if (!DigitalSacApiService.instance) {
      DigitalSacApiService.instance = new DigitalSacApiService();
    }
    return DigitalSacApiService.instance;
  }

  private async getConfig() {
    return await settingsService.getDigitalSacConfig();
  }

  /**
   * Valida se as configurações do DigitalSac estão corretas
   */
  async validateConfig(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      
      if (!config.host || !config.token) {
        console.warn('⚠️ Configurações DigitalSac incompletas');
        return false;
      }

      console.log('✅ Configurações DigitalSac válidas');
      return true;
    } catch (error) {
      console.error('❌ Erro ao validar configurações DigitalSac:', error);
      return false;
    }
  }

  /**
   * Valida se as configurações estão prontas para uso
   * Nota: DigitalSac não tem "teste de conexão" - é API direta
   * @param connectionUuid UUID da conexão
   */
  async testConnection(connectionUuid: string): Promise<boolean> {
    try {
      const config = await this.getConfig();

      if (!config.host || !config.token) {
        throw new Error('Configurações DigitalSac não encontradas');
      }

      // DigitalSac é API direta - se tem host e token, está "conectado"
      console.log(`✅ DigitalSac - UUID ${connectionUuid} pronto para uso`);
      return true;
    } catch (error) {
      console.error('❌ DigitalSac - Erro na validação:', error);
      return false;
    }
  }

  /**
   * Retorna o status da "sessão" DigitalSac
   * Nota: DigitalSac é API direta - sempre WORKING quando configurado
   * Não existe status de "conectando", "desconectado", etc.
   */
  async getConnectionStatus(connectionUuid: string): Promise<string> {
    try {
      const isValid = await this.validateConfig();
      
      if (!isValid) {
        return 'STOPPED'; // Apenas se NÃO configurado
      }

      // DigitalSac: se configurado, está sempre pronto para enviar
      return 'WORKING';
    } catch (error) {
      console.warn(`⚠️ Erro ao validar DigitalSac para ${connectionUuid}:`, error);
      return 'STOPPED';
    }
  }
}

export const digitalSacApiService = DigitalSacApiService.getInstance();

