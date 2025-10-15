import { settingsService } from './settingsService';

function normalizeBrazilianPhone(phone: string | number): string {
  if (!phone || phone === null || phone === undefined) {
    console.log(`📱 Número brasileiro DigitalSac inválido: ${phone}`);
    return '';
  }
  const phoneStr = String(phone);
  let cleanPhone = phoneStr.replace(/\D/g, '');
  console.log(`📱 Número brasileiro DigitalSac: ${phone} -> ${cleanPhone}`);
  return cleanPhone;
}

interface DigitalSacMessage {
  text?: string;
  image?: { url: string };
  video?: { url: string };
  audio?: { url: string };
  document?: { url: string };
  fileName?: string;
  caption?: string;
}

/**
 * Envia mensagem via DigitalSac API
 * @param connectionUuid UUID da conexão DigitalSac (configurado por sessão)
 * @param phone Número do telefone no formato DDI+DDD+NUMERO
 * @param message Objeto com o conteúdo da mensagem
 * @param externalKey ID único para rastreamento (opcional)
 */
export async function sendMessageViaDigitalSac(
  connectionUuid: string,
  phone: string | number,
  message: DigitalSacMessage,
  externalKey?: string
) {
  try {
    const config = await settingsService.getDigitalSacConfig();

    if (!config.host || !config.token) {
      throw new Error('Configurações DigitalSac não encontradas. Configure nas configurações do sistema.');
    }

    if (!connectionUuid) {
      throw new Error('UUID da conexão DigitalSac não fornecido.');
    }

    const normalizedPhone = normalizeBrazilianPhone(phone);
    const endpoint = `/v1/api/external/${connectionUuid}`;
    const url = `${config.host}${endpoint}`;

    // Para mensagens de texto, usar JSON
    if (message.text) {
      const requestBody = {
        body: message.text,
        number: normalizedPhone,
        externalKey: externalKey || `msg_${Date.now()}`
      };

      console.log(`DigitalSac API - Enviando texto para: ${url}`);
      console.log(`DigitalSac API - Request body:`, JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`DigitalSac API - Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const responseText = await response.text();
        console.log(`DigitalSac API - Error response:`, responseText);
        throw new Error(`DigitalSac API error: ${response.status} ${response.statusText} - ${responseText}`);
      }

      const result = await response.json();
      console.log(`DigitalSac API - Success response:`, result);
      return result;
    }

    // Para mensagens com mídia, usar FormData
    if (message.image || message.video || message.audio || message.document) {
      let mediaUrl = '';
      let caption = message.caption || '';

      if (message.image) {
        mediaUrl = message.image.url;
      } else if (message.video) {
        mediaUrl = message.video.url;
      } else if (message.audio) {
        mediaUrl = message.audio.url;
      } else if (message.document) {
        mediaUrl = message.document.url;
        caption = message.caption || message.fileName || '';
      }

      console.log(`DigitalSac API - Enviando mídia para: ${url}`);
      console.log(`DigitalSac API - Media URL: ${mediaUrl}`);

      // Baixar o arquivo da URL
      const mediaResponse = await fetch(mediaUrl);
      if (!mediaResponse.ok) {
        throw new Error(`Erro ao baixar mídia: ${mediaResponse.statusText}`);
      }

      const mediaBuffer = await mediaResponse.arrayBuffer();
      const mediaBlob = new Blob([mediaBuffer]);

      // Determinar nome do arquivo
      const fileName = message.fileName || 
                      (message.image ? 'image.jpg' : 
                       message.video ? 'video.mp4' : 
                       message.audio ? 'audio.ogg' : 
                       'document.pdf');

      // Criar FormData
      const formData = new FormData();
      formData.append('media', mediaBlob, fileName);
      formData.append('body', caption);
      formData.append('number', normalizedPhone);
      formData.append('externalKey', externalKey || `media_${Date.now()}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`
          // Não incluir Content-Type, o fetch adiciona automaticamente com boundary
        },
        body: formData
      });

      console.log(`DigitalSac API - Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const responseText = await response.text();
        console.log(`DigitalSac API - Error response:`, responseText);
        throw new Error(`DigitalSac API error: ${response.status} ${response.statusText} - ${responseText}`);
      }

      const result = await response.json();
      console.log(`DigitalSac API - Success response:`, result);
      return result;
    }

    throw new Error('Tipo de mensagem não suportado');
  } catch (error) {
    console.error('Error sending message via DigitalSac:', error);
    throw error;
  }
}

/**
 * Verifica se um contato existe no WhatsApp via DigitalSac
 * Nota: DigitalSac pode não ter endpoint específico para isso,
 * então retornamos sempre true (validação acontece no envio)
 */
export async function checkContactExistsDigitalSac(
  connectionUuid: string,
  phone: string | number
): Promise<{ exists: boolean; validPhone?: string }> {
  try {
    const normalizedPhone = normalizeBrazilianPhone(phone);
    
    console.log(`🔍 DigitalSac - Considerando contato válido: ${normalizedPhone}`);
    console.log(`⚠️  DigitalSac não possui validação prévia, número será validado no envio`);

    // DigitalSac valida o número no momento do envio
    // Retornamos true para permitir que a tentativa de envio aconteça
    return { 
      exists: true, 
      validPhone: normalizedPhone 
    };
  } catch (error) {
    console.error(`❌ DigitalSac - Erro ao verificar existência do contato ${phone}:`, error);
    return { exists: true }; // Permitir tentativa mesmo com erro
  }
}

