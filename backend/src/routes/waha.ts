import { Router } from 'express';
import { WahaSyncService } from '../services/wahaSyncService';
import { WhatsAppSessionService } from '../services/whatsappSessionService';
import { evolutionApiService } from '../services/evolutionApiService';
import { settingsService } from '../services/settingsService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { Response } from 'express';
import { checkConnectionQuota } from '../middleware/quotaMiddleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const fetch = require('node-fetch');

const wahaRequest = async (endpoint: string, options: any = {}) => {
  // Buscar configurações dinâmicas do banco usando o método específico
  const config = await settingsService.getWahaConfig();
  const WAHA_BASE_URL = config.host || process.env.WAHA_BASE_URL || process.env.DEFAULT_WAHA_HOST || '';
  const WAHA_API_KEY = config.apiKey || process.env.WAHA_API_KEY || process.env.DEFAULT_WAHA_API_KEY || '';

  console.log('🔍 WAHA Config Debug (routes):', {
    host: config.host,
    apiKey: config.apiKey ? `${config.apiKey.substring(0, 8)}...` : 'undefined',
    finalUrl: WAHA_BASE_URL,
    finalKey: WAHA_API_KEY ? `${WAHA_API_KEY.substring(0, 8)}...` : 'undefined'
  });

  if (!WAHA_BASE_URL || !WAHA_API_KEY) {
    throw new Error('Configurações WAHA não encontradas. Configure o Host e API Key nas configurações do sistema.');
  }

  const url = `${WAHA_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': WAHA_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`WAHA API Error: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
};

const router = Router();

// Listar todas as sessões sincronizadas com WAHA API
router.get('/sessions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const headerTenantId = req.header('X-Tenant-Id');
    console.log('📋 GET /sessions - user:', req.user?.email, 'role:', req.user?.role, 'tenantId:', req.tenantId, 'X-Tenant-Id header:', headerTenantId);

    // Sempre usar o tenantId do token (mesmo para SUPERADMIN quando tem empresa selecionada)
    const tenantId = req.tenantId;

    // Sempre sincronizar sessões WAHA para pegar status atualizado (WORKING, SCAN_QR_CODE, etc)
    try {
      await WahaSyncService.syncAllSessions();
    } catch (wahaError) {
      console.warn('⚠️ Erro ao sincronizar WAHA, mas continuando com dados do banco:', wahaError);
    }

    // Sincronizar sessões Evolution (se existirem) - apenas para o tenant correto
    const allSessions = await WhatsAppSessionService.getAllSessions(tenantId);

    // Para sessões Evolution, tentar obter status atualizado
    for (const session of allSessions) {
      if (session.provider === 'EVOLUTION') {
        try {
          const status = await evolutionApiService.getInstanceStatus(session.name);
          console.log(`🔍 Status Evolution para ${session.name}:`, status);

          // Obter informações detalhadas da instância
          const instanceInfo = await evolutionApiService.getInstanceInfo(session.name);

          // Montar dados do 'me' quando conectado
          let meData = undefined;
          const evolutionData = instanceInfo as any;
          if (status === 'WORKING' && evolutionData.ownerJid) {
            meData = {
              id: evolutionData.ownerJid,
              pushName: evolutionData.profileName || instanceInfo.profileName || 'Usuário WhatsApp',
              jid: evolutionData.ownerJid
            };
          }

          // Só atualizar se o status for válido
          if (status && ['WORKING', 'SCAN_QR_CODE', 'STOPPED', 'FAILED'].includes(status)) {
            await WhatsAppSessionService.createOrUpdateSession({
              name: session.name,
              status: status as 'WORKING' | 'SCAN_QR_CODE' | 'STOPPED' | 'FAILED',
              provider: 'EVOLUTION',
              me: meData,
              qr: session.qr || undefined,
              qrExpiresAt: session.qrExpiresAt || undefined,
              tenantId: session.tenantId || undefined
            });
          } else {
            console.warn(`⚠️ Status inválido para sessão ${session.name}: ${status}`);
          }
        } catch (evolutionError) {
          console.warn(`⚠️ Erro ao sincronizar status Evolution para ${session.name}:`, evolutionError);
        }
      }
    }

    // Retornar todas as sessões atualizadas do banco
    const updatedSessions = await WhatsAppSessionService.getAllSessions(tenantId);
    res.json(updatedSessions);
  } catch (error) {
    console.error('Erro ao listar sessões:', error);
    res.status(500).json({ error: 'Erro ao listar sessões WhatsApp' });
  }
});

