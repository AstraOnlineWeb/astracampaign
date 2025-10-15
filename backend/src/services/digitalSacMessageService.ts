import { settingsService } from './settingsService';

function normalizeBrazilianPhone(phone: string | number): string {
  if (!phone || phone === null || phone === undefined) {
    console.log(`📱 Número brasileiro DigitalSac inválido: ${phone}`);
    return '';
  }
  const phoneStr = String(phone);
  // Remove todos os caracteres não numéricos (incluindo o +)
  let cleanPhone = phoneStr.replace(/\D/g, '');
  console.log(`📱 Número brasileiro DigitalSac (sem +): ${phone} -> ${cleanPhone}`);
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
 * @param connectionUrl URL completa da conexão DigitalSac (ex: http://host/v1/api/external/uuid)
 * @param token Token de autenticação da conexão
 * @param phone Número do telefone no formato DDI+DDD+NUMERO (sem +)
 * @param message Objeto com o conteúdo da mensagem
 * @param externalKey ID único para rastreamento (obrigatório)
 */
export async function sendMessageViaDigitalSac(
  connectionUrl: string,
  token: string,
  phone: string | number,
  message: DigitalSacMessage,
  externalKey: string
) {
  try {
    if (!token) {
      throw new Error('Token da conexão DigitalSac não fornecido.');
    }

    if (!connectionUrl) {
      throw new Error('URL da conexão DigitalSac não fornecida.');
    }

    if (!externalKey) {
      throw new Error('ExternalKey da conexão DigitalSac não fornecido.');
    }

    const normalizedPhone = normalizeBrazilianPhone(phone);

    // Para mensagens de texto, usar JSON
    if (message.text) {
      const url = connectionUrl;
      const requestBody = {
        body: message.text,
        number: normalizedPhone,
        externalKey: externalKey
      };

      console.log(`DigitalSac API - Enviando texto para: ${url}`);
      console.log(`DigitalSac API - Request body:`, JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      // URL para mídia é diferente - adiciona /send-media-caption
      const url = `${connectionUrl}/send-media-caption`;
      
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
      
      // Detectar o tipo MIME correto
      const contentType = mediaResponse.headers.get('content-type') || 
                         (message.image ? 'image/jpeg' : 
                          message.video ? 'video/mp4' : 
                          message.audio ? 'audio/ogg' : 
                          'application/octet-stream');
      
      const mediaBlob = new Blob([mediaBuffer], { type: contentType });
      
      console.log(`DigitalSac API - Tipo de mídia detectado: ${contentType}`);

      // Determinar nome do arquivo com extensão correta
      const fileName = message.fileName || 
                      (message.image ? 'image.jpg' : 
                       message.video ? 'video.mp4' : 
                       message.audio ? 'audio.ogg' : 
                       'document.pdf');

      // Caption é obrigatório na API DigitalSac
      // Se vazio, usar caractere invisível (espaço não-quebrável - ALT+255)
      const finalCaption = caption && caption.trim() ? caption : '\u00A0';
      
      if (!caption || !caption.trim()) {
        console.log(`DigitalSac API - Caption vazio, usando caractere invisível (ALT+255)`);
      } else {
        console.log(`DigitalSac API - Caption: ${caption}`);
      }

      // Criar FormData
      const formData = new FormData();
      formData.append('media', mediaBlob, fileName);
      formData.append('caption', finalCaption); // API requer 'caption' e não 'body'
      formData.append('number', normalizedPhone);
      formData.append('externalKey', externalKey);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
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

