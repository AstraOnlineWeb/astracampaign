import { PrismaClient } from '@prisma/client';
import { sendMessage, checkContactExists } from './wahaApiService';
import { sendMessageViaEvolution, checkContactExistsEvolution } from './evolutionMessageService';
import { sendMessageViaDigitalSac, checkContactExistsDigitalSac } from './digitalSacMessageService';
import { ContactService } from './contactService';
import { openaiService } from './openaiService';
import { groqService } from './groqService';
import { websocketService } from './websocketService';
import { automationService, TriggerType } from './automationService';

const prisma = new PrismaClient();

class CampaignSchedulerService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private campaignSessionIndexes: Map<string, number> = new Map(); // Rastrear índice atual de cada campanha

  start() {
    if (this.isRunning) {
      console.log('Campaign scheduler already running');
      return;
    }

    console.log('Starting campaign scheduler...');
    this.isRunning = true;

    // Verificar campanhas a cada 30 segundos
    this.intervalId = setInterval(async () => {
      await this.processCampaigns();
    }, 30000);

    // Executar imediatamente também
    this.processCampaigns();
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping campaign scheduler...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async processCampaigns() {
    try {
      // Buscar campanhas que devem ser iniciadas
      const campaignsToStart = await prisma.campaign.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { startImmediately: true },
            {
              AND: [
                { startImmediately: false },
                { scheduledFor: { lte: new Date() } }
              ]
            }
          ]
        },
        include: {
          session: true
        }
      });

      for (const campaign of campaignsToStart) {
        await this.startCampaign(campaign);
      }

      // Processar campanhas em execução
      const runningCampaigns = await prisma.campaign.findMany({
        where: { status: 'RUNNING' },
        include: {
          session: true,
          messages: {
            where: { status: 'PENDING' }, // Only PENDING, not PROCESSING to avoid duplicates
            orderBy: { criadoEm: 'asc' },
            take: 1 // Processar uma mensagem por vez
          }
        }
      });

      for (const campaign of runningCampaigns) {
        if (campaign.messages.length > 0) {
          await this.processNextMessage(campaign, campaign.messages[0]);
        } else {
          // Verificar se todas as mensagens foram processadas (excluindo PROCESSING e PENDING)
          const activeCount = await prisma.campaignMessage.count({
            where: {
              campaignId: campaign.id,
              status: { in: ['PENDING', 'PROCESSING'] }
            }
          });

          if (activeCount === 0) {
            await this.completeCampaign(campaign.id);
          }
        }
      }
    } catch (error) {
      console.error('Error processing campaigns:', error);
    }
  }

  // Função para obter próxima sessão de forma sequencial (round-robin) com informações do provedor
  private async getNextSequentialSession(campaignId: string, sessionNames: string[]): Promise<{name: string, provider: string} | null> {
    try {
      // Buscar sessões ativas
      const activeSessions = await prisma.whatsAppSession.findMany({
        where: {
          name: { in: sessionNames },
          status: 'WORKING'
        },
        select: {
          name: true,
          status: true,
          provider: true
        },
        orderBy: {
          name: 'asc' // Ordenar para manter consistência
        }
      });

      if (activeSessions.length === 0) {
        console.log(`❌ Nenhuma sessão ativa encontrada das selecionadas: ${sessionNames.join(', ')}`);
        return null;
      }

      // Obter índice atual da campanha (ou inicializar em 0)
      const currentIndex = this.campaignSessionIndexes.get(campaignId) || 0;

      // Selecionar sessão baseada no índice atual
      const selectedSession = activeSessions[currentIndex % activeSessions.length];

      // Incrementar índice para próxima mensagem
      this.campaignSessionIndexes.set(campaignId, currentIndex + 1);

      console.log(`🔄 Sessão sequencial: ${selectedSession.name} (${selectedSession.provider}) (índice ${currentIndex + 1}/${activeSessions.length} - sessões ativas: ${activeSessions.map(s => `${s.name}(${s.provider})`).join(', ')})`);

      return {
        name: selectedSession.name,
        provider: selectedSession.provider || 'WAHA'
      };
    } catch (error) {
      console.error('Erro ao buscar sessões ativas:', error);
      return null;
    }
  }

  private async startCampaign(campaign: any) {
    try {
      console.log(`Starting campaign: ${campaign.nome}`);

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'RUNNING',
          startedAt: new Date()
        }
      });

      // Notificar via WebSocket o início da campanha
      if (campaign.tenantId && websocketService.isInitialized) {
        await websocketService.notifyTenant(campaign.tenantId, {
          title: 'Campanha Iniciada',
          message: `A campanha "${campaign.nome}" foi iniciada com sucesso.`,
          type: 'CAMPAIGN',
          data: { campaignId: campaign.id, campaignName: campaign.nome, status: 'RUNNING' }
        });
      }
    } catch (error) {
      console.error(`Error starting campaign ${campaign.id}:`, error);
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'FAILED' }
      });

      // Notificar falha via WebSocket
      if (campaign.tenantId && websocketService.isInitialized) {
        await websocketService.notifyTenant(campaign.tenantId, {
          title: 'Erro na Campanha',
          message: `Erro ao iniciar a campanha "${campaign.nome}".`,
          type: 'ERROR',
          data: { campaignId: campaign.id, campaignName: campaign.nome, status: 'FAILED' }
        });
      }
    }
  }

  private async processNextMessage(campaign: any, message: any) {
    let selectedSessionInfo: {name: string, provider: string} | null = null;
    let selectedVariationInfo: string | null = null;

    try {
      // IMMEDIATELY mark message as PROCESSING to prevent duplicate processing
      console.log(`🔄 Marking message ${message.id} as PROCESSING to prevent duplication`);
      await prisma.campaignMessage.update({
        where: { id: message.id },
        data: { status: 'PROCESSING' }
      });

      // Obter sessões disponíveis para esta campanha
      const sessionNames = campaign.sessionNames ? JSON.parse(campaign.sessionNames) : [campaign.sessionName];

      // Escolher próxima sessão de forma sequencial (round-robin)
      selectedSessionInfo = await this.getNextSequentialSession(campaign.id, sessionNames);

      if (!selectedSessionInfo) {
        console.log(`❌ Nenhuma sessão ativa disponível para a campanha ${campaign.id}. Pausando campanha.`);
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'PAUSED' }
        });
        // Revert message status back to PENDING since we couldn't process it
        await prisma.campaignMessage.update({
          where: { id: message.id },
          data: { status: 'PENDING' }
        });
        return;
      }

      const { name: selectedSession, provider } = selectedSessionInfo;
      console.log(`🚀 Distribuição sequencial - Usando sessão: ${selectedSession} (${provider}) para mensagem ${message.id}`);

      // Aplicar delay randomizado
      if (campaign.randomDelay > 0) {
        const randomDelay = Math.floor(Math.random() * campaign.randomDelay * 1000);
        console.log(`Applying random delay of ${randomDelay}ms for message ${message.id}`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
      }

      console.log(`🔍 DEBUGGING - Message ${message.id} for contact ${message.contactId}`);

      // Preparar conteúdo da mensagem e selecionar variações ANTES dos outros processamentos
      const messageContent = JSON.parse(campaign.messageContent);
      console.log(`🔍 MESSAGE CONTENT:`, messageContent);

      // Primeiro selecionar variação aleatória se houver
      const variationResult = this.selectRandomVariation(messageContent);
      const contentWithSelectedVariation = variationResult.processedContent;
      selectedVariationInfo = variationResult.variationInfo;

      // VERIFICAR SE ESTE CONTACTID JÁ FOI PROCESSADO NESTA CAMPANHA
      const alreadyProcessed = await prisma.campaignMessage.findFirst({
        where: {
          campaignId: campaign.id,
          contactId: message.contactId,
          status: 'SENT'
        }
      });

      if (alreadyProcessed) {
        console.log(`🚫 CONTATO JÁ PROCESSADO: ContactId ${message.contactId} já foi enviado na campanha ${campaign.id} (mensagem ${alreadyProcessed.id}). Pulando mensagem ${message.id}.`);

        // Marcar esta mensagem como pulada
        await prisma.campaignMessage.update({
          where: { id: message.id },
          data: {
            status: 'FAILED',
            errorMessage: `Contato já processado nesta campanha (mensagem ${alreadyProcessed.id})`,
            sessionName: selectedSession,
            selectedVariation: selectedVariationInfo
          }
        });

        return; // Pular este envio
      }

      // Buscar dados do contato para variáveis dinâmicas usando ContactService
      const contactsResponse = await ContactService.getContacts();
      const contact = contactsResponse.contacts.find((c: any) => c.id === message.contactId);

      console.log(`🔍 CONTACT FOUND:`, contact);

      // Depois aplicar variáveis dinâmicas se houver contato
      const processedContent = contact ? this.processVariables(contentWithSelectedVariation, contact) : contentWithSelectedVariation;

      console.log(`🔍 PROCESSED CONTENT:`, processedContent);

      // Verificar se o número existe no WhatsApp antes de enviar usando provedor correto
      let contactCheck: any = { exists: false };

      if (provider === 'EVOLUTION') {
        contactCheck = await checkContactExistsEvolution(selectedSession, message.contactPhone);
      } else if (provider === 'DIGITALSAC') {
        // DigitalSac precisa do connectionUuid da sessão
        const sessionData = await prisma.whatsAppSession.findUnique({
          where: { name: selectedSession }
        });
        contactCheck = await checkContactExistsDigitalSac(sessionData?.connectionUuid || '', message.contactPhone);
      } else {
        contactCheck = await checkContactExists(selectedSession, message.contactPhone);
      }

      if (!contactCheck.exists) {
        console.log(`❌ Contact ${message.contactPhone} does not exist on WhatsApp (${provider}). Skipping message.`);

        // Marcar como falha por número inexistente
        await prisma.campaignMessage.update({
          where: { id: message.id },
          data: {
            status: 'FAILED',
            errorMessage: `Número não existe no WhatsApp (${provider})`,
            selectedVariation: selectedVariationInfo
          }
        });

        // Atualizar contador de falhas
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            failedCount: { increment: 1 }
          }
        });

        return;
      }

      if (provider === 'EVOLUTION') {
        console.log(`✅ Contact ${message.contactPhone} exists on Evolution. Using validated phone: ${contactCheck.validPhone}`);
      } else if (provider === 'DIGITALSAC') {
        console.log(`✅ Contact ${message.contactPhone} exists on DigitalSac. Using validated phone: ${contactCheck.validPhone}`);
      } else {
        console.log(`✅ Contact ${message.contactPhone} exists on WAHA. Using chatId: ${contactCheck.chatId}`);
      }

      // Enviar mensagem usando o provedor correto
      let result: any;
      if (provider === 'EVOLUTION') {
        result = await this.sendMessageViaEvolution(
          selectedSession,
          contactCheck.validPhone || message.contactPhone,
          campaign.messageType,
          processedContent,
          contact,
          campaign.tenantId
        );
      } else if (provider === 'DIGITALSAC') {
        // DigitalSac precisa do connectionUuid
        const sessionData = await prisma.whatsAppSession.findUnique({
          where: { name: selectedSession }
        });
        result = await this.sendMessageViaDigitalSac(
          sessionData?.connectionUuid || '',
          contactCheck.validPhone || message.contactPhone,
          campaign.messageType,
          processedContent,
          contact,
          campaign.tenantId
        );
      } else {
        result = await this.sendMessageViaWaha(
          selectedSession,
          message.contactPhone,
          campaign.messageType,
          processedContent,
          contactCheck.chatId,
          contact,
          campaign.tenantId
        );
      }

      if (result.success) {
        // Atualizar status da mensagem
        await prisma.campaignMessage.update({
          where: { id: message.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            messageId: result.messageId,
            sessionName: selectedSession, // Registrar qual sessão foi usada
            selectedVariation: selectedVariationInfo // Registrar qual variação foi selecionada
          }
        });

        // Atualizar contador da campanha
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            sentCount: { increment: 1 }
          }
        });

        console.log(`Message sent successfully to ${message.contactPhone}`);
      } else {
        // Marcar como falha
        await prisma.campaignMessage.update({
          where: { id: message.id },
          data: {
            status: 'FAILED',
            errorMessage: result.error,
            sessionName: selectedSession, // Registrar qual sessão foi tentada
            selectedVariation: selectedVariationInfo // Registrar qual variação foi selecionada
          }
        });

        // Atualizar contador de falhas
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            failedCount: { increment: 1 }
          }
        });

        console.error(`Failed to send message to ${message.contactPhone}: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error processing message ${message.id}:`, error);

      // Check if message was marked as PROCESSING - if so, mark as FAILED
      // If it's still PENDING somehow, mark as FAILED
      await prisma.campaignMessage.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          sessionName: selectedSessionInfo?.name || 'N/A', // Registrar a sessão se disponível
          selectedVariation: selectedVariationInfo || null // Registrar variação se disponível
        }
      });

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          failedCount: { increment: 1 }
        }
      });
    }
  }

  private processVariables(content: any, contact: any): any {
    console.log(`🔧 PROCESSING VARIABLES for contact:`, contact);

    const replaceVariables = (text: string): string => {
      if (typeof text !== 'string') return text;

      console.log(`🔧 Original text:`, text);

      let result = text;
      // Usar replace simples ao invés de regex
      result = result.replace(/\{\{nome\}\}/g, contact.nome || '');
      result = result.replace(/\{\{telefone\}\}/g, contact.telefone || '');
      result = result.replace(/\{\{email\}\}/g, contact.email || '');
      result = result.replace(/\{\{observacoes\}\}/g, contact.observacoes || '');
      result = result.replace(/\{\{categoria\}\}/g, ''); // Por enquanto vazio

      console.log(`🔧 Processed text:`, result);

      return result;
    };

    const processObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return replaceVariables(obj);
      } else if (Array.isArray(obj)) {
        return obj.map(item => processObject(item));
      } else if (obj && typeof obj === 'object') {
        const processed: any = {};
        for (const [key, value] of Object.entries(obj)) {
          processed[key] = processObject(value);
        }
        return processed;
      }
      return obj;
    };

    return processObject(content);
  }

  private selectRandomVariation(content: any): { processedContent: any; variationInfo: string | null } {
    console.log(`🎲 CHECKING FOR VARIATIONS:`, content);

    // Se for um objeto com useVariations ou useMediaVariations = true, selecionar uma variação aleatória
    if (content && typeof content === 'object' && (content.useVariations || content.useMediaVariations)) {
      if (content.variations && Array.isArray(content.variations) && content.variations.length > 0) {
        const randomIndex = Math.floor(Math.random() * content.variations.length);
        const selectedVariation = content.variations[randomIndex];
        const variationInfo = `Texto: Variação ${randomIndex + 1}/${content.variations.length}`;
        console.log(`🎲 TEXT VARIATION: Selecionada variação ${randomIndex + 1}/${content.variations.length}: "${selectedVariation}"`);

        return {
          processedContent: {
            ...content,
            text: selectedVariation,
            useVariations: false, // Remove flag para evitar reprocessamento
            variations: undefined // Remove variações para limpeza
          },
          variationInfo
        };
      }

      if (content.mediaVariations && Array.isArray(content.mediaVariations) && content.mediaVariations.length > 0) {
        console.log(`🎲 FOUND MEDIA VARIATIONS: ${content.mediaVariations.length} variations`);
        content.mediaVariations.forEach((variation: any, index: number) => {
          console.log(`   Variation ${index + 1}: URL="${variation.url}", Caption="${variation.caption}"`);
        });

        // Filtrar apenas variações que têm URL válida
        const validVariations = content.mediaVariations.filter((variation: any) => variation.url && variation.url.trim() !== '');
        console.log(`🎲 VALID VARIATIONS: ${validVariations.length} valid variations after filtering`);

        if (validVariations.length > 0) {
          const randomIndex = Math.floor(Math.random() * validVariations.length);
          const selectedVariation = validVariations[randomIndex];
          const originalIndex = content.mediaVariations.indexOf(selectedVariation);
          const variationInfo = `Mídia: Variação ${originalIndex + 1}/${content.mediaVariations.length}`;
          console.log(`🎲 MEDIA VARIATION: Selecionada variação ${originalIndex + 1}/${content.mediaVariations.length}:`, selectedVariation);

          return {
            processedContent: {
              ...content,
              ...selectedVariation, // Aplica url, caption, fileName da variação selecionada
              useMediaVariations: false, // Remove flag para evitar reprocessamento
              mediaVariations: undefined // Remove variações para limpeza
            },
            variationInfo
          };
        } else {
          console.log(`⚠️ NO VALID VARIATIONS FOUND: All ${content.mediaVariations.length} variations have empty URLs`);
          // Quando não há variações válidas, retornar erro em vez de continuar com URL vazia
          return {
            processedContent: {
              ...content,
              url: null, // Force null para detectar o problema
              errorMessage: 'Todas as variações têm URLs vazias'
            },
            variationInfo: 'Erro: URLs vazias nas variações'
          };
        }
      }
    }

    // Se for um objeto sequence, processar cada item da sequência
    if (content && content.sequence && Array.isArray(content.sequence)) {
      const sequenceResults = content.sequence.map((item: any) => this.selectRandomVariation(item.content));
      const variationInfos = sequenceResults.map((result: any) => result.variationInfo).filter((info: any) => info !== null);

      return {
        processedContent: {
          ...content,
          sequence: content.sequence.map((item: any, index: number) => ({
            ...item,
            content: sequenceResults[index].processedContent
          }))
        },
        variationInfo: variationInfos.length > 0 ? variationInfos.join('; ') : null
      };
    }

    // Se for um array, processar cada elemento
    if (Array.isArray(content)) {
      const arrayResults = content.map((item: any) => this.selectRandomVariation(item));
      const variationInfos = arrayResults.map((result: any) => result.variationInfo).filter((info: any) => info !== null);

      return {
        processedContent: arrayResults.map((result: any) => result.processedContent),
        variationInfo: variationInfos.length > 0 ? variationInfos.join('; ') : null
      };
    }

    // Se for objeto, processar recursivamente
    if (content && typeof content === 'object') {
      const processed: any = {};
      const variationInfos: string[] = [];

      for (const [key, value] of Object.entries(content)) {
        const result = this.selectRandomVariation(value);
        processed[key] = result.processedContent;
        if (result.variationInfo) {
          variationInfos.push(result.variationInfo);
        }
      }

      return {
        processedContent: processed,
        variationInfo: variationInfos.length > 0 ? variationInfos.join('; ') : null
      };
    }

    return {
      processedContent: content,
      variationInfo: null
    };
  }

  private async sendMessageViaEvolution(instanceName: string, phone: string, messageType: string, content: any, contactData?: any, tenantId?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      let result;

      switch (messageType) {
        case 'text':
          result = await sendMessageViaEvolution(instanceName, phone, { text: content.text });
          break;

        case 'image':
          result = await sendMessageViaEvolution(instanceName, phone, {
            image: { url: content.url },
            caption: content.caption || '',
            fileName: 'imagem.png'
          });
          break;

        case 'video':
          result = await sendMessageViaEvolution(instanceName, phone, {
            video: { url: content.url },
            caption: content.caption || '',
            fileName: 'video.mp4'
          });
          break;

        case 'audio':
          result = await sendMessageViaEvolution(instanceName, phone, {
            audio: { url: content.url },
            fileName: 'audio.ogg'
          });
          break;

        case 'document':
          result = await sendMessageViaEvolution(instanceName, phone, {
            document: { url: content.url },
            fileName: content.fileName || 'documento.pdf',
            caption: content.caption || ''
          });
          break;

        case 'openai':
          // Gerar mensagem usando OpenAI
          console.log('🤖 Gerando mensagem com OpenAI (Evolution)...', content);

          const openaiResult = await openaiService.generateMessage(content, contactData, tenantId);

          if (!openaiResult.success) {
            throw new Error(`OpenAI error: ${openaiResult.error}`);
          }

          console.log('✅ Mensagem gerada pela OpenAI (Evolution):', openaiResult.message);

          // Enviar a mensagem gerada como texto
          result = await sendMessageViaEvolution(instanceName, phone, { text: openaiResult.message });
          break;

        case 'groq':
          // Gerar mensagem usando Groq
          console.log('⚡ Gerando mensagem com Groq (Evolution)...', content);

          const groqResult = await groqService.generateMessage(content, contactData, tenantId);

          if (!groqResult.success) {
            throw new Error(`Groq error: ${groqResult.error}`);
          }

          console.log('✅ Mensagem gerada pela Groq (Evolution):', groqResult.message);

          // Enviar a mensagem gerada como texto
          result = await sendMessageViaEvolution(instanceName, phone, { text: groqResult.message });
          break;

        case 'sequence':
          // Para sequência, enviar todos os itens com delay entre eles
          if (!content.sequence || content.sequence.length === 0) {
            throw new Error('Sequence is empty');
          }

          let lastResult;
          for (let i = 0; i < content.sequence.length; i++) {
            const item = content.sequence[i];

            // Tratar tipo 'wait' como delay personalizado
            if (item.type === 'wait') {
              const waitTime = item.content?.waitTime || 30; // Default 30 segundos se não especificado
              console.log(`⏰ Aplicando espera personalizada de ${waitTime} segundos...`);
              await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

              // Para o wait, consideramos como "sucesso" para continuar a sequência
              lastResult = { success: true, messageId: 'wait-delay' };
              console.log(`✅ Espera de ${waitTime} segundos concluída`);
              continue; // Pular para próximo item da sequência
            }

            lastResult = await this.sendMessageViaEvolution(instanceName, phone, item.type, item.content, contactData, tenantId);

            if (!lastResult.success) {
              throw new Error(`Failed to send sequence item ${i + 1}: ${lastResult.error}`);
            }

            // Adicionar delay de 2-5 segundos entre mensagens da sequência para evitar spam (apenas entre mensagens reais)
            if (i < content.sequence.length - 1 && content.sequence[i + 1].type !== 'wait') {
              const sequenceDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 segundos
              await new Promise(resolve => setTimeout(resolve, sequenceDelay));
            }
          }
          result = lastResult;
          break;

        default:
          throw new Error(`Unsupported message type for Evolution: ${messageType}`);
      }

      return {
        success: true,
        messageId: (result as any)?.key?.id || (result as any)?.id || null
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async sendMessageViaDigitalSac(connectionUuid: string, phone: string, messageType: string, content: any, contactData?: any, tenantId?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      let result;
      const externalKey = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      switch (messageType) {
        case 'text':
          result = await sendMessageViaDigitalSac(connectionUuid, phone, { text: content.text }, externalKey);
          break;

        case 'image':
          result = await sendMessageViaDigitalSac(connectionUuid, phone, {
            image: { url: content.url },
            caption: content.caption || '',
            fileName: 'imagem.jpg'
          }, externalKey);
          break;

        case 'video':
          result = await sendMessageViaDigitalSac(connectionUuid, phone, {
            video: { url: content.url },
            caption: content.caption || '',
            fileName: 'video.mp4'
          }, externalKey);
          break;

        case 'audio':
          result = await sendMessageViaDigitalSac(connectionUuid, phone, {
            audio: { url: content.url },
            fileName: 'audio.ogg'
          }, externalKey);
          break;

        case 'document':
          result = await sendMessageViaDigitalSac(connectionUuid, phone, {
            document: { url: content.url },
            fileName: content.fileName || 'documento.pdf',
            caption: content.caption || ''
          }, externalKey);
          break;

        case 'openai':
          // Gerar mensagem usando OpenAI
          console.log('🤖 Gerando mensagem com OpenAI (DigitalSac)...', content);

          const openaiResult = await openaiService.generateMessage(content, contactData, tenantId);

          if (!openaiResult.success) {
            throw new Error(`OpenAI error: ${openaiResult.error}`);
          }

          console.log('✅ Mensagem gerada pela OpenAI (DigitalSac):', openaiResult.message);

          // Enviar a mensagem gerada como texto
          result = await sendMessageViaDigitalSac(connectionUuid, phone, { text: openaiResult.message }, externalKey);
          break;

        case 'groq':
          // Gerar mensagem usando Groq
          console.log('⚡ Gerando mensagem com Groq (DigitalSac)...', content);

          const groqResult = await groqService.generateMessage(content, contactData, tenantId);

          if (!groqResult.success) {
            throw new Error(`Groq error: ${groqResult.error}`);
          }

          console.log('✅ Mensagem gerada pelo Groq (DigitalSac):', groqResult.message);

          // Enviar a mensagem gerada como texto
          result = await sendMessageViaDigitalSac(connectionUuid, phone, { text: groqResult.message }, externalKey);
          break;

        case 'sequence':
          // Enviar sequência de mensagens (sem suporte a automation trigger no DigitalSac por enquanto)
          let lastResult: any = { success: true };

          for (let i = 0; i < content.sequence.length; i++) {
            const item = content.sequence[i];

            // Tratar tipo 'wait' como delay personalizado
            if (item.type === 'wait') {
              const waitTime = item.content?.waitTime || 30; // Default 30 segundos se não especificado
              console.log(`⏰ Aplicando espera personalizada de ${waitTime} segundos...`);
              await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

              // Para o wait, consideramos como "sucesso" para continuar a sequência
              lastResult = { success: true, messageId: 'wait-delay' };
              console.log(`✅ Espera de ${waitTime} segundos concluída`);
              continue; // Pular para próximo item da sequência
            }

            lastResult = await this.sendMessageViaDigitalSac(connectionUuid, phone, item.type, item.content, contactData, tenantId);

            if (!lastResult.success) {
              throw new Error(`Failed to send sequence item ${i + 1}: ${lastResult.error}`);
            }

            // Adicionar delay de 2-5 segundos entre mensagens da sequência para evitar spam (apenas entre mensagens reais)
            if (i < content.sequence.length - 1 && content.sequence[i + 1].type !== 'wait') {
              const sequenceDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 segundos
              await new Promise(resolve => setTimeout(resolve, sequenceDelay));
            }
          }
          result = lastResult;
          break;

        default:
          throw new Error(`Unsupported message type for DigitalSac: ${messageType}`);
      }

      return {
        success: true,
        messageId: (result as any)?.id || (result as any)?.messageId || externalKey
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async sendMessageViaWaha(sessionName: string, phone: string, messageType: string, content: any, validatedChatId?: string, contactData?: any, tenantId?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      let result;

      switch (messageType) {
        case 'text':
          result = await sendMessage(sessionName, phone, { text: content.text }, validatedChatId);
          break;

        case 'image':
          result = await sendMessage(sessionName, phone, {
            image: { url: content.url },
            caption: content.caption || ''
          }, validatedChatId);
          break;

        case 'video':
          result = await sendMessage(sessionName, phone, {
            video: { url: content.url },
            caption: content.caption || ''
          }, validatedChatId);
          break;

        case 'audio':
          result = await sendMessage(sessionName, phone, {
            audio: { url: content.url }
          }, validatedChatId);
          break;

        case 'document':
          result = await sendMessage(sessionName, phone, {
            document: { url: content.url },
            fileName: content.fileName || 'document'
          }, validatedChatId);
          break;

        case 'openai':
          // Gerar mensagem usando OpenAI
          console.log('🤖 Gerando mensagem com OpenAI...', content);

          const openaiResult = await openaiService.generateMessage(content, contactData, tenantId);

          if (!openaiResult.success) {
            throw new Error(`OpenAI error: ${openaiResult.error}`);
          }

          console.log('✅ Mensagem gerada pela OpenAI:', openaiResult.message);

          // Enviar a mensagem gerada como texto
          result = await sendMessage(sessionName, phone, { text: openaiResult.message }, validatedChatId);
          break;

        case 'groq':
          // Gerar mensagem usando Groq
          console.log('⚡ Gerando mensagem com Groq...', content);

          const groqResult = await groqService.generateMessage(content, contactData, tenantId);

          if (!groqResult.success) {
            throw new Error(`Groq error: ${groqResult.error}`);
          }

          console.log('✅ Mensagem gerada pela Groq:', groqResult.message);

          // Enviar a mensagem gerada como texto
          result = await sendMessage(sessionName, phone, { text: groqResult.message }, validatedChatId);
          break;

        case 'sequence':
          // Para sequência, enviar todos os itens com delay entre eles
          if (!content.sequence || content.sequence.length === 0) {
            throw new Error('Sequence is empty');
          }

          let lastResult;
          for (let i = 0; i < content.sequence.length; i++) {
            const item = content.sequence[i];

            // Tratar tipo 'wait' como delay personalizado
            if (item.type === 'wait') {
              const waitTime = item.content?.waitTime || 30; // Default 30 segundos se não especificado
              console.log(`⏰ Aplicando espera personalizada de ${waitTime} segundos (WAHA)...`);
              await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

              // Para o wait, consideramos como "sucesso" para continuar a sequência
              lastResult = { success: true, messageId: 'wait-delay' };
              console.log(`✅ Espera de ${waitTime} segundos concluída (WAHA)`);
              continue; // Pular para próximo item da sequência
            }

            lastResult = await this.sendMessageViaWaha(sessionName, phone, item.type, item.content, validatedChatId, contactData, tenantId);

            if (!lastResult.success) {
              throw new Error(`Failed to send sequence item ${i + 1}: ${lastResult.error}`);
            }

            // Adicionar delay de 2-5 segundos entre mensagens da sequência para evitar spam (apenas entre mensagens reais)
            if (i < content.sequence.length - 1 && content.sequence[i + 1].type !== 'wait') {
              const sequenceDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 segundos
              await new Promise(resolve => setTimeout(resolve, sequenceDelay));
            }
          }
          result = lastResult;
          break;

        default:
          throw new Error(`Unsupported message type: ${messageType}`);
      }

      return {
        success: true,
        messageId: (result as any)?.id || null
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async completeCampaign(campaignId: string) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { nome: true, tenantId: true, totalContacts: true, sentCount: true, failedCount: true }
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      // Limpar índice da campanha do cache
      this.campaignSessionIndexes.delete(campaignId);

      console.log(`Campaign ${campaignId} completed`);

      // Notificar via WebSocket a conclusão da campanha
      if (campaign && campaign.tenantId && websocketService.isInitialized) {
        const successRate = campaign.totalContacts > 0
          ? Math.round(((campaign.sentCount || 0) / campaign.totalContacts) * 100)
          : 0;

        await websocketService.notifyTenant(campaign.tenantId, {
          title: 'Campanha Concluída',
          message: `A campanha "${campaign.nome}" foi concluída. Taxa de sucesso: ${successRate}%`,
          type: 'SUCCESS',
          data: {
            campaignId,
            campaignName: campaign.nome,
            status: 'COMPLETED',
            totalContacts: campaign.totalContacts,
            sentCount: campaign.sentCount || 0,
            failedCount: campaign.failedCount || 0,
            successRate
          }
        });

        // Disparar trigger de automação para campanha concluída
        await automationService.executeTrigger(TriggerType.CAMPAIGN_COMPLETED, {
          campaignId,
          campaignName: campaign.nome,
          tenantId: campaign.tenantId,
          totalContacts: campaign.totalContacts,
          sentCount: campaign.sentCount || 0,
          failedCount: campaign.failedCount || 0,
          successRate,
          completedAt: new Date()
        });
      }
    } catch (error) {
      console.error(`Error completing campaign ${campaignId}:`, error);
    }
  }
}

// Criar instância singleton
const campaignScheduler = new CampaignSchedulerService();

// Iniciar automaticamente quando o módulo for carregado
campaignScheduler.start();

export default campaignScheduler;