// Obter informações de uma sessão específica
router.get('/sessions/:sessionName', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionName } = req.params;
    console.log('🔍 GET /sessions/:sessionName - sessionName:', sessionName, 'user:', req.user?.email, 'tenantId:', req.tenantId);

    // SUPERADMIN pode ver qualquer sessão, outros usuários só do seu tenant
    const tenantId = req.user?.role === 'SUPERADMIN' ? undefined : req.tenantId;

    // Primeiro tentar buscar a sessão no banco com tenant isolation
    try {
      const session = await WhatsAppSessionService.getSession(sessionName, tenantId);
      console.log('✅ Sessão encontrada no banco:', session.name);
      return res.json(session);
    } catch (dbError) {
      console.log('⚠️ Sessão não encontrada no banco, tentando sincronizar com WAHA...');
    }

    // Se não encontrar no banco, tentar sincronizar com WAHA
    const session = await WahaSyncService.syncSession(sessionName);
    res.json(session);
  } catch (error) {
    console.error('Erro ao obter sessão:', error);
    res.status(500).json({ error: 'Erro ao obter informações da sessão' });
  }
});

// Criar nova sessão
router.post('/sessions', authMiddleware, checkConnectionQuota, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, provider = 'WAHA', connectionUuid, externalKey, token } = req.body;
    console.log('➕ POST /sessions - name:', name, 'provider:', provider, 'connectionUuid:', connectionUuid, 'externalKey:', externalKey, 'user:', req.user?.email, 'tenantId:', req.tenantId);

    if (!name) {
      return res.status(400).json({ error: 'Nome da sessão é obrigatório' });
    }

    if (!['WAHA', 'EVOLUTION', 'DIGITALSAC'].includes(provider)) {
      return res.status(400).json({ error: 'Provedor deve ser WAHA, EVOLUTION ou DIGITALSAC' });
    }

    // Para DigitalSac, connectionUuid, externalKey e token são obrigatórios
    if (provider === 'DIGITALSAC' && !connectionUuid) {
      return res.status(400).json({ error: 'URL da conexão é obrigatória para DigitalSac' });
    }

    if (provider === 'DIGITALSAC' && !externalKey) {
      return res.status(400).json({ error: 'ExternalKey é obrigatório para DigitalSac' });
    }

    if (provider === 'DIGITALSAC' && !token) {
      return res.status(400).json({ error: 'Token é obrigatório para DigitalSac' });
    }

    // Usar tenantId do usuário autenticado (SUPERADMIN pode especificar tenant no body se necessário)
    const tenantId = req.user?.role === 'SUPERADMIN' ? req.body.tenantId || req.tenantId : req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId é obrigatório' });
    }

    // Gerar nome real: displayName_primeiros8CharsTenantId
    // Ex: vendas_c52982e8
    const displayName = name.trim();
    const tenantPrefix = tenantId.substring(0, 8);
    const realName = `${displayName}_${tenantPrefix}`;

    console.log('📝 Criando sessão - displayName:', displayName, 'realName:', realName);

    // Verificar se já existe uma sessão com este realName
    const existingSession = await prisma.whatsAppSession.findUnique({
      where: { name: realName }
    });

    if (existingSession) {
      console.log('⚠️ Sessão já existe:', realName);
      return res.status(409).json({ error: 'Já existe uma conexão com este nome' });
    }

    let result;

    if (provider === 'EVOLUTION') {
      const { evolutionApiService } = await import('../services/evolutionApiService');
      result = await evolutionApiService.createInstance(realName);

      // Salvar no banco com provider Evolution, tenantId e displayName
      await WhatsAppSessionService.createOrUpdateSession({
        name: realName,
        displayName,
        status: 'SCAN_QR_CODE',
        provider: 'EVOLUTION',
        tenantId
      });
    } else if (provider === 'DIGITALSAC') {
      // DigitalSac: apenas registrar o UUID da conexão
      // Não há processo de "criação" - a conexão já existe no DigitalSac
      const { digitalSacApiService } = await import('../services/digitalSacApiService');
      
      // Validar se as configurações globais estão corretas
      const isValid = await digitalSacApiService.validateConfig();
      if (!isValid) {
        return res.status(400).json({ error: 'Configurações do DigitalSac não encontradas. Configure Host e Token nas configurações do sistema.' });
      }

      // Apenas registrar no banco local - sem chamada de API
      await WhatsAppSessionService.createOrUpdateSession({
        name: realName,
        displayName,
        status: 'WORKING', // Sempre WORKING - API direta, sem conexão
        provider: 'DIGITALSAC',
        connectionUuid,
        externalKey,
        token,
        tenantId
      });

      result = {
        success: true,
        message: 'Conexão DigitalSac registrada com sucesso',
        session: {
          name: realName,
          displayName,
          status: 'WORKING',
          provider: 'DIGITALSAC',
          connectionUuid,
          externalKey,
          token: '***' // Não retornar o token completo
        }
      };
    } else {
      // WAHA (comportamento original)
      result = await WahaSyncService.createSession(realName);

      // Para WAHA também salvar com tenantId e displayName
      await WhatsAppSessionService.createOrUpdateSession({
        name: realName,
        displayName,
        status: 'SCAN_QR_CODE',
        provider: 'WAHA',
        tenantId
      });
    }

    console.log('✅ Sessão criada:', realName, '(display:', displayName, ') tenant:', tenantId);

    res.json(result);
  } catch (error) {
    console.error('Erro ao criar sessão:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erro ao criar sessão WhatsApp' });
  }
});

