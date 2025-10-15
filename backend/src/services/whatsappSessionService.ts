import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface WhatsAppSessionData {
  name: string; // Nome real usado na API (ex: vendas_c52982e8)
  displayName?: string; // Nome exibido ao usuário (ex: vendas)
  status: 'WORKING' | 'SCAN_QR_CODE' | 'STOPPED' | 'FAILED';
  provider: 'WAHA' | 'EVOLUTION' | 'DIGITALSAC';
  config?: any;
  connectionUuid?: string; // URL completa da conexão DigitalSac
  externalKey?: string; // ExternalKey da conexão DigitalSac
  token?: string; // Token da conexão DigitalSac
  me?: {
    id: string;
    pushName: string;
    lid?: string;
    jid?: string;
  };
  qr?: string;
  qrExpiresAt?: Date;
  assignedWorker?: string;
  tenantId?: string;
}

export class WhatsAppSessionService {
  static async getAllSessions(tenantId?: string) {
    console.log('📋 WhatsAppSessionService.getAllSessions - tenantId:', tenantId);

    // Construir filtros dinâmicos
    const where: any = {};

    // Filtro por tenant (SUPERADMIN vê todos se tenantId for undefined)
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const sessions = await prisma.whatsAppSession.findMany({
      where,
      orderBy: { atualizadoEm: 'desc' }
    });

    console.log('📋 WhatsAppSessionService.getAllSessions - sessões encontradas:', sessions.length);

    return sessions.map(session => ({
      name: session.name,
      displayName: session.displayName || session.name,
      status: session.status,
      provider: session.provider as 'WAHA' | 'EVOLUTION' | 'DIGITALSAC',
      config: session.config ? JSON.parse(session.config) : {},
      connectionUuid: session.connectionUuid,
      externalKey: session.externalKey,
      token: session.token,
      me: session.meId ? {
        id: session.meId,
        pushName: session.mePushName || '',
        lid: session.meLid,
        jid: session.meJid
      } : undefined,
      qr: session.qr,
      qrExpiresAt: session.qrExpiresAt,
      assignedWorker: session.assignedWorker,
      tenantId: session.tenantId
    }));
  }

  static async getSession(name: string, tenantId?: string) {
    console.log('🔍 WhatsAppSessionService.getSession - name:', name, 'tenantId:', tenantId);

    // Construir where clause com tenant isolation
    const where: any = { name };

    // Se tenantId for fornecido, aplicar filtro de tenant
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const session = await prisma.whatsAppSession.findFirst({ where });

    if (!session) {
      throw new Error('Sessão não encontrada');
    }

    console.log('✅ WhatsAppSessionService.getSession - sessão encontrada:', session.name);

    return {
      name: session.name,
      displayName: session.displayName || session.name,
      status: session.status,
      provider: session.provider,
      config: session.config ? JSON.parse(session.config) : {},
      me: session.meId ? {
        id: session.meId,
        pushName: session.mePushName || '',
        lid: session.meLid,
        jid: session.meJid
      } : undefined,
      qr: session.qr,
      qrExpiresAt: session.qrExpiresAt,
      assignedWorker: session.assignedWorker,
      tenantId: session.tenantId
    };
  }

  static async createOrUpdateSession(data: WhatsAppSessionData) {
    console.log('💾 WhatsAppSessionService.createOrUpdateSession - data:', {
      name: data.name,
      tenantId: data.tenantId
    });

    const sessionData = {
      name: data.name,
      displayName: data.displayName || data.name,
      status: data.status,
      provider: data.provider,
      config: data.config ? JSON.stringify(data.config) : null,
      connectionUuid: data.connectionUuid || null,
      externalKey: data.externalKey || null,
      token: data.token || null,
      meId: data.me?.id || null,
      mePushName: data.me?.pushName || null,
      meLid: data.me?.lid || null,
      meJid: data.me?.jid || null,
      qr: data.qr || null,
      qrExpiresAt: data.qrExpiresAt || null,
      assignedWorker: data.assignedWorker || null,
      tenantId: data.tenantId || null
    };

    const session = await prisma.whatsAppSession.upsert({
      where: { name: data.name },
      update: {
        ...sessionData,
        atualizadoEm: new Date()
      },
      create: {
        ...sessionData,
        criadoEm: new Date(),
        atualizadoEm: new Date()
      }
    });

    return session;
  }

  static async deleteSession(name: string, tenantId?: string) {
    console.log('🗑️ WhatsAppSessionService.deleteSession - name:', name, 'tenantId:', tenantId);

    // Construir where clause com tenant isolation
    const where: any = { name };

    // Verificar se a sessão existe e pertence ao tenant (se aplicável)
    if (tenantId) {
      const session = await prisma.whatsAppSession.findFirst({
        where: { name, tenantId }
      });

      if (!session) {
        throw new Error('Sessão não encontrada ou não pertence ao tenant');
      }
    }

    await prisma.whatsAppSession.delete({
      where: { name }
    });

    console.log('✅ WhatsAppSessionService.deleteSession - sessão deletada:', name);
  }

  static async updateSessionStatus(name: string, status: string, additionalData?: Partial<WhatsAppSessionData>, tenantId?: string) {
    console.log('🔄 WhatsAppSessionService.updateSessionStatus - name:', name, 'tenantId:', tenantId);

    // Verificar se a sessão existe e pertence ao tenant (se aplicável)
    if (tenantId) {
      const session = await prisma.whatsAppSession.findFirst({
        where: { name, tenantId }
      });

      if (!session) {
        throw new Error('Sessão não encontrada ou não pertence ao tenant');
      }
    }

    const updateData: any = {
      status,
      atualizadoEm: new Date()
    };

    if (additionalData?.me) {
      updateData.meId = additionalData.me.id;
      updateData.mePushName = additionalData.me.pushName;
      updateData.meLid = additionalData.me.lid;
      updateData.meJid = additionalData.me.jid;
    }

    if (additionalData?.qr !== undefined) {
      updateData.qr = additionalData.qr;
    }

    if (additionalData?.qrExpiresAt !== undefined) {
      updateData.qrExpiresAt = additionalData.qrExpiresAt;
    }

    if (additionalData?.assignedWorker !== undefined) {
      updateData.assignedWorker = additionalData.assignedWorker;
    }

    if (additionalData?.tenantId !== undefined) {
      updateData.tenantId = additionalData.tenantId;
    }

    await prisma.whatsAppSession.update({
      where: { name },
      data: updateData
    });

    console.log('✅ WhatsAppSessionService.updateSessionStatus - status atualizado:', name);
  }
}