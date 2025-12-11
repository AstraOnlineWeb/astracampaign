/**
 * Interactive Campaign Flow Engine
 * Processa respostas de contatos e navega pelo fluxo da campanha
 */

import { PrismaClient } from '@prisma/client';
import { sendMessageViaEvolution } from './evolutionMessageService';
import { interactiveCampaignSessionService } from './interactiveCampaignSessionService';
import { sendMessageViaQuepasa } from './quepasaMessageService';
import { sendMessage } from './wahaApiService';

const prisma = new PrismaClient();

interface ProcessMessageData {
  contactPhone: string;
  messageContent: string;
  sessionId?: string; // ID da sessão da conexão WhatsApp
}

export const interactiveCampaignFlowEngine = {
  /**
   * Processa mensagem recebida de um contato
   */
  async processIncomingMessage(data: ProcessMessageData) {
    try {
      console.log(`📨 Processing incoming message from ${data.contactPhone}`);

      // Buscar sessão ativa do contato
      const session = await interactiveCampaignSessionService.getActiveSessionByPhone(data.contactPhone);

      if (!session) {
        console.log(`⚠️ No active session found for ${data.contactPhone}`);
        return { processed: false, reason: 'NO_ACTIVE_SESSION' };
      }

      console.log(`✅ Found active session for campaign "${session.campaign.name}" at node ${session.currentNodeId}`);

      // Atualizar sessão com última resposta
      await interactiveCampaignSessionService.updateSession(session.id, {
        lastResponse: data.messageContent,
        lastMessageAt: new Date(),
      });

      // Buscar grafo da campanha
      const graph = session.campaign.graph as any;
      const currentNode = graph.nodes?.find((n: any) => n.id === session.currentNodeId);

      if (!currentNode) {
        console.error(`❌ Current node ${session.currentNodeId} not found in campaign graph`);
        return { processed: false, reason: 'NODE_NOT_FOUND' };
      }

      console.log(`📍 Current node type: ${currentNode.data?.nodeType}, label: ${currentNode.data?.label}`);

      // Determinar próximo nó baseado no tipo do nó atual
      const nextNode = await this.determineNextNode(graph, currentNode, data.messageContent, session);

      if (!nextNode) {
        console.log(`🏁 No next node found. Flow completed for contact ${data.contactPhone}`);
        await interactiveCampaignSessionService.completeSession(session.id);
        return { processed: true, completed: true };
      }

      console.log(`➡️ Moving to next node: ${nextNode.id} (${nextNode.data?.nodeType})`);

      // Atualizar nó atual da sessão
      await interactiveCampaignSessionService.updateSession(session.id, {
        currentNodeId: nextNode.id,
      });

      // Se o próximo nó é um delay, processar delay e avançar
      if (nextNode.data?.nodeType === 'delay') {
        await this.processDelayNode(graph, nextNode, session, data.contactPhone);
        return { processed: true, nextNodeId: nextNode.id, delayed: true };
      }

      // Se o próximo nó é um tipo que envia mensagem, enviar
      const messageNodeTypes = ['action', 'text', 'image', 'video', 'audio', 'document'];
      if (messageNodeTypes.includes(nextNode.data?.nodeType)) {
        await this.sendNodeMessage(nextNode, session, data.contactPhone);
      }

      return { processed: true, nextNodeId: nextNode.id };

    } catch (error: any) {
      console.error(`❌ Error processing message from ${data.contactPhone}:`, error);
      return { processed: false, error: error.message };
    }
  },

  /**
   * Determina próximo nó baseado no tipo do nó atual e resposta do usuário
   */
  async determineNextNode(graph: any, currentNode: any, userResponse: string, session: any) {
    const nodeType = currentNode.data?.nodeType;

    // Se o nó atual é uma ação, procurar próximo nó conectado
    if (nodeType === 'action') {
      const outgoingEdge = graph.edges?.find((e: any) => e.source === currentNode.id);
      if (outgoingEdge) {
        return graph.nodes?.find((n: any) => n.id === outgoingEdge.target);
      }
    }

    // Se o nó atual é uma condição, avaliar a condição
    if (nodeType === 'condition') {
      return await this.evaluateCondition(graph, currentNode, userResponse, session);
    }

    // Nó trigger ou desconhecido - procurar próximo
    const outgoingEdge = graph.edges?.find((e: any) => e.source === currentNode.id);
    if (outgoingEdge) {
      return graph.nodes?.find((n: any) => n.id === outgoingEdge.target);
    }

    return null;
  },

  /**
   * Avalia condição e retorna próximo nó baseado no resultado
   */
  async evaluateCondition(graph: any, conditionNode: any, userResponse: string, session: any) {
    const config = conditionNode.data?.config;

    if (!config) {
      console.error(`❌ Condition node ${conditionNode.id} has no config`);
      return null;
    }

    console.log(`🔍 Evaluating condition:`, config);

    // Verificar se é modo switch
    if (config.mode === 'switch' && config.cases) {
      return await this.evaluateSwitchCondition(graph, conditionNode, userResponse, session, config);
    }

    // Modo if/else tradicional
    const { field, conditionType, value } = config;

    // Normalizar resposta do usuário
    const normalizedResponse = userResponse.toLowerCase().trim();
    const normalizedValue = value?.toLowerCase().trim();

    let conditionMet = false;

    // Avaliar condição baseado no operador
    switch (conditionType) {
      case 'equals':
      case '==':
        conditionMet = normalizedResponse === normalizedValue;
        break;

      case 'contains':
        conditionMet = normalizedResponse.includes(normalizedValue);
        break;

      case 'startsWith':
        conditionMet = normalizedResponse.startsWith(normalizedValue);
        break;

      case 'endsWith':
        conditionMet = normalizedResponse.endsWith(normalizedValue);
        break;

      case 'notEquals':
      case '!=':
        conditionMet = normalizedResponse !== normalizedValue;
        break;

      case 'regex':
        try {
          const regex = new RegExp(value, 'i');
          conditionMet = regex.test(normalizedResponse);
        } catch (e) {
          console.error(`❌ Invalid regex: ${value}`);
          conditionMet = false;
        }
        break;

      default:
        console.warn(`⚠️ Unknown conditionType: ${conditionType}, defaulting to equals`);
        conditionMet = normalizedResponse.includes(normalizedValue);
    }

    console.log(`📊 Condition result: ${conditionMet} (response: "${normalizedResponse}" ${conditionType} "${normalizedValue}")`);

    // Salvar resultado da condição nas variáveis da sessão
    await interactiveCampaignSessionService.updateSession(session.id, {
      variables: {
        [`condition_${conditionNode.id}`]: conditionMet,
        lastConditionResult: conditionMet,
      },
    });

    // Procurar edge correspondente (true/false)
    const edges = graph.edges?.filter((e: any) => e.source === conditionNode.id);

    if (!edges || edges.length === 0) {
      console.error(`❌ No edges found for condition node ${conditionNode.id}`);
      return null;
    }

    // Procurar edge com label correspondente
    const targetEdge = edges.find((e: any) => {
      //const label = e.label?.toLowerCase();
      const label = e.sourceHandle?.toLowerCase();
      console.log('targetEdge edges', e);
      console.log('conditionMet', conditionMet);
      console.log('label', label);
      return conditionMet
        ? (label === 'true' || label === 'sim' || label === 'yes' || label === 'verdadeiro')
        : (label === 'false' || label === 'não' || label === 'no' || label === 'falso');
      // return conditionMet === e.sourceHandle;
    });

    if (targetEdge) {
      return graph.nodes?.find((n: any) => n.id === targetEdge.target);
    }

    // Fallback: usar primeira edge se não encontrar label específico
    console.warn(`⚠️ No specific edge found for condition result, using first edge`);
    return graph.nodes?.find((n: any) => n.id === edges[0].target);
  },

  /**
   * Avalia condição do tipo switch/case
   */
  async evaluateSwitchCondition(graph: any, conditionNode: any, userResponse: string, session: any, config: any) {
    const normalizedResponse = userResponse.toLowerCase().trim();

    console.log(`🔀 Evaluating SWITCH condition with ${config.cases?.length || 0} cases`);
    console.log(`📝 User response: "${normalizedResponse}"`);

    // Procurar qual case corresponde à resposta
    let matchedCaseIndex = -1;

    if (config.cases && Array.isArray(config.cases)) {
      for (let i = 0; i < config.cases.length; i++) {
        const caseConfig = config.cases[i];
        const caseValue = caseConfig.value?.toLowerCase().trim();
        const conditionType = caseConfig.conditionType || 'equals';

        let matches = false;

        switch (conditionType) {
          case 'equals':
            matches = normalizedResponse === caseValue;
            break;
          case 'contains':
            matches = normalizedResponse.includes(caseValue);
            break;
          case 'startsWith':
            matches = normalizedResponse.startsWith(caseValue);
            break;
          case 'endsWith':
            matches = normalizedResponse.endsWith(caseValue);
            break;
          default:
            matches = normalizedResponse === caseValue;
        }

        if (matches) {
          matchedCaseIndex = i;
          console.log(`✅ Matched case ${i}: "${caseConfig.label}" (value: "${caseConfig.value}")`);
          break;
        }
      }
    }

    if (matchedCaseIndex === -1) {
      console.log(`❌ No case matched for response: "${userResponse}"`);

      // Salvar que não houve match
      await interactiveCampaignSessionService.updateSession(session.id, {
        variables: {
          [`switch_${conditionNode.id}`]: null,
          lastSwitchResult: null,
        },
      });

      // Procurar edge default ou primeira edge
      const edges = graph.edges?.filter((e: any) => e.source === conditionNode.id);
      if (edges && edges.length > 0) {
        const defaultEdge = edges.find((e: any) => e.sourceHandle === 'default');
        const targetEdge = defaultEdge || edges[0];
        console.log(`⚠️ Using ${defaultEdge ? 'default' : 'first'} edge as fallback`);
        return graph.nodes?.find((n: any) => n.id === targetEdge.target);
      }

      return null;
    }

    // Salvar resultado do switch
    await interactiveCampaignSessionService.updateSession(session.id, {
      variables: {
        [`switch_${conditionNode.id}`]: matchedCaseIndex,
        lastSwitchResult: matchedCaseIndex,
        lastSwitchValue: config.cases[matchedCaseIndex].value,
      },
    });

    // Procurar edge correspondente ao case (usando sourceHandle = case-N)
    const edges = graph.edges?.filter((e: any) => e.source === conditionNode.id);

    if (!edges || edges.length === 0) {
      console.error(`❌ No edges found for switch node ${conditionNode.id}`);
      return null;
    }

    // Procurar edge com sourceHandle = case-N (onde N é o índice do case)
    const caseHandle = `case-${matchedCaseIndex}`;
    const targetEdge = edges.find((e: any) => e.sourceHandle === caseHandle);

    if (targetEdge) {
      console.log(`➡️ Following edge with handle: ${caseHandle}`);
      return graph.nodes?.find((n: any) => n.id === targetEdge.target);
    }

    console.warn(`⚠️ No edge found for case ${matchedCaseIndex}, checking for default edge`);

    // Procurar edge default
    const defaultEdge = edges.find((e: any) => e.sourceHandle === 'default');
    if (defaultEdge) {
      console.log(`➡️ Following default edge`);
      return graph.nodes?.find((n: any) => n.id === defaultEdge.target);
    }

    console.error(`❌ No edge found for matched case ${matchedCaseIndex} and no default edge`);
    return null;
  },

  /**
   * Envia mensagem de um nó para o contato
   */
  async sendNodeMessage(node: any, session: any, contactPhone: string) {
    const config = node.data?.config;
    const nodeType = node.data?.nodeType;

    if (!config) {
      console.error(`❌ Node ${node.id} has no config`);
      return;
    }

    // Buscar conexão da campanha
    const campaign = await prisma.interactiveCampaign.findUnique({
      where: { id: session.campaignId },
      include: { connection: true },
    });

    if (!campaign) {
      console.error(`❌ Campaign ${session.campaignId} not found`);
      return;
    }

    let connection = campaign.connection;

    // Se não tem connection (connectionId null), buscar do graph do trigger
    if (!connection) {
      const graph = campaign.graph as any;
      const triggerNode = graph.nodes?.find((n: any) => n.data?.nodeType === 'trigger');

      if (triggerNode?.data?.config?.connections?.length > 0) {
        const connectionId = triggerNode.data.config.connections[0];
        console.log(`🔍 Getting connection from trigger: ${connectionId}`);

        // Buscar tanto em Connection quanto WhatsAppSession
        connection = await prisma.connection.findUnique({
          where: { id: connectionId },
        });

        if (!connection) {
          // Buscar em WhatsAppSession (tabela antiga)
          const oldSession = await prisma.whatsAppSession.findUnique({
            where: { id: connectionId },
            select: {
              id: true,
              name: true,
              provider: true,
              meJid: true,
              quepasaToken: true,
            },
          });

          if (oldSession) {
            // Converter para formato de Connection
            connection = {
              id: oldSession.id,
              provider: (oldSession.provider || 'WAHA') as 'WAHA' | 'EVOLUTION' | 'QUEPASA',
              instanceName: oldSession.name,
              phoneNumber: oldSession.meJid || oldSession.name,
              status: 'ACTIVE' as const,
              webhookSecret: '',
              callbackUrl: '',
              tenantId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              quepasaToken: oldSession.quepasaToken,
            } as any;
            console.log(`✅ Using connection from WhatsAppSession: ${oldSession.name}`);
          }
        } else {
          console.log(`✅ Using connection from Connection table: ${connection.instanceName}`);
        }
      }
    }

    if (!connection) {
      console.error(`❌ No connection found for campaign ${session.campaignId}`);
      return;
    }
    const variables = (session.variables as Record<string, any>) || {};

    // Preparar payload baseado no tipo de nó
    let messagePayload: any = null;

    switch (nodeType) {
      case 'text':
      case 'action':
        const textContent = config.content || config.message || '';
        const personalizedText = this.replaceVariables(textContent, variables);
        messagePayload = { text: personalizedText };
        console.log(`📤 Sending text to ${contactPhone}: "${personalizedText.substring(0, 50)}..."`);
        break;

      case 'image':
        const imageUrl = config.mediaUrl;
        const imageCaption = config.caption || '';
        const personalizedImageCaption = this.replaceVariables(imageCaption, variables);
        messagePayload = {
          image: { url: imageUrl },
          caption: personalizedImageCaption || undefined,
        };
        console.log(`📤 Sending image to ${contactPhone}`);
        break;

      case 'video':
        const videoUrl = config.mediaUrl;
        const videoCaption = config.caption || '';
        const personalizedVideoCaption = this.replaceVariables(videoCaption, variables);
        messagePayload = {
          video: { url: videoUrl },
          caption: personalizedVideoCaption || undefined,
        };
        console.log(`📤 Sending video to ${contactPhone}`);
        break;

      case 'audio':
        const audioUrl = config.mediaUrl;
        messagePayload = {
          audio: { url: audioUrl },
        };
        console.log(`📤 Sending audio to ${contactPhone}`);
        break;

      case 'document':
        const documentUrl = config.mediaUrl;
        const fileName = config.fileName;
        messagePayload = {
          document: { url: documentUrl },
          fileName: fileName || 'document.pdf',
        };
        console.log(`📤 Sending document to ${contactPhone}: ${fileName}`);
        break;

      default:
        console.warn(`⚠️ Unsupported node type for sending: ${nodeType}`);
        return;
    }

    if (!messagePayload) {
      console.warn(`⚠️ No message payload generated for node ${node.id}`);
      return;
    }

    // Enviar baseado no provider
    try {
      switch (connection.provider) {
        case 'WAHA':
          await sendMessage(connection.instanceName, contactPhone, messagePayload);
          break;

        case 'EVOLUTION':
          await sendMessageViaEvolution(connection.instanceName, contactPhone, messagePayload);
          break;

        case 'QUEPASA':
          // Buscar token QuePasa (pode vir da conexão convertida ou do banco)
          let quepasaToken = (connection as any).quepasaToken;

          if (!quepasaToken) {
            const quepasaSession = await prisma.whatsAppSession.findFirst({
              where: { name: connection.instanceName },
              select: { quepasaToken: true },
            });
            quepasaToken = quepasaSession?.quepasaToken;
          }

          await sendMessageViaQuepasa(
            connection.instanceName,
            contactPhone,
            messagePayload,
            quepasaToken || undefined
          );
          break;

        default:
          console.error(`❌ Unknown provider: ${connection.provider}`);
      }

      console.log(`✅ Message sent successfully to ${contactPhone}`);

      // Registrar nó visitado
      await interactiveCampaignSessionService.addVisitedNode(
        session.id,
        node.id,
        true
      );
    } catch (error: any) {
      console.error(`❌ Error sending message to ${contactPhone}:`, error.message);

      // Registrar falha
      await interactiveCampaignSessionService.addVisitedNode(
        session.id,
        node.id,
        false,
        error.message
      );

      throw error;
    }
  },

  /**
   * Substitui variáveis no template de mensagem
   */
  replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;

    // Substituir variáveis no formato {variavel}
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      result = result.replace(regex, String(variables[key] || ''));
    });

    return result;
  },

  /**
   * Processa nó de delay e avança automaticamente após o tempo configurado
   */
  async processDelayNode(graph: any, delayNode: any, session: any, contactPhone: string) {
    try {
      const config = delayNode.data?.config;
      const delaySeconds = config?.value || config?.delaySeconds || config?.seconds || config?.delay || 0;

      console.log(`⏱️ Delay node: waiting ${delaySeconds} seconds before continuing`);

      if (delaySeconds <= 0) {
        console.warn(`⚠️ Invalid delay time: ${delaySeconds}s, skipping delay`);
        // Avançar imediatamente para o próximo nó
        const nextEdge = graph.edges?.find((e: any) => e.source === delayNode.id);
        if (nextEdge) {
          const nextNode = graph.nodes?.find((n: any) => n.id === nextEdge.target);
          if (nextNode) {
            await this.processNextNodeAfterDelay(graph, nextNode, session, contactPhone);
          }
        }
        return;
      }

      // Agendar processamento do próximo nó após o delay
      setTimeout(async () => {
        try {
          console.log(`⏰ Delay completed (${delaySeconds}s), continuing flow for ${contactPhone}`);

          // Buscar próximo nó conectado ao delay
          const nextEdge = graph.edges?.find((e: any) => e.source === delayNode.id);
          if (!nextEdge) {
            console.log(`🏁 No next node after delay, flow completed`);
            await interactiveCampaignSessionService.completeSession(session.id);
            return;
          }

          const nextNode = graph.nodes?.find((n: any) => n.id === nextEdge.target);
          if (!nextNode) {
            console.error(`❌ Next node not found after delay`);
            return;
          }

          await this.processNextNodeAfterDelay(graph, nextNode, session, contactPhone);

        } catch (error: any) {
          console.error(`❌ Error processing node after delay:`, error.message);
        }
      }, delaySeconds * 1000);

    } catch (error: any) {
      console.error(`❌ Error processing delay node:`, error.message);
    }
  },

  /**
   * Processa próximo nó após um delay
   */
  async processNextNodeAfterDelay(graph: any, nextNode: any, session: any, contactPhone: string) {
    try {
      console.log(`➡️ Processing next node after delay: ${nextNode.id} (${nextNode.data?.nodeType})`);

      // Atualizar sessão para o novo nó
      await interactiveCampaignSessionService.updateSession(session.id, {
        currentNodeId: nextNode.id,
      });

      // Se é outro delay, processar recursivamente
      if (nextNode.data?.nodeType === 'delay') {
        await this.processDelayNode(graph, nextNode, session, contactPhone);
        return;
      }

      // Se é um nó de mensagem, enviar
      const messageNodeTypes = ['action', 'text', 'image', 'video', 'audio', 'document'];
      if (messageNodeTypes.includes(nextNode.data?.nodeType)) {
        await this.sendNodeMessage(nextNode, session, contactPhone);

        // Continuar processando nós subsequentes automaticamente
        await this.continueFlowAfterMessage(graph, nextNode, session, contactPhone);
      }

    } catch (error: any) {
      console.error(`❌ Error processing next node after delay:`, error.message);
    }
  },

  /**
   * Continua o fluxo automaticamente após enviar uma mensagem (para delays encadeados)
   */
  async continueFlowAfterMessage(graph: any, currentNode: any, session: any, contactPhone: string) {
    try {
      // Buscar próximo nó
      const nextEdge = graph.edges?.find((e: any) => e.source === currentNode.id);
      if (!nextEdge) {
        return; // Sem próximo nó, aguardar resposta do usuário
      }

      const nextNode = graph.nodes?.find((n: any) => n.id === nextEdge.target);
      if (!nextNode) {
        return;
      }

      // Se próximo nó é delay, processar
      if (nextNode.data?.nodeType === 'delay') {
        await interactiveCampaignSessionService.updateSession(session.id, {
          currentNodeId: nextNode.id,
        });
        await this.processDelayNode(graph, nextNode, session, contactPhone);
        return;
      }

      // Se próximo nó é mensagem, enviar (continuar sequência)
      const messageNodeTypes = ['action', 'text', 'image', 'video', 'audio', 'document'];
      if (messageNodeTypes.includes(nextNode.data?.nodeType)) {
        await interactiveCampaignSessionService.updateSession(session.id, {
          currentNodeId: nextNode.id,
        });
        await this.sendNodeMessage(nextNode, session, contactPhone);
        // Continuar recursivamente
        await this.continueFlowAfterMessage(graph, nextNode, session, contactPhone);
        return;
      }

      // Se é condição ou stop, parar e aguardar
      if (['condition', 'stop'].includes(nextNode.data?.nodeType)) {
        await interactiveCampaignSessionService.updateSession(session.id, {
          currentNodeId: nextNode.id,
        });
        return;
      }

    } catch (error: any) {
      console.error(`❌ Error continuing flow after message:`, error.message);
    }
  },
};