// Iniciar sessão
router.post('/sessions/:sessionName/start', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionName } = req.params;
    console.log('▶️ POST /sessions/:sessionName/start - sessionName:', sessionName, 'user:', req.user?.email, 'tenantId:', req.tenantId);

    // SUPERADMIN pode iniciar qualquer sessão, outros usuários só do seu tenant
    const tenantId = req.user?.role === 'SUPERADMIN' ? undefined : req.tenantId;

    // Verificar o provedor da sessão
    let sessionProvider = 'WAHA'; // Default para WAHA (compatibilidade)
    let sessionData: any;
    try {
      sessionData = await WhatsAppSessionService.getSession(sessionName, tenantId);
      sessionProvider = sessionData.provider || 'WAHA';
    } catch (error) {
      console.error('❌ Sessão não encontrada ou não pertence ao tenant:', error);
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    console.log(`▶️ Iniciando sessão ${sessionName} via ${sessionProvider}`);

    let result;
    if (sessionProvider === 'EVOLUTION') {
      // Usar Evolution API
      result = await evolutionApiService.getQRCode(sessionName);

      // Atualizar status no banco
      await WhatsAppSessionService.createOrUpdateSession({
        name: sessionName,
        status: 'SCAN_QR_CODE',
        provider: 'EVOLUTION',
        tenantId: sessionData.tenantId
      });
    } else if (sessionProvider === 'DIGITALSAC') {
      // DigitalSac é API direta - não tem processo de "iniciar"
      // Apenas retornar sucesso (já está sempre ativo se configurado)
      result = {
        success: true,
        message: 'DigitalSac é uma API direta - sempre ativo quando configurado',
        status: 'WORKING'
      };
    } else {
      // Usar WAHA com chamada direta
      result = await wahaRequest(`/api/sessions/${sessionName}/start`, {
        method: 'POST'
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Erro ao iniciar sessão:', error);
    res.status(500).json({ error: 'Erro ao iniciar sessão WhatsApp' });
  }
});

// Parar sessão
router.post('/sessions/:sessionName/stop', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionName } = req.params;
    console.log('⏹️ POST /sessions/:sessionName/stop - sessionName:', sessionName, 'user:', req.user?.email, 'tenantId:', req.tenantId);

    // SUPERADMIN pode parar qualquer sessão, outros usuários só do seu tenant
    const tenantId = req.user?.role === 'SUPERADMIN' ? undefined : req.tenantId;

    // Verificar o provedor da sessão
    let sessionProvider = 'WAHA';
    let sessionData: any;
    try {
      sessionData = await WhatsAppSessionService.getSession(sessionName, tenantId);
      sessionProvider = sessionData.provider || 'WAHA';
    } catch (error) {
      console.error('❌ Sessão não encontrada ou não pertence ao tenant:', error);
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    console.log(`⏹️ Parando sessão ${sessionName} via ${sessionProvider}`);

    let result;
    if (sessionProvider === 'EVOLUTION') {
      // Para Evolution API, não há stop específico, apenas deletar
      result = { message: 'Sessão Evolution parada (conceitual)' };
      await WhatsAppSessionService.createOrUpdateSession({
        name: sessionName,
        status: 'STOPPED',
        provider: 'EVOLUTION',
        tenantId: sessionData.tenantId
      });
    } else if (sessionProvider === 'DIGITALSAC') {
      // DigitalSac é API direta - não há "parar"
      // A conexão continua ativa no DigitalSac, apenas desabilitamos localmente
      result = { 
        success: true,
        message: 'Sessão DigitalSac desabilitada localmente (a conexão continua ativa no DigitalSac)' 
      };
      await WhatsAppSessionService.createOrUpdateSession({
        name: sessionName,
        status: 'STOPPED',
        provider: 'DIGITALSAC',
        connectionUuid: sessionData.connectionUuid,
        tenantId: sessionData.tenantId
      });
    } else {
      result = await WahaSyncService.stopSession(sessionName);
    }

    res.json(result);
  } catch (error) {
    console.error('Erro ao parar sessão:', error);
    res.status(500).json({ error: 'Erro ao parar sessão WhatsApp' });
  }
});

