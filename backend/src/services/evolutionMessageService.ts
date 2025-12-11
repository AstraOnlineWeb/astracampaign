import { settingsService } from './settingsService';

function normalizeBrazilianPhone(phone: string | number): string {
  if (!phone || phone === null || phone === undefined) {
    console.log(`📱 Número brasileiro Evolution inválido: ${phone}`);
    return '';
  }
  const phoneStr = String(phone);
  let cleanPhone = phoneStr.replace(/\D/g, '');
  console.log(`📱 Número brasileiro Evolution: ${phone} -> ${cleanPhone}`);
  return cleanPhone;
}

interface EvolutionMessage {
  text?: string;
  image?: { url: string };
  video?: { url: string };
  audio?: { url: string };
  document?: { url: string };
  fileName?: string;
  caption?: string;
}

export async function sendMessageViaEvolution(instanceName: string, phone: string | number, message: EvolutionMessage) {
  try {
    const config = await settingsService.getEvolutionConfig();

    if (!config.host || !config.apiKey) {
      throw new Error('Configurações Evolution API não encontradas. Configure nas configurações do sistema.');
    }
    console.log('sendMessageViaEvolution message', message);
    const normalizedPhone = normalizeBrazilianPhone(phone);
    let endpoint = '';
    let requestBody: any = {
      number: normalizedPhone
    };

    if (message.text) {
      endpoint = `/message/sendText/${instanceName}`;
      requestBody.text = message.text;
    } else if (message.image) {
      endpoint = `/message/sendMedia/${instanceName}`;
      requestBody = {
        number: normalizedPhone,
        mediatype: 'image',
        mimetype: 'image/png',
        caption: message.caption || '',
        media: message.image.url,
        fileName: 'imagem.png'
      };
    } else if (message.video) {
      endpoint = `/message/sendMedia/${instanceName}`;
      requestBody = {
        number: normalizedPhone,
        mediatype: 'video',
        mimetype: 'video/mp4',
        caption: message.caption || '',
        media: message.video.url,
        fileName: 'video.mp4'
      };
    } else if (message.audio) {
      endpoint = `/message/sendMedia/${instanceName}`;
      requestBody = {
        number: normalizedPhone,
        mediatype: 'audio',
        mimetype: 'audio/ogg',
        media: message.audio.url,
        fileName: 'audio.ogg'
      };
    } else if (message.document) {
      endpoint = `/message/sendMedia/${instanceName}`;
      requestBody = {
        number: normalizedPhone,
        mediatype: 'document',
        mimetype: 'application/pdf',
        caption: message.caption || '',
        media: message.document.url,
        fileName: message.fileName || 'documento.pdf'
      };
    } else {
      throw new Error('Tipo de mensagem não suportado');
    }

    const url = `${config.host}${endpoint}`;
    console.log(`Evolution API - Enviando para: ${url}`);
    console.log(`Evolution API - Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`Evolution API - Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const responseText = await response.text();
      console.log(`Evolution API - Error response:`, responseText);
      throw new Error(`Evolution API error: ${response.status} ${response.statusText} - ${responseText}`);
    }

    const result = await response.json();
    console.log(`Evolution API - Success response:`, result);
    return result;
  } catch (error) {
    console.error('Error sending message via Evolution:', error);
    throw error;
  }
}

export async function checkContactExistsEvolution(instanceName: string, phone: string | number): Promise<{exists: boolean, validPhone?: string}> {
  try {
    const config = await settingsService.getEvolutionConfig();

    if (!config.host || !config.apiKey) {
      throw new Error('Configurações Evolution API não encontradas.');
    }

    const normalizedPhone = normalizeBrazilianPhone(phone);

    console.log(`🔍 Evolution - Verificando se contato existe: ${phone} -> ${normalizedPhone}`);

    const url = `${config.host}/chat/whatsappNumbers/${instanceName}`;
    const requestBody = {
      numbers: [normalizedPhone]
    };

    console.log(`Evolution API - Checking contact: ${url}`);
    console.log(`Evolution API - Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.log(`❌ Evolution - Erro ao verificar contato ${normalizedPhone}: ${response.status} ${response.statusText}`);
      return { exists: false };
    }

    const result = await response.json();
    console.log(`Evolution API - Check contact response:`, result);

    // A Evolution API retorna um array com os números válidos
    const validNumbers = Array.isArray(result) ? result : [];
    const exists = validNumbers.length > 0;
    const validPhoneData = exists ? validNumbers[0] : undefined;

    console.log(`${exists ? '✅' : '❌'} Evolution - Contato ${normalizedPhone} existe: ${exists}`);

    if (exists && validPhoneData) {
      // Extrair o número do objeto retornado pela Evolution API
      const validPhone = validPhoneData.number || normalizedPhone;
      console.log(`📱 Evolution - Usando número válido: ${validPhone}`);
      return { exists: true, validPhone };
    }

    return { exists: false };
  } catch (error) {
    console.error(`❌ Evolution - Erro ao verificar existência do contato ${phone}:`, error);
    return { exists: false };
  }
}