// Reiniciar sessão
router.post('/sessions/:sessionName/restart', async (req, res) => {
  try {
    const { sessionName } = req.params;

    // Verificar o provedor da sessão
    let sessionProvider = 'WAHA';
    try {
      const savedSession = await WhatsAppSessionService.getSession(sessionName);
      sessionProvider = (savedSession as any).provider || 'WAHA';
    } catch (error) {
      // Se sessão não existe no banco, assumir WAHA
    }

    console.log(`🔄 Reiniciando sessão ${sessionName} via ${sessionProvider}`);

    let result;
    if (sessionProvider === 'EVOLUTION') {
      result = await evolutionApiService.restartInstance(sessionName);
      await WhatsAppSessionService.createOrUpdateSession({
        name: sessionName,
        status: 'SCAN_QR_CODE',
        provider: 'EVOLUTION'
      });
    } else if (sessionProvider === 'DIGITALSAC') {
      // DigitalSac é API direta - apenas reabilitar localmente
      result = {
        success: true,
        message: 'Sessão DigitalSac reabilitada localmente'
      };
      await WhatsAppSessionService.createOrUpdateSession({
        name: sessionName,
        status: 'WORKING',
        provider: 'DIGITALSAC'
      });
    } else {
      result = await WahaSyncService.restartSession(sessionName);
    }

    res.json(result);
  } catch (error) {
    console.error('Erro ao reiniciar sessão:', error);
    res.status(500).json({ error: 'Erro ao reiniciar sessão WhatsApp' });
  }
});

// Deletar sessão
router.delete('/sessions/:sessionName', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionName } = req.params;
    console.log('🗑️ DELETE /sessions/:sessionName - sessionName:', sessionName, 'user:', req.user?.email, 'tenantId:', req.tenantId);

    // SUPERADMIN pode deletar qualquer sessão, outros usuários só do seu tenant
    const tenantId = req.user?.role === 'SUPERADMIN' ? undefined : req.tenantId;

    // Verificar o provedor da sessão
    let sessionProvider: 'WAHA' | 'EVOLUTION' | 'DIGITALSAC' = 'WAHA';
    try {
      const savedSession = await WhatsAppSessionService.getSession(sessionName, tenantId);
      sessionProvider = (savedSession.provider as 'WAHA' | 'EVOLUTION' | 'DIGITALSAC') || 'WAHA';
    } catch (error) {
      console.error('❌ Sessão não encontrada ou não pertence ao tenant:', error);
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    console.log(`🗑️ Deletando sessão ${sessionName} via ${sessionProvider}`);

    // Deletar da API correspondente
    if (sessionProvider === 'EVOLUTION') {
      try {
        await evolutionApiService.deleteInstance(sessionName);
        console.log(`✅ Sessão ${sessionName} deletada da Evolution API`);
      } catch (error) {
        console.warn(`⚠️ Erro ao deletar ${sessionName} da Evolution API:`, error);
      }
      // Para Evolution, deletar manualmente do banco também
      try {
        await WhatsAppSessionService.deleteSession(sessionName, tenantId);
        console.log(`✅ Sessão ${sessionName} removida do banco de dados`);
      } catch (error) {
        console.warn(`⚠️ Erro ao deletar ${sessionName} do banco:`, error);
      }
    } else if (sessionProvider === 'DIGITALSAC') {
      // DigitalSac: apenas remove registro local
      // A conexão permanece ativa no DigitalSac - é responsabilidade do usuário gerenciar lá
      try {
        await WhatsAppSessionService.deleteSession(sessionName, tenantId);
        console.log(`✅ Registro DigitalSac ${sessionName} removido do banco local (conexão permanece no DigitalSac)`);
      } catch (error) {
        console.warn(`⚠️ Erro ao deletar ${sessionName} do banco:`, error);
      }
    } else {
      // Deletar via WAHA (já remove do banco também)
      await WahaSyncService.deleteSession(sessionName);
    }

    res.json({ success: true, message: 'Sessão removida com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar sessão:', error);
    res.status(500).json({ error: 'Erro ao remover sessão WhatsApp' });
  }
});

// Obter QR Code da sessão
router.get('/sessions/:sessionName/auth/qr', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionName } = req.params;
    console.log(`🔍 GET /sessions/:sessionName/auth/qr - sessionName: ${sessionName}, user: ${req.user?.email}, tenantId: ${req.tenantId}`);

    // SUPERADMIN pode ver QR de qualquer sessão, outros usuários só do seu tenant
    const tenantId = req.user?.role === 'SUPERADMIN' ? undefined : req.tenantId;

    // Primeiro, verificar se existe QR salvo no banco com tenant isolation
    try {
      const savedSession = await WhatsAppSessionService.getSession(sessionName, tenantId);

      if (savedSession.qr && savedSession.qrExpiresAt && savedSession.qrExpiresAt > new Date()) {
        console.log(`💾 Retornando QR salvo do banco para ${sessionName}`);
        return res.json({
          qr: savedSession.qr,
          expiresAt: savedSession.qrExpiresAt,
          status: savedSession.status,
          message: "QR code retornado do banco de dados"
        });
      }
    } catch (dbError) {
      console.log(`📋 Sessão ${sessionName} não encontrada no banco ou não pertence ao tenant, verificando WAHA API...`);
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    // Verificar o provedor da sessão para rotear corretamente
    let sessionProvider: 'WAHA' | 'EVOLUTION' = 'WAHA'; // Default para WAHA (compatibilidade)
    let sessionData: any;
    try {
      sessionData = await WhatsAppSessionService.getSession(sessionName, tenantId);
      console.log(`🔍 Sessão ${sessionName} encontrada no banco:`, {
        provider: sessionData.provider,
        status: sessionData.status
      });
      sessionProvider = (sessionData.provider as 'WAHA' | 'EVOLUTION') || 'WAHA';
    } catch (error) {
      console.log(`⚠️ Sessão ${sessionName} não encontrada no banco ou não pertence ao tenant, assumindo WAHA`);
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    console.log(`🔍 Processando QR para sessão ${sessionName} via ${sessionProvider}`);

    // Se for Evolution API, usar o serviço específico
    if (sessionProvider === 'EVOLUTION') {
      try {
        const qrCodeData = await evolutionApiService.getQRCode(sessionName);
        const expiresAt = new Date(Date.now() + 300000); // 5 minutos

        // Salvar o QR code no banco de dados
        await WhatsAppSessionService.createOrUpdateSession({
          name: sessionName,
          status: 'SCAN_QR_CODE',
          provider: 'EVOLUTION',
          qr: qrCodeData,
          qrExpiresAt: expiresAt,
          tenantId: sessionData.tenantId
        });

        console.log(`💾 QR code Evolution salvo no banco para sessão ${sessionName}`);

        return res.json({
          qr: qrCodeData,
          expiresAt: expiresAt,
          status: 'SCAN_QR_CODE',
          provider: 'EVOLUTION',
          message: "QR code gerado via Evolution API"
        });
      } catch (evolutionError: any) {
        console.error(`❌ Erro ao obter QR da Evolution API:`, evolutionError);
        return res.status(500).json({
          error: 'Erro ao obter QR Code da Evolution API',
          details: evolutionError.message
        });
      }
    } else {
      // Para WAHA, manter lógica original
    let sessionStatus;
    try {
      sessionStatus = await wahaRequest(`/api/sessions/${sessionName}`);
      console.log(`🔍 Status da sessão ${sessionName}:`, sessionStatus.status);
    } catch (wahaError: any) {
      console.error(`❌ Erro ao consultar status da sessão ${sessionName} na WAHA:`, wahaError.message);
      // Se não conseguir acessar WAHA, mas temos a sessão no banco com status SCAN_QR_CODE,
      // vamos tentar gerar o QR usando apenas a URL
      if (sessionData.status === 'SCAN_QR_CODE') {
        console.log(`🔄 Tentando gerar QR com base no banco (status: ${sessionData.status})`);
        sessionStatus = { status: 'SCAN_QR_CODE' };
      } else {
        return res.status(400).json({
          error: 'Não foi possível acessar a API WAHA para verificar o status da sessão',
          details: wahaError.message
        });
      }
    }

    // Priorizar status do banco se for SCAN_QR_CODE, senão usar status da WAHA
    const effectiveStatus = sessionData.status === 'SCAN_QR_CODE' ? 'SCAN_QR_CODE' : sessionStatus.status;
    console.log(`🔄 Status efetivo para ${sessionName}: ${effectiveStatus} (banco: ${sessionData.status}, WAHA: ${sessionStatus.status})`);

    if (effectiveStatus === 'SCAN_QR_CODE') {
      // Sessão está aguardando QR code - buscar QR da WAHA API
      console.log(`📱 Buscando QR code da WAHA API para sessão ${sessionName}`);

      try {
        // Buscar configurações WAHA
        const config = await settingsService.getWahaConfig();
        const WAHA_BASE_URL = config.host || process.env.WAHA_BASE_URL || process.env.DEFAULT_WAHA_HOST || '';
        const WAHA_API_KEY = config.apiKey || process.env.WAHA_API_KEY || process.env.DEFAULT_WAHA_API_KEY || '';

        // Buscar QR como imagem e converter para base64
        const qrImageUrl = `${WAHA_BASE_URL}/api/${sessionName}/auth/qr?format=image`;
        console.log(`📱 Buscando QR image da WAHA: ${qrImageUrl}`);

        const response = await fetch(qrImageUrl, {
          headers: {
            'X-API-KEY': WAHA_API_KEY,
            'Accept': 'image/png'
          }
        });

        if (!response.ok) {
          throw new Error(`Erro ao buscar QR da WAHA: ${response.status} ${response.statusText}`);
        }

        // Converter para base64
        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const qrBase64 = `data:image/png;base64,${base64Image}`;

        console.log(`📱 QR convertido para base64, tamanho: ${qrBase64.length} caracteres`);

        const expiresAt = new Date(Date.now() + 300000); // 5 minutos

        // Salvar o QR base64 no banco de dados
        await WhatsAppSessionService.createOrUpdateSession({
          name: sessionName,
          status: 'SCAN_QR_CODE',
          provider: 'WAHA',
          qr: qrBase64,
          qrExpiresAt: expiresAt,
          tenantId: sessionData.tenantId
        });

        console.log(`💾 QR WAHA base64 salvo no banco para sessão ${sessionName}`);

        res.json({
          qr: qrBase64,
          expiresAt: expiresAt,
          status: 'SCAN_QR_CODE',
          provider: 'WAHA',
          message: "QR code obtido da WAHA API e convertido para base64"
        });

      } catch (qrError: any) {
        console.error('❌ Erro ao buscar QR da WAHA:', qrError);

        res.status(500).json({
          error: 'Erro ao obter QR Code da WAHA API',
          details: qrError.message
        });
      }

    } else if (effectiveStatus === 'WORKING') {
      console.log(`✅ Sessão ${sessionName} já está conectada`);
      res.status(400).json({
        error: 'Sessão já está conectada',
        status: effectiveStatus
      });

    } else {
      // Para outros status (FAILED, STOPPED), ainda retornar QR se existe no banco
      try {
        if (sessionData.qr && sessionData.qrExpiresAt && sessionData.qrExpiresAt > new Date()) {
          console.log(`📋 Retornando QR existente do banco para sessão ${sessionName} (status: ${effectiveStatus})`);
          return res.json({
            qr: sessionData.qr,
            expiresAt: sessionData.qrExpiresAt,
            status: effectiveStatus,
            message: "QR code retornado do banco (sessão não disponível)"
          });
        }
      } catch (dbError) {
        // Continua para gerar erro abaixo
      }

      console.log(`❌ Sessão ${sessionName} não está disponível para QR code`);
      res.status(400).json({
        error: 'Sessão não está disponível para QR code',
        status: effectiveStatus
      });
    }
    }

  } catch (error) {
    console.error('Erro ao obter QR Code da WAHA:', error);
    res.status(500).json({ error: 'Erro ao obter QR Code' });
  }
});

// Obter status da sessão
router.get('/sessions/:sessionName/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionName } = req.params;
    console.log('🔍 GET /sessions/:sessionName/status - sessionName:', sessionName, 'user:', req.user?.email, 'tenantId:', req.tenantId);

    // SUPERADMIN pode ver status de qualquer sessão, outros usuários só do seu tenant
    const tenantId = req.user?.role === 'SUPERADMIN' ? undefined : req.tenantId;

    // Verificar se a sessão pertence ao tenant
    try {
      await WhatsAppSessionService.getSession(sessionName, tenantId);
    } catch (error) {
      console.error('❌ Sessão não encontrada ou não pertence ao tenant:', error);
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    const status = await wahaRequest(`/api/sessions/${sessionName}/status`);
    res.json(status);
  } catch (error) {
    console.error('Erro ao obter status:', error);
    res.status(500).json({ error: 'Erro ao obter status da sessão' });
  }
});

// Obter informações "me" da sessão
router.get('/sessions/:sessionName/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionName } = req.params;
    console.log('👤 GET /sessions/:sessionName/me - sessionName:', sessionName, 'user:', req.user?.email, 'tenantId:', req.tenantId);

    // SUPERADMIN pode ver informações de qualquer sessão, outros usuários só do seu tenant
    const tenantId = req.user?.role === 'SUPERADMIN' ? undefined : req.tenantId;

    // Verificar se a sessão pertence ao tenant
    try {
      await WhatsAppSessionService.getSession(sessionName, tenantId);
    } catch (error) {
      console.error('❌ Sessão não encontrada ou não pertence ao tenant:', error);
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    const me = await wahaRequest(`/api/sessions/${sessionName}/me`);
    res.json(me);
  } catch (error) {
    console.error('Erro ao obter informações do usuário:', error);
    res.status(500).json({ error: 'Erro ao obter informações do usuário' });
  }
});

// Associar sessão a um tenant (SUPERADMIN only)
router.patch('/sessions/:sessionName/assign-tenant', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionName } = req.params;
    const { tenantId } = req.body;

    console.log('🔧 PATCH /sessions/:sessionName/assign-tenant - sessionName:', sessionName, 'tenantId:', tenantId, 'user:', req.user?.email);

    // Apenas SUPERADMIN pode associar sessões a tenants
    if (req.user?.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Apenas SUPERADMIN pode associar sessões a tenants' });
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId é obrigatório' });
    }

    // Buscar sessão sem filtro de tenant (SUPERADMIN vê todas)
    const session = await WhatsAppSessionService.getSession(sessionName);

    // Atualizar sessão com o novo tenantId
    await WhatsAppSessionService.createOrUpdateSession({
      name: sessionName,
      status: session.status as any,
      provider: session.provider as 'WAHA' | 'EVOLUTION',
      me: session.me ? {
        id: session.me.id,
        pushName: session.me.pushName,
        lid: session.me.lid || undefined,
        jid: session.me.jid || undefined
      } : undefined,
      qr: session.qr || undefined,
      qrExpiresAt: session.qrExpiresAt || undefined,
      tenantId
    });

    console.log(`✅ Sessão ${sessionName} associada ao tenant ${tenantId}`);
    res.json({ success: true, message: 'Sessão associada ao tenant com sucesso' });
  } catch (error) {
    console.error('Erro ao associar sessão:', error);
    res.status(500).json({ error: 'Erro ao associar sessão ao tenant' });
  }
});

export default router;