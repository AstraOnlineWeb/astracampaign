import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { Portal } from '../components/Portal';

type MessageContent =
  | { text: string }
  | { url: string; caption?: string }
  | { url: string; fileName?: string }
  | { sequence: Array<{ type: string; content: any }> };

interface Campaign {
  id: string;
  nome: string;
  targetTags: string[];
  sessionNames: string[];
  sessionName: string;
  messageType: string;
  messageContent: MessageContent;
  randomDelay: number;
  startImmediately: boolean;
  scheduledFor: string | null;
  status: string;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  criadoEm: string;
  session: {
    name: string;
    displayName?: string;
    status: string;
    mePushName: string | null;
  };
  _count: {
    messages: number;
  };
}

interface WhatsAppSession {
  name: string; // Nome real usado na API
  displayName?: string; // Nome exibido ao usuário
  mePushName: string | null;
  meId: string | null;
}

interface ContactTag {
  id: string;
  nome: string;
}

export function CampaignsPage() {
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [currentReportCampaignId, setCurrentReportCampaignId] = useState<string | null>(null);
  const [reportCurrentPage, setReportCurrentPage] = useState(1);
  const [reportItemsPerPage] = useState(8);

  const [contactTags, setContactTags] = useState<ContactTag[]>([]);
  const [whatsappSessions, setWhatsappSessions] = useState<WhatsAppSession[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: boolean }>({});
  const [fileInfos, setFileInfos] = useState<{ [key: string]: { name: string, size: number, type: string } }>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    nome: '',
    targetTags: [] as string[],
    sessionNames: [] as string[],
    sessionName: '',
    messageType: 'sequence',
    messageContent: { sequence: [] as Array<{ type: string; content: any }> } as MessageContent,
    randomDelay: 30,
    startImmediately: true,
    scheduledFor: ''
  });

  useEffect(() => {
    loadCampaigns();
    loadContactTags();
    loadWhatsAppSessions();
  }, []);

  // Helper para fazer requisições autenticadas
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/campaigns');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      toast.error(t('campaigns.validation.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const loadContactTags = async () => {
    try {
      const response = await authenticatedFetch('/api/campaigns/tags');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const tags = await response.json();
      setContactTags(tags);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  const loadWhatsAppSessions = async () => {
    try {
      const response = await authenticatedFetch('/api/campaigns/sessions');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const sessions = await response.json();
      setWhatsappSessions(sessions);
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    }
  };

  const handleTagToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      targetTags: prev.targetTags.includes(tag)
        ? prev.targetTags.filter(t => t !== tag)
        : [...prev.targetTags, tag]
    }));
  };

  const handleSessionToggle = (sessionName: string) => {
    setFormData(prev => ({
      ...prev,
      sessionNames: prev.sessionNames.includes(sessionName)
        ? prev.sessionNames.filter(s => s !== sessionName)
        : [...prev.sessionNames, sessionName]
    }));
  };

  const handleSelectAllTags = () => {
    setFormData(prev => ({
      ...prev,
      targetTags: prev.targetTags.length === contactTags.length
        ? []
        : contactTags.map(tag => tag.id)
    }));
  };

  const handleSelectAllSessions = () => {
    setFormData(prev => ({
      ...prev,
      sessionNames: prev.sessionNames.length === whatsappSessions.length
        ? []
        : whatsappSessions.map(session => session.name)
    }));
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.targetTags.length === 0) {
      toast.error(t('campaigns.validation.checkCategory'));
      return;
    }

    if (formData.sessionNames.length === 0) {
      toast.error(t('campaigns.validation.checkConnection'));
      return;
    }

    if (!('sequence' in formData.messageContent) || formData.messageContent.sequence.length === 0) {
      toast.error(t('campaigns.validation.addMessageError'));
      return;
    }

    try {
      const sequence = formData.messageContent.sequence;
      const isSequence = sequence.length > 1;

      let finalMessageType: string;
      let finalMessageContent: any;

      if (isSequence) {
        finalMessageType = 'sequence';
        finalMessageContent = { sequence };
      } else {
        const singleMessage = sequence[0];
        finalMessageType = singleMessage.type;
        finalMessageContent = singleMessage.content;
      }

      // Converter scheduledFor de datetime-local para ISO string
      let scheduledForISO = null;
      if (!formData.startImmediately && formData.scheduledFor) {
        // datetime-local retorna formato "YYYY-MM-DDTHH:mm" SEM timezone
        // Precisamos interpretar como horário LOCAL do usuário e converter para UTC
        // Exemplo: usuário escolhe 2025-10-15T19:00 em UTC-3 (Brasília)
        // Isso deve ser salvo como 2025-10-15T22:00:00.000Z (19:00 - 3 = 22:00 UTC)
        const localDateStr = formData.scheduledFor; // "2025-10-15T19:00"
        const localDate = new Date(localDateStr); // JavaScript interpreta como LOCAL
        scheduledForISO = localDate.toISOString(); // Converte para UTC com timezone
      }

      const campaignData = {
        ...formData,
        messageType: finalMessageType,
        messageContent: finalMessageContent,
        scheduledFor: scheduledForISO
      };

      const response = await authenticatedFetch('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(campaignData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.errors && errorData.errors.length > 0) {
          const validationErrors = errorData.errors.map((err: any) => err.msg).join(', ');
          throw new Error(validationErrors);
        } else if (errorData.error) {
          throw new Error(errorData.error);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      }

      toast.success(t('campaigns.messages.created'));
      setShowCreateModal(false);
      resetForm();
      loadCampaigns();
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar campanha');
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      targetTags: [],
      sessionNames: [],
      sessionName: '',
      messageType: 'sequence',
      messageContent: { sequence: [] },
      randomDelay: 30,
      startImmediately: true,
      scheduledFor: ''
    });
    setUploadingFiles({});
    setFileInfos({});
    setDraggedIndex(null);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
    const newSequence = [...currentSequence];
    const [draggedItem] = newSequence.splice(draggedIndex, 1);
    newSequence.splice(dropIndex, 0, draggedItem);

    setFormData(prev => ({
      ...prev,
      messageContent: { sequence: newSequence }
    }));
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleFileUpload = async (file: File, messageIndex: number, variationIndex?: number) => {
    const uploadKey = variationIndex !== undefined ? `${messageIndex}-${variationIndex}` : messageIndex.toString();
    setUploadingFiles(prev => ({ ...prev, [uploadKey]: true }));

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: uploadFormData,
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao fazer upload do arquivo');
      }

      const data = await response.json();

      // Armazenar informações do arquivo
      if (variationIndex !== undefined) {
        setFileInfos(prev => ({
          ...prev,
          [`${messageIndex}-${variationIndex}`]: {
            name: data.originalName,
            size: data.size,
            type: data.mimetype
          }
        }));
      } else {
        setFileInfos(prev => ({
          ...prev,
          [messageIndex]: {
            name: data.originalName,
            size: data.size,
            type: data.mimetype
          }
        }));
      }

      const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];

      if (variationIndex !== undefined) {
        // Upload para variação
        const newSequence = currentSequence.map((seqItem, i) => {
          if (i === messageIndex) {
            const mediaVariations = [...(seqItem.content.mediaVariations || [])];
            // Garantir que o array tenha o tamanho necessário
            while (mediaVariations.length <= variationIndex) {
              mediaVariations.push({ url: '', caption: '', fileName: '' });
            }
            mediaVariations[variationIndex] = {
              ...mediaVariations[variationIndex],
              url: data.fileUrl,
              fileName: data.originalName
            };
            return {
              ...seqItem,
              content: { ...seqItem.content, mediaVariations }
            };
          }
          return seqItem;
        });

        setFormData(prev => ({
          ...prev,
          messageContent: { sequence: newSequence }
        }));
      } else {
        // Upload para modo single
        const newSequence = currentSequence.map((seqItem, i) =>
          i === messageIndex ? {
            ...seqItem,
            content: { ...seqItem.content, url: data.fileUrl }
          } : seqItem
        );

        setFormData(prev => ({
          ...prev,
          messageContent: { sequence: newSequence }
        }));
      }

      toast.success(t('common.success'));
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error(error instanceof Error ? error.message : t('campaigns.validation.uploadError'));
    } finally {
      setUploadingFiles(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const handleRemoveFile = (messageIndex: number) => {
    const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
    const newSequence = currentSequence.map((seqItem, i) =>
      i === messageIndex ? {
        ...seqItem,
        content: { ...seqItem.content, url: '' }
      } : seqItem
    );

    setFormData(prev => ({
      ...prev,
      messageContent: { sequence: newSequence }
    }));

    setFileInfos(prev => {
      const updated = { ...prev };
      delete updated[messageIndex];
      return updated;
    });

    toast.success(t('common.success'));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    return '📄';
  };

  const handleToggleCampaign = async (campaignId: string, action: 'pause' | 'resume') => {
    try {
      const response = await authenticatedFetch(`/api/campaigns/${campaignId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      toast.success(action === 'pause' ? t('campaigns.messages.paused') : t('campaigns.messages.resumed'));
      loadCampaigns();
    } catch (error) {
      console.error('Erro ao alterar status da campanha:', error);
      toast.error('Erro ao alterar status da campanha');
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm(t('campaigns.messages.deleteConfirm'))) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      toast.success(t('campaigns.messages.deleted'));
      loadCampaigns();
    } catch (error) {
      console.error('Erro ao excluir campanha:', error);
      toast.error('Erro ao excluir campanha');
    }
  };

  const handleViewReport = async (campaignId: string) => {
    setCurrentReportCampaignId(campaignId);
    setReportCurrentPage(1);
    setReportLoading(true);
    setShowReportModal(true);

    try {
      const response = await authenticatedFetch(`/api/campaigns/${campaignId}/report`);

      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao carregar relatório');
        setShowReportModal(false);
      }
    } catch (error) {
      console.error('Erro ao buscar relatório:', error);
      toast.error('Erro ao carregar relatório');
      setShowReportModal(false);
    } finally {
      setReportLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 text-gray-800';
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
        return t('campaigns.status.pending');
      case 'RUNNING':
        return t('campaigns.status.running');
      case 'COMPLETED':
        return t('campaigns.status.completed');
      case 'PAUSED':
        return t('campaigns.status.paused');
      case 'FAILED':
        return t('campaigns.status.failed');
      default:
        return status;
    }
  };

  const handleRefreshReport = async () => {
    if (!currentReportCampaignId) return;

    setReportLoading(true);
    try {
      const response = await authenticatedFetch(`/api/campaigns/${currentReportCampaignId}/report`);

      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || t('campaigns.validation.loadReportError'));
      }
    } catch (error) {
      console.error('Erro ao buscar relatório:', error);
      toast.error(t('campaigns.validation.loadReportError'));
    } finally {
      setReportLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!currentReportCampaignId || !reportData) return;

    try {
      const response = await authenticatedFetch(`/api/campaigns/${currentReportCampaignId}/report/download`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `relatorio-campanha-${reportData.campaign.nome}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(t('common.success'));
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || t('campaigns.validation.downloadError'));
      }
    } catch (error) {
      console.error('Erro ao baixar relatório:', error);
      toast.error(t('campaigns.validation.downloadError'));
    }
  };

  const getErrorIcon = (errorMessage: string) => {
    if (!errorMessage || errorMessage === 'N/A') return null;

    const error = errorMessage.toLowerCase();

    if (error.includes('network') || error.includes('connection') || error.includes('timeout')) {
      return {
        icon: '🌐',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        category: 'Conectividade'
      };
    }

    if (error.includes('blocked') || error.includes('banned') || error.includes('spam')) {
      return {
        icon: '🚫',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        category: 'Bloqueio'
      };
    }

    if (error.includes('rate limit') || error.includes('quota') || error.includes('limit')) {
      return {
        icon: '⏰',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        category: 'Rate Limit'
      };
    }

    if (error.includes('invalid') || error.includes('not found') || error.includes('number')) {
      return {
        icon: '📱',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        category: 'Número Inválido'
      };
    }

    if (error.includes('permission') || error.includes('unauthorized') || error.includes('forbidden')) {
      return {
        icon: '🔒',
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        category: 'Permissão'
      };
    }

    if (error.includes('session') || error.includes('disconnected') || error.includes('logout')) {
      return {
        icon: '📲',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-100',
        category: 'Sessão'
      };
    }

    if (error.includes('media') || error.includes('file') || error.includes('download')) {
      return {
        icon: '📁',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        category: 'Mídia'
      };
    }

    // Erro genérico
    return {
      icon: '⚠️',
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      category: 'Erro Geral'
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">{t('common.loading')}...</span>
      </div>
    );
  }

  return (
    <>
      <Header
        title={t('campaigns.list.title')}
        subtitle={t('campaigns.list.subtitle', { count: campaigns.length })}
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            {t('campaigns.list.newCampaign')}
          </button>
        }
      />

      <div className="p-6 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{t('campaigns.list.created')}</h3>
          </div>

          {campaigns.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {t('campaigns.list.empty')}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="px-6 py-3 h-[60px] flex items-center">
                  <div className="flex items-center justify-between w-full">
                    {/* Nome e Status */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{campaign.nome}</h4>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                        {getStatusText(campaign.status)}
                      </span>
                    </div>

                    {/* Informações essenciais */}
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{t('campaigns.list.stats.contacts')}</span>
                        <span>{campaign.totalContacts}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{t('campaigns.list.stats.sent')}</span>
                        <span>{campaign.sentCount}/{campaign.totalContacts}</span>
                      </div>

                      {/* Sessões ativas (apenas ícones) */}
                      {campaign.sessionNames && campaign.sessionNames.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">{t('campaigns.list.stats.sessions')}</span>
                          <div className="flex gap-1">
                            {campaign.sessionNames.slice(0, 3).map((sessionName, index) => (
                              <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                {sessionName.substring(0, 3)}
                              </span>
                            ))}
                            {campaign.sessionNames.length > 3 && (
                              <span className="text-xs text-gray-500">+{campaign.sessionNames.length - 3}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botões de ação */}
                    <div className="flex gap-1 ml-4">
                      <button
                        onClick={() => handleViewReport(campaign.id)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        title="Ver relatório da campanha"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                        </svg>
                      </button>
                      {campaign.status === 'RUNNING' && (
                        <button
                          onClick={() => handleToggleCampaign(campaign.id, 'pause')}
                          className="px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                          title="Pausar campanha"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                      {campaign.status === 'PAUSED' && (
                        <button
                          onClick={() => handleToggleCampaign(campaign.id, 'resume')}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          title="Retomar campanha"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                      {campaign.status !== 'RUNNING' && (
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          title={t('campaigns.list.actions.delete')}
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal de Criação */}
        {showCreateModal && (
          <Portal>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
              <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{t('campaigns.create.title')}</h3>
                    <p className="text-sm text-gray-600 mt-1">{t('campaigns.create.subtitle')}</p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleCreateCampaign} className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* COLUNA ESQUERDA - Informações Básicas */}
                    <div className="space-y-6">
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h4 className="text-lg font-semibold text-blue-900 mb-2">{t('campaigns.create.sections.basicInfo')}</h4>
                        <p className="text-sm text-blue-700">{t('campaigns.create.sections.basicInfoDesc')}</p>
                      </div>

                      {/* Nome da Campanha */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('campaigns.create.fields.name')}
                        </label>
                        <input
                          type="text"
                          value={formData.nome}
                          onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={t('campaigns.create.fields.namePlaceholder')}
                          required
                        />
                      </div>

                      {/* Categorias de Contatos */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            {t('campaigns.create.fields.targetTags')}
                          </label>
                          {contactTags.length > 0 && (
                            <button
                              type="button"
                              onClick={handleSelectAllTags}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                            >
                              {formData.targetTags.length === contactTags.length ? t('campaigns.create.fields.deselectAll') : t('campaigns.create.fields.selectAll')}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-3">{t('campaigns.create.fields.targetTagsDesc')}</p>
                        <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                          {contactTags.map((tag) => (
                            <label key={tag.id} className="flex items-center space-x-2 mb-2 p-2 rounded hover:bg-white cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.targetTags.includes(tag.id)}
                                onChange={() => handleTagToggle(tag.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700 font-medium">{tag.nome}</span>
                            </label>
                          ))}
                          {contactTags.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">{t('campaigns.create.fields.noTags')}</p>
                          )}
                        </div>
                        {formData.targetTags.length > 0 && (
                          <p className="text-xs text-green-600 mt-2">{t('campaigns.create.fields.selectedTags', { count: formData.targetTags.length })}</p>
                        )}
                      </div>

                      {/* Conexões WhatsApp */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            {t('campaigns.create.fields.whatsappConnections')} ({formData.sessionNames.length} {t('common.selected', { count: formData.sessionNames.length })})
                          </label>
                          {whatsappSessions.length > 0 && (
                            <button
                              type="button"
                              onClick={handleSelectAllSessions}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                            >
                              {formData.sessionNames.length === whatsappSessions.length ? t('campaigns.create.fields.deselectAll') : t('campaigns.create.fields.selectAll')}
                            </button>
                          )}
                        </div>
                        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div>
                              <h4 className="text-sm font-medium text-green-800">{t('campaigns.create.fields.multiSessionTitle')}</h4>
                              <p className="text-sm text-green-700 mt-1">
                                {t('campaigns.create.fields.multiSessionDesc')}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                          {whatsappSessions.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">{t('campaigns.create.fields.noConnections')}</p>
                          ) : (
                            whatsappSessions.map((session) => (
                              <label key={session.name} className="flex items-center justify-between space-x-2 mb-2 p-2 rounded hover:bg-white cursor-pointer">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={formData.sessionNames.includes(session.name)}
                                    onChange={() => handleSessionToggle(session.name)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">
                                      {session.mePushName || session.displayName || session.name}
                                    </span>
                                    <span className="text-xs text-gray-500 block">({session.displayName || session.name})</span>
                                  </div>
                                </div>
                                <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                                  {t('users.form.active')}
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                        {formData.sessionNames.length > 0 && (
                          <p className="text-xs text-green-600 mt-2">{t('campaigns.create.fields.selectedConnections', { count: formData.sessionNames.length })}</p>
                        )}
                      </div>

                      {/* Configuração de Envio */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('campaigns.create.fields.randomDelay')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="300"
                          value={formData.randomDelay}
                          onChange={(e) => setFormData(prev => ({ ...prev, randomDelay: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {t('campaigns.create.fields.randomDelayDesc', { seconds: formData.randomDelay })}
                        </p>
                      </div>

                      {/* Data de Envio */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('campaigns.create.fields.schedule')}
                        </label>
                        <div className="space-y-3">
                          <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="radio"
                              checked={formData.startImmediately}
                              onChange={() => setFormData(prev => ({ ...prev, startImmediately: true }))}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-700">{t('campaigns.create.fields.startImmediately')}</span>
                              <p className="text-xs text-gray-500">{t('campaigns.create.fields.startImmediatelyDesc')}</p>
                            </div>
                          </label>
                          <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="radio"
                              checked={!formData.startImmediately}
                              onChange={() => setFormData(prev => ({ ...prev, startImmediately: false }))}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-700">{t('campaigns.create.fields.scheduleFor')}</span>
                              <p className="text-xs text-gray-500">{t('campaigns.create.fields.scheduleForDesc')}</p>
                            </div>
                          </label>
                          {!formData.startImmediately && (
                            <input
                              type="datetime-local"
                              value={formData.scheduledFor}
                              onChange={(e) => setFormData(prev => ({ ...prev, scheduledFor: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ml-6"
                              required={!formData.startImmediately}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* COLUNA DIREITA - Mensagens */}
                    <div className="space-y-6">
                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <h4 className="text-lg font-semibold text-purple-900 mb-2">{t('campaigns.create.sections.messages')}</h4>
                        <p className="text-sm text-purple-700">{t('campaigns.create.sections.messagesDesc')}</p>
                      </div>

                      <div>
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-blue-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div>
                              <h4 className="text-sm font-medium text-blue-800">{t('campaigns.messages.dynamicVariables')}</h4>
                              <p className="text-sm text-blue-700 mt-1">
                                {t('campaigns.messages.dynamicVariablesDesc')}
                                <span className="block mt-1">
                                  <code className="bg-blue-100 px-1 rounded mx-1">{'{{nome}}'}</code>
                                  <code className="bg-blue-100 px-1 rounded mx-1">{'{{telefone}}'}</code>
                                  <code className="bg-blue-100 px-1 rounded mx-1">{'{{email}}'}</code>
                                  <code className="bg-blue-100 px-1 rounded mx-1">{'{{categoria}}'}</code>
                                  <code className="bg-blue-100 px-1 rounded mx-1">{'{{observacoes}}'}</code>
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-600">{t('campaigns.messages.addMessageHelp')}</p>
                            <button
                              type="button"
                              onClick={() => {
                                const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                const newSequence = [...currentSequence, { type: 'text', content: { text: '' } }];
                                setFormData(prev => ({
                                  ...prev,
                                  messageContent: { sequence: newSequence }
                                }));
                              }}
                              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center gap-2"
                            >
                              <span className="text-lg">+</span>
                              {t('campaigns.messages.addMessage')}
                            </button>
                          </div>

                          <div className="space-y-3">
                            {('sequence' in formData.messageContent) && formData.messageContent.sequence.map((item, index) => (
                              <div
                                key={index}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e)}
                                onDrop={(e) => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`border rounded-lg p-4 transition-all cursor-move ${draggedIndex === index
                                  ? 'border-blue-500 bg-blue-50 opacity-50'
                                  : draggedIndex !== null
                                    ? 'border-gray-300 bg-gray-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                  }`}
                              >
                                <div className="flex justify-between items-center mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400 cursor-move text-xl">⋮⋮</span>
                                    <span className="text-sm font-medium text-gray-600">{t('campaigns.messages.messageLabel', { index: index + 1 })}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                      const newSequence = currentSequence.filter((_, i) => i !== index);
                                      setFormData(prev => ({
                                        ...prev,
                                        messageContent: { sequence: newSequence }
                                      }));
                                    }}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    {t('campaigns.messages.remove')}
                                  </button>
                                </div>

                                <div className="space-y-3">
                                  <select
                                    value={item.type}
                                    onChange={(e) => {
                                      const newType = e.target.value;
                                      let newContent;
                                      switch (newType) {
                                        case 'text':
                                          newContent = { text: '' };
                                          break;
                                        case 'document':
                                          newContent = { url: '', fileName: '' };
                                          break;
                                        case 'openai':
                                          newContent = { model: '', system: '', user: '' };
                                          break;
                                        case 'groq':
                                          newContent = { model: '', system: '', user: '' };
                                          break;
                                        case 'wait':
                                          newContent = { waitTime: 30 };
                                          break;
                                        default:
                                          newContent = { url: '', caption: '' };
                                          break;
                                      }

                                      const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                      const newSequence = currentSequence.map((seqItem, i) =>
                                        i === index ? { type: newType, content: newContent } : seqItem
                                      );
                                      setFormData(prev => ({
                                        ...prev,
                                        messageContent: { sequence: newSequence }
                                      }));
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="text">{t('campaigns.messages.type.text')}</option>
                                    <option value="image">{t('campaigns.messages.type.image')}</option>
                                    <option value="video">{t('campaigns.messages.type.video')}</option>
                                    <option value="audio">{t('campaigns.messages.type.audio')}</option>
                                    <option value="document">{t('campaigns.messages.type.document')}</option>
                                    <option value="openai">{t('campaigns.messages.type.openai')}</option>
                                    <option value="groq">{t('campaigns.messages.type.groq')}</option>
                                    <option value="wait">{t('campaigns.messages.type.wait')}</option>
                                  </select>

                                  {item.type === 'text' && (
                                    <div className="space-y-2">
                                      {/* Checkbox para usar variações */}
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={`useVariations-${index}`}
                                          checked={item.content.useVariations || false}
                                          onChange={(e) => {
                                            const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                            const newSequence = currentSequence.map((seqItem, i) =>
                                              i === index ? {
                                                ...seqItem,
                                                content: {
                                                  ...seqItem.content,
                                                  useVariations: e.target.checked,
                                                  variations: e.target.checked ? [''] : undefined,
                                                  text: e.target.checked ? undefined : seqItem.content.text
                                                }
                                              } : seqItem
                                            );
                                            setFormData(prev => ({
                                              ...prev,
                                              messageContent: { sequence: newSequence }
                                            }));
                                          }}
                                          className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <label htmlFor={`useVariations-${index}`} className="text-sm font-medium text-gray-700">
                                          {t('campaigns.messages.text.useVariations')}
                                        </label>
                                      </div>

                                      {item.content.useVariations ? (
                                        /* Modo variações */
                                        <div className="space-y-2">
                                          <label className="block text-sm font-medium text-gray-700">
                                            {t('campaigns.messages.text.variationsLabel')}
                                          </label>
                                          {(item.content.variations || ['']).map((variation: string, varIndex: number) => (
                                            <div key={varIndex} className="flex gap-2">
                                              <div className="flex-1">
                                                <textarea
                                                  placeholder={t('campaigns.messages.text.variationPlaceholder', { index: varIndex + 1, variables: '{{nome}}, {{email}}, {{telefone}}, {{categoria}}, {{observacoes}}' })}
                                                  value={variation}
                                                  onChange={(e) => {
                                                    const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                                    const newSequence = currentSequence.map((seqItem, i) => {
                                                      if (i === index) {
                                                        const newVariations = [...(seqItem.content.variations || [])];
                                                        newVariations[varIndex] = e.target.value;
                                                        return {
                                                          ...seqItem,
                                                          content: { ...seqItem.content, variations: newVariations }
                                                        };
                                                      }
                                                      return seqItem;
                                                    });
                                                    setFormData(prev => ({
                                                      ...prev,
                                                      messageContent: { sequence: newSequence }
                                                    }));
                                                  }}
                                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                  rows={2}
                                                />
                                              </div>
                                              {(item.content.variations || []).length > 1 && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                                    const newSequence = currentSequence.map((seqItem, i) => {
                                                      if (i === index) {
                                                        const newVariations = [...(seqItem.content.variations || [])];
                                                        newVariations.splice(varIndex, 1);
                                                        return {
                                                          ...seqItem,
                                                          content: { ...seqItem.content, variations: newVariations }
                                                        };
                                                      }
                                                      return seqItem;
                                                    });
                                                    setFormData(prev => ({
                                                      ...prev,
                                                      messageContent: { sequence: newSequence }
                                                    }));
                                                  }}
                                                  className="px-2 py-1 text-red-600 hover:text-red-800"
                                                  title="Remover variação"
                                                >
                                                  ✕
                                                </button>
                                              )}
                                            </div>
                                          ))}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                              const newSequence = currentSequence.map((seqItem, i) => {
                                                if (i === index) {
                                                  const newVariations = [...(seqItem.content.variations || []), ''];
                                                  return {
                                                    ...seqItem,
                                                    content: { ...seqItem.content, variations: newVariations }
                                                  };
                                                }
                                                return seqItem;
                                              });
                                              setFormData(prev => ({
                                                ...prev,
                                                messageContent: { sequence: newSequence }
                                              }));
                                            }}
                                            className="px-3 py-1 bg-blue-100 text-blue-600 text-sm rounded hover:bg-blue-200 flex items-center gap-1"
                                          >
                                            <span>+</span>
                                            {t('campaigns.messages.text.newVariation')}
                                          </button>
                                        </div>
                                      ) : (
                                        /* Modo texto único */
                                        <div>
                                          <textarea
                                            placeholder={t('campaigns.messages.text.textPlaceholder', { variables: '{{nome}}, {{email}}, {{telefone}}, {{categoria}}, {{observacoes}}' })}
                                            value={item.content.text || ''}
                                            onChange={(e) => {
                                              const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                              const newSequence = currentSequence.map((seqItem, i) =>
                                                i === index ? { ...seqItem, content: { text: e.target.value } } : seqItem
                                              );
                                              setFormData(prev => ({
                                                ...prev,
                                                messageContent: { sequence: newSequence }
                                              }));
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={3}
                                          />
                                        </div>
                                      )}

                                      <div className="flex flex-wrap gap-1">
                                        <span className="text-xs text-gray-500">{t('campaigns.messages.text.availableVariables')}</span>
                                        {['{{nome}}', '{{email}}', '{{telefone}}', '{{categoria}}', '{{observacoes}}'].map((variable) => (
                                          <button
                                            key={variable}
                                            type="button"
                                            onClick={() => {
                                              const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                              if (item.content.useVariations) {
                                                // Adicionar à primeira variação vazia ou criar nova
                                                const variations = item.content.variations || [''];
                                                let targetIndex = variations.findIndex((v: string) => !v.trim());
                                                if (targetIndex === -1) targetIndex = 0;

                                                const newSequence = currentSequence.map((seqItem, i) => {
                                                  if (i === index) {
                                                    const newVariations = [...variations];
                                                    newVariations[targetIndex] = (newVariations[targetIndex] || '') + variable;
                                                    return {
                                                      ...seqItem,
                                                      content: { ...seqItem.content, variations: newVariations }
                                                    };
                                                  }
                                                  return seqItem;
                                                });
                                                setFormData(prev => ({
                                                  ...prev,
                                                  messageContent: { sequence: newSequence }
                                                }));
                                              } else {
                                                // Adicionar ao texto único
                                                const currentText = currentSequence[index]?.content?.text || '';
                                                const newSequence = currentSequence.map((seqItem, i) =>
                                                  i === index ? { ...seqItem, content: { text: currentText + variable } } : seqItem
                                                );
                                                setFormData(prev => ({
                                                  ...prev,
                                                  messageContent: { sequence: newSequence }
                                                }));
                                              }
                                            }}
                                            className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded hover:bg-blue-200"
                                          >
                                            {variable}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {item.type === 'openai' && (
                                    <div className="space-y-4">
                                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-blue-600 font-medium">{t('campaigns.messages.ai.openaiTitle')}</span>
                                        </div>
                                        <p className="text-sm text-blue-600">
                                          {t('campaigns.messages.ai.openaiDesc')}
                                        </p>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          {t('campaigns.messages.ai.model')}
                                        </label>
                                        <input
                                          type="text"
                                          placeholder={t('campaigns.messages.ai.modelPlaceholder')}
                                          value={item.content.model || ''}
                                          onChange={(e) => {
                                            const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                            const newSequence = currentSequence.map((seqItem, i) =>
                                              i === index ? {
                                                ...seqItem,
                                                content: { ...seqItem.content, model: e.target.value }
                                              } : seqItem
                                            );
                                            setFormData(prev => ({
                                              ...prev,
                                              messageContent: { sequence: newSequence }
                                            }));
                                          }}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <div className="mt-2">
                                          <p className="text-xs text-gray-500 mb-1">{t('campaigns.messages.ai.suggestedModels')}</p>
                                          <div className="flex flex-wrap gap-1">
                                            {['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'].map((model) => (
                                              <button
                                                key={model}
                                                type="button"
                                                onClick={() => {
                                                  const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                                  const newSequence = currentSequence.map((seqItem, i) =>
                                                    i === index ? {
                                                      ...seqItem,
                                                      content: { ...seqItem.content, model: model }
                                                    } : seqItem
                                                  );
                                                  setFormData(prev => ({
                                                    ...prev,
                                                    messageContent: { sequence: newSequence }
                                                  }));
                                                }}
                                                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 border border-gray-300"
                                              >
                                                {model}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          {t('campaigns.messages.ai.systemPrompt')}
                                        </label>
                                        <textarea
                                          placeholder={t('campaigns.messages.ai.systemPromptPlaceholder')}
                                          value={item.content.system || ''}
                                          onChange={(e) => {
                                            const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                            const newSequence = currentSequence.map((seqItem, i) =>
                                              i === index ? {
                                                ...seqItem,
                                                content: { ...seqItem.content, system: e.target.value }
                                              } : seqItem
                                            );
                                            setFormData(prev => ({
                                              ...prev,
                                              messageContent: { sequence: newSequence }
                                            }));
                                          }}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          rows={3}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                          {t('campaigns.messages.ai.systemPromptDesc')}
                                        </p>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          {t('campaigns.messages.ai.userPrompt')}
                                        </label>
                                        <textarea
                                          placeholder={t('campaigns.messages.ai.userPromptPlaceholder', { nome: '{{nome}}', categoria: '{{categoria}}' })}
                                          value={item.content.user || ''}
                                          onChange={(e) => {
                                            const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                            const newSequence = currentSequence.map((seqItem, i) =>
                                              i === index ? {
                                                ...seqItem,
                                                content: { ...seqItem.content, user: e.target.value }
                                              } : seqItem
                                            );
                                            setFormData(prev => ({
                                              ...prev,
                                              messageContent: { sequence: newSequence }
                                            }));
                                          }}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          rows={4}
                                        />
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          <span className="text-xs text-gray-500">{t('campaigns.messages.text.availableVariables')}</span>
                                          {['{{nome}}', '{{email}}', '{{telefone}}', '{{categoria}}', '{{observacoes}}'].map((variable) => (
                                            <button
                                              key={variable}
                                              type="button"
                                              onClick={() => {
                                                const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                                const currentUser = currentSequence[index]?.content?.user || '';
                                                const newSequence = currentSequence.map((seqItem, i) =>
                                                  i === index ? {
                                                    ...seqItem,
                                                    content: { ...seqItem.content, user: currentUser + variable }
                                                  } : seqItem
                                                );
                                                setFormData(prev => ({
                                                  ...prev,
                                                  messageContent: { sequence: newSequence }
                                                }));
                                              }}
                                              className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded hover:bg-green-200"
                                            >
                                              {variable}
                                            </button>
                                          ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                          {t('campaigns.messages.ai.userPromptDesc')}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {item.type === 'groq' && (
                                    <div className="space-y-4">
                                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-yellow-600 font-medium">{t('campaigns.messages.ai.groqTitle')}</span>
                                        </div>
                                        <p className="text-sm text-yellow-600">
                                          {t('campaigns.messages.ai.groqDesc')}
                                        </p>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          {t('campaigns.messages.ai.model')}
                                        </label>
                                        <input
                                          type="text"
                                          placeholder={t('campaigns.messages.ai.modelPlaceholder')}
                                          value={item.content.model || ''}
                                          onChange={(e) => {
                                            const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                            const newSequence = currentSequence.map((seqItem, i) =>
                                              i === index ? {
                                                ...seqItem,
                                                content: { ...seqItem.content, model: e.target.value }
                                              } : seqItem
                                            );
                                            setFormData(prev => ({
                                              ...prev,
                                              messageContent: { sequence: newSequence }
                                            }));
                                          }}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <div className="mt-2">
                                          <p className="text-xs text-gray-500 mb-1">{t('campaigns.messages.ai.suggestedModels')}</p>
                                          <div className="flex flex-wrap gap-1">
                                            {['llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'llama-3.2-11b-text-preview', 'mixtral-8x7b-32768', 'gemma2-9b-it'].map((model) => (
                                              <button
                                                key={model}
                                                type="button"
                                                onClick={() => {
                                                  const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                                  const newSequence = currentSequence.map((seqItem, i) =>
                                                    i === index ? {
                                                      ...seqItem,
                                                      content: { ...seqItem.content, model: model }
                                                    } : seqItem
                                                  );
                                                  setFormData(prev => ({
                                                    ...prev,
                                                    messageContent: { sequence: newSequence }
                                                  }));
                                                }}
                                                className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded hover:bg-yellow-200 border border-yellow-300"
                                              >
                                                {model}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          {t('campaigns.messages.ai.systemPrompt')}
                                        </label>
                                        <textarea
                                          placeholder={t('campaigns.messages.ai.systemPromptPlaceholder')}
                                          value={item.content.system || ''}
                                          onChange={(e) => {
                                            const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                            const newSequence = currentSequence.map((seqItem, i) =>
                                              i === index ? {
                                                ...seqItem,
                                                content: { ...seqItem.content, system: e.target.value }
                                              } : seqItem
                                            );
                                            setFormData(prev => ({
                                              ...prev,
                                              messageContent: { sequence: newSequence }
                                            }));
                                          }}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          rows={3}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                          {t('campaigns.messages.ai.systemPromptDesc')}
                                        </p>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          {t('campaigns.messages.ai.userPrompt')}
                                        </label>
                                        <textarea
                                          placeholder={t('campaigns.messages.ai.userPromptPlaceholder', { nome: '{{nome}}', categoria: '{{categoria}}' })}
                                          value={item.content.user || ''}
                                          onChange={(e) => {
                                            const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                            const newSequence = currentSequence.map((seqItem, i) =>
                                              i === index ? {
                                                ...seqItem,
                                                content: { ...seqItem.content, user: e.target.value }
                                              } : seqItem
                                            );
                                            setFormData(prev => ({
                                              ...prev,
                                              messageContent: { sequence: newSequence }
                                            }));
                                          }}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          rows={4}
                                        />
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          <span className="text-xs text-gray-500">{t('campaigns.messages.text.availableVariables')}</span>
                                          {['{{nome}}', '{{email}}', '{{telefone}}', '{{categoria}}', '{{observacoes}}'].map((variable) => (
                                            <button
                                              key={variable}
                                              type="button"
                                              onClick={() => {
                                                const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                                const currentUser = currentSequence[index]?.content?.user || '';
                                                const newSequence = currentSequence.map((seqItem, i) =>
                                                  i === index ? {
                                                    ...seqItem,
                                                    content: { ...seqItem.content, user: currentUser + variable }
                                                  } : seqItem
                                                );
                                                setFormData(prev => ({
                                                  ...prev,
                                                  messageContent: { sequence: newSequence }
                                                }));
                                              }}
                                              className="px-2 py-1 bg-orange-100 text-orange-600 text-xs rounded hover:bg-orange-200"
                                            >
                                              {variable}
                                            </button>
                                          ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                          {t('campaigns.messages.ai.userPromptDesc')}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {['image', 'video', 'audio', 'document'].includes(item.type) && (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <label className="block text-sm font-medium text-gray-700">
                                          {t('campaigns.messages.file.label')}
                                        </label>
                                        <label className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={item.content.useMediaVariations || false}
                                            onChange={(e) => {
                                              const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                              const newSequence = currentSequence.map((seqItem, i) => {
                                                if (i === index) {
                                                  return {
                                                    ...seqItem,
                                                    content: {
                                                      ...seqItem.content,
                                                      useMediaVariations: e.target.checked,
                                                      mediaVariations: e.target.checked ? Array.from({ length: 4 }, () => ({ url: '', caption: '', fileName: '' })) : undefined,
                                                      // Limpar URL principal quando ativar variações
                                                      url: e.target.checked ? '' : seqItem.content.url
                                                    }
                                                  };
                                                }
                                                return seqItem;
                                              });
                                              setFormData(prev => ({
                                                ...prev,
                                                messageContent: { sequence: newSequence }
                                              }));
                                            }}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <span className="text-sm text-gray-600">{t('campaigns.messages.file.useVariations')}</span>
                                        </label>
                                      </div>

                                      {item.content.useMediaVariations ? (
                                        // Grid horizontal de 4 variações
                                        <div className="grid grid-cols-4 gap-3">
                                          {Array.from({ length: 4 }, (_, varIndex) => {
                                            const mediaVariations = item.content.mediaVariations || [];
                                            const variation = mediaVariations[varIndex] || { url: '', caption: '', fileName: '' };
                                            const hasFile = variation.url;

                                            return (
                                              <div key={varIndex} className="space-y-2">
                                                {/* Header da variação */}
                                                <div className="flex items-center justify-between">
                                                  <span className="text-xs font-medium text-gray-600">
                                                    {varIndex === 0 ? t('campaigns.messages.file.main') : t('campaigns.messages.file.variation', { index: varIndex + 1 })}
                                                  </span>
                                                  {hasFile && varIndex > 0 && (
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                                        const newSequence = currentSequence.map((seqItem, i) => {
                                                          if (i === index) {
                                                            const newVariations = [...(seqItem.content.mediaVariations || [])];
                                                            newVariations[varIndex] = { url: '', caption: '', fileName: '' };
                                                            return {
                                                              ...seqItem,
                                                              content: { ...seqItem.content, mediaVariations: newVariations }
                                                            };
                                                          }
                                                          return seqItem;
                                                        });
                                                        setFormData(prev => ({
                                                          ...prev,
                                                          messageContent: { sequence: newSequence }
                                                        }));
                                                      }}
                                                      className="text-red-500 hover:text-red-700 text-xs p-0.5"
                                                      title={t('campaigns.messages.remove')}
                                                    >
                                                      ✕
                                                    </button>
                                                  )}
                                                </div>

                                                {/* Preview quadrado */}
                                                <div className="aspect-square border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                                                  {!hasFile ? (
                                                    <>
                                                      <input
                                                        type="file"
                                                        id={`file-upload-${index}-${varIndex}`}
                                                        className="hidden"
                                                        accept={
                                                          item.type === 'image' ? 'image/*' :
                                                            item.type === 'video' ? 'video/*' :
                                                              item.type === 'audio' ? 'audio/*' :
                                                                'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip'
                                                        }
                                                        onChange={(e) => {
                                                          const file = e.target.files?.[0];
                                                          if (file) {
                                                            handleFileUpload(file, index, varIndex);
                                                          }
                                                        }}
                                                        disabled={uploadingFiles[`${index}-${varIndex}`]}
                                                      />
                                                      <label
                                                        htmlFor={`file-upload-${index}-${varIndex}`}
                                                        className={`w-full h-full flex flex-col items-center justify-center cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50 ${uploadingFiles[`${index}-${varIndex}`]
                                                          ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                                                          : 'text-gray-500 hover:text-blue-600'
                                                          }`}
                                                      >
                                                        {uploadingFiles[`${index}-${varIndex}`] ? (
                                                          <div className="flex flex-col items-center gap-1">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                                            <span className="text-xs">{t('campaigns.messages.file.uploading')}</span>
                                                          </div>
                                                        ) : (
                                                          <div className="flex flex-col items-center gap-1">
                                                            <div className="text-2xl">
                                                              {item.type === 'image' && '🖼️'}
                                                              {item.type === 'video' && '🎥'}
                                                              {item.type === 'audio' && '🎵'}
                                                              {item.type === 'document' && '📄'}
                                                            </div>
                                                            <span className="text-xs text-center">
                                                              {t('campaigns.messages.file.uploadHelp')}
                                                            </span>
                                                          </div>
                                                        )}
                                                      </label>
                                                    </>
                                                  ) : (
                                                    <div className="w-full h-full relative group">
                                                      {item.type === 'image' && (
                                                        <img
                                                          src={variation.url}
                                                          alt={`Variação ${varIndex + 1}`}
                                                          className="w-full h-full object-cover"
                                                        />
                                                      )}

                                                      {item.type === 'video' && (
                                                        <div className="w-full h-full relative">
                                                          <video
                                                            src={variation.url}
                                                            className="w-full h-full object-cover"
                                                            muted
                                                          />
                                                          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                                                            <div className="bg-white bg-opacity-90 p-1 rounded-full">
                                                              <svg className="w-4 h-4 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                                                                <path d="M8 5v14l11-7z" />
                                                              </svg>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      )}

                                                      {item.type === 'audio' && (
                                                        <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex flex-col items-center justify-center">
                                                          <div className="text-3xl mb-1">🎵</div>
                                                          <div className="text-xs text-center text-gray-700 px-1">
                                                            {t('campaigns.messages.type.audio')}
                                                          </div>
                                                        </div>
                                                      )}

                                                      {item.type === 'document' && (
                                                        <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex flex-col items-center justify-center p-2">
                                                          <div className="text-3xl mb-1">📄</div>
                                                          <div className="text-xs text-center text-gray-700 truncate w-full">
                                                            {variation.fileName || t('campaigns.messages.file.uploadedDefault')}
                                                          </div>
                                                        </div>
                                                      )}

                                                      {/* Overlay de ações */}
                                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <a
                                                          href={variation.url}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="bg-white bg-opacity-90 px-2 py-1 rounded text-xs font-medium"
                                                        >
                                                          {t('common.view')}
                                                        </a>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>

                                                {/* Campo de legenda para imagem e vídeo */}
                                                {hasFile && ['image', 'video'].includes(item.type) && (
                                                  <input
                                                    type="text"
                                                    placeholder={t('campaigns.messages.file.captionPlaceholder')}
                                                    value={variation.caption || ''}
                                                    onChange={(e) => {
                                                      const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                                      const newSequence = currentSequence.map((seqItem, i) => {
                                                        if (i === index) {
                                                          const newVariations = [...(seqItem.content.mediaVariations || [])];
                                                          // Garantir que o array tenha o tamanho necessário
                                                          while (newVariations.length <= varIndex) {
                                                            newVariations.push({ url: '', caption: '', fileName: '' });
                                                          }
                                                          newVariations[varIndex] = { ...newVariations[varIndex], caption: e.target.value };
                                                          return {
                                                            ...seqItem,
                                                            content: { ...seqItem.content, mediaVariations: newVariations }
                                                          };
                                                        }
                                                        return seqItem;
                                                      });
                                                      setFormData(prev => ({
                                                        ...prev,
                                                        messageContent: { sequence: newSequence }
                                                      }));
                                                    }}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                  />
                                                )}

                                                {/* Nome do arquivo para não-imagens */}
                                                {hasFile && !['image', 'video'].includes(item.type) && (
                                                  <div className="text-xs text-gray-600 truncate" title={variation.fileName}>
                                                    {variation.fileName || t('campaigns.messages.file.uploadedDefault')}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        // Interface original de arquivo único
                                        <>
                                          {!item.content.url ? (
                                            <div className="flex items-center gap-3">
                                              <input
                                                type="file"
                                                id={`file-upload-${index}`}
                                                className="hidden"
                                                accept={
                                                  item.type === 'image' ? 'image/*' :
                                                    item.type === 'video' ? 'video/*' :
                                                      item.type === 'audio' ? 'audio/*' :
                                                        'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip'
                                                }
                                                onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) {
                                                    handleFileUpload(file, index);
                                                  }
                                                }}
                                                disabled={uploadingFiles[index]}
                                              />
                                              <label
                                                htmlFor={`file-upload-${index}`}
                                                className={`flex-1 cursor-pointer px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg text-center text-sm font-medium transition-colors hover:border-blue-400 hover:bg-blue-50 ${uploadingFiles[index]
                                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                                                  : 'bg-white text-gray-700'
                                                  }`}
                                              >
                                                {uploadingFiles[index] ? (
                                                  <div className="flex flex-col items-center gap-2">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                                    <span>{t('campaigns.messages.file.uploading')}</span>
                                                  </div>
                                                ) : (
                                                  <div className="flex flex-col items-center gap-2">
                                                    <div className="text-2xl">📁</div>
                                                    <span>{t('campaigns.messages.file.uploadHelp')}</span>
                                                    <span className="text-xs text-gray-500">
                                                      {item.type === 'image' && t('campaigns.messages.file.help.images')}
                                                      {item.type === 'video' && t('campaigns.messages.file.help.videos')}
                                                      {item.type === 'audio' && t('campaigns.messages.file.help.audios')}
                                                      {item.type === 'document' && t('campaigns.messages.file.help.documents')}
                                                    </span>
                                                  </div>
                                                )}
                                              </label>
                                            </div>
                                          ) : (
                                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                  {item.type === 'image' && (
                                                    <img
                                                      src={item.content.url}
                                                      alt="Preview"
                                                      className="w-12 h-12 object-cover rounded"
                                                    />
                                                  )}
                                                  {item.type !== 'image' && (
                                                    <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center text-2xl">
                                                      {getFileIcon(fileInfos[index]?.type || item.type)}
                                                    </div>
                                                  )}
                                                  <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 truncate">
                                                      {fileInfos[index]?.name || t('campaigns.messages.file.uploadedDefault')}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                      {fileInfos[index]?.size ? formatFileSize(fileInfos[index].size) : ''}
                                                    </div>
                                                  </div>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveFile(index)}
                                                  className="text-red-600 hover:text-red-800 p-1"
                                                  title={t('campaigns.messages.remove')}
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                  </svg>
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {['image', 'video'].includes(item.type) && !item.content.useMediaVariations && (
                                        <div className="space-y-2">
                                          <input
                                            type="text"
                                            placeholder={t('campaigns.messages.file.captionPlaceholderWithVars', { variables: '{{nome}}, {{telefone}}' })}
                                            value={item.content.caption || ''}
                                            onChange={(e) => {
                                              const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                              const newSequence = currentSequence.map((seqItem, i) =>
                                                i === index ? {
                                                  ...seqItem,
                                                  content: { ...seqItem.content, caption: e.target.value }
                                                } : seqItem
                                              );
                                              setFormData(prev => ({
                                                ...prev,
                                                messageContent: { sequence: newSequence }
                                              }));
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                          <div className="flex flex-wrap gap-1">
                                            <span className="text-xs text-gray-500">{t('campaigns.messages.text.availableVariables')}</span>
                                            {['{{nome}}', '{{telefone}}', '{{categoria}}'].map((variable) => (
                                              <button
                                                key={variable}
                                                type="button"
                                                onClick={() => {
                                                  const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                                  const currentCaption = currentSequence[index]?.content?.caption || '';
                                                  const newSequence = currentSequence.map((seqItem, i) =>
                                                    i === index ? {
                                                      ...seqItem,
                                                      content: { ...seqItem.content, caption: currentCaption + variable }
                                                    } : seqItem
                                                  );
                                                  setFormData(prev => ({
                                                    ...prev,
                                                    messageContent: { sequence: newSequence }
                                                  }));
                                                }}
                                                className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded hover:bg-blue-200"
                                              >
                                                {variable}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {item.type === 'document' && !item.content.useMediaVariations && (
                                        <input
                                          type="text"
                                          placeholder={t('campaigns.messages.file.fileNamePlaceholder')}
                                          value={item.content.fileName || ''}
                                          onChange={(e) => {
                                            const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                            const newSequence = currentSequence.map((seqItem, i) =>
                                              i === index ? {
                                                ...seqItem,
                                                content: { ...seqItem.content, fileName: e.target.value }
                                              } : seqItem
                                            );
                                            setFormData(prev => ({
                                              ...prev,
                                              messageContent: { sequence: newSequence }
                                            }));
                                          }}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      )}
                                    </div>
                                  )}

                                  {item.type === 'wait' && (
                                    <div className="space-y-3">
                                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                          <span className="text-2xl">⏱️</span>
                                          <div className="flex-1">
                                            <h4 className="text-sm font-medium text-yellow-900 mb-2">
                                              {t('campaigns.messages.wait.title')}
                                            </h4>
                                            <p className="text-xs text-yellow-700 mb-3">
                                              {t('campaigns.messages.wait.desc')}
                                            </p>
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="number"
                                                min="1"
                                                max="3600"
                                                value={item.content.waitTime || 30}
                                                onChange={(e) => {
                                                  const currentSequence = ('sequence' in formData.messageContent) ? formData.messageContent.sequence : [];
                                                  const newSequence = currentSequence.map((seqItem, i) =>
                                                    i === index ? {
                                                      ...seqItem,
                                                      content: { waitTime: parseInt(e.target.value) || 30 }
                                                    } : seqItem
                                                  );
                                                  setFormData(prev => ({
                                                    ...prev,
                                                    messageContent: { sequence: newSequence }
                                                  }));
                                                }}
                                                className="w-24 px-3 py-2 border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                                              />
                                              <span className="text-sm text-yellow-700">{t('common.seconds', { count: 0 }).replace('0 ', '')}</span>
                                            </div>
                                            <p className="text-xs text-yellow-600 mt-2">
                                              {t('campaigns.messages.wait.help')}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}

                            {(!('sequence' in formData.messageContent) || formData.messageContent.sequence.length === 0) && (
                              <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                <div className="text-4xl mb-4">📝</div>
                                <p className="text-lg font-medium">{t('campaigns.messages.empty.title')}</p>
                                <p className="text-sm">{t('campaigns.messages.empty.desc')}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-8 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-lg"
                    >
                      {t('campaigns.list.newCampaign').replace('+ ', '')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Portal >
        )
        }

        {/* Modal de Relatórios */}
        {
          showReportModal && (
            <Portal>
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center backdrop-blur-sm" style={{ zIndex: 9999 }}>
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto relative"
                  style={{ zIndex: 1000 }}>
                  <div className="flex justify-between items-center p-6 border-b">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-gray-900">{t('campaigns.report.title')}</h3>
                      <button
                        onClick={handleRefreshReport}
                        disabled={reportLoading}
                        className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-600 text-sm rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('campaigns.report.refresh')}
                      >
                        <svg className={`w-4 h-4 ${reportLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {reportLoading ? t('campaigns.report.loading') : t('campaigns.report.refresh')}
                      </button>
                    </div>
                    <button
                      onClick={() => setShowReportModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="p-6">
                    {reportLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">{t('campaigns.report.loading')}</span>
                      </div>
                    ) : reportData ? (
                      <div className="space-y-6">
                        {/* Informações da Campanha */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-lg font-semibold text-gray-900 mb-3">{reportData.campaign.nome}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">{t('campaigns.report.fields.status')}</span>
                              <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reportData.campaign.status)}`}>
                                {getStatusText(reportData.campaign.status)}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">{t('campaigns.report.fields.createdBy')}</span>
                              <span className="ml-2 text-gray-900">
                                {reportData.campaign.createdByName || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">{t('campaigns.report.fields.createdAt')}</span>
                              <span className="ml-2 text-gray-900">{new Date(reportData.campaign.criadoEm).toLocaleString('pt-BR')}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">{t('campaigns.report.fields.startedAt')}</span>
                              <span className="ml-2 text-gray-900">
                                {reportData.campaign.startedAt ? new Date(reportData.campaign.startedAt).toLocaleString('pt-BR') : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">{t('campaigns.report.fields.completedAt')}</span>
                              <span className="ml-2 text-gray-900">
                                {reportData.campaign.completedAt ? new Date(reportData.campaign.completedAt).toLocaleString('pt-BR') : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Estatísticas */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-3">{t('campaigns.report.stats.title')}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-blue-600">{reportData.stats.total}</div>
                              <div className="text-sm text-blue-800">{t('campaigns.report.stats.total')}</div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-green-600">{reportData.stats.sent}</div>
                              <div className="text-sm text-green-800">{t('campaigns.report.stats.sent')}</div>
                            </div>
                            <div className="bg-red-50 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-red-600">{reportData.stats.failed}</div>
                              <div className="text-sm text-red-800">{t('campaigns.report.stats.failed')}</div>
                            </div>
                            <div className="bg-yellow-50 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-yellow-600">{reportData.stats.pending}</div>
                              <div className="text-sm text-yellow-800">{t('campaigns.report.stats.pending')}</div>
                            </div>
                          </div>
                        </div>

                        {/* Mensagens por Sessão */}
                        {Object.keys(reportData.messagesBySession).length > 0 && (
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-3">{t('campaigns.report.sessionDistribution')}</h4>
                            <div className="bg-white border rounded-lg overflow-hidden">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.report.table.session')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.report.table.total')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.report.table.sent')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.report.table.failed')}</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {Object.entries(reportData.messagesBySession).map(([sessionName, sessionData]) => {
                                    const messages = (sessionData as any).messages || [];
                                    return (
                                      <tr key={sessionName}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sessionName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{messages.length}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                                          {messages.filter((m: any) => m.status === 'SENT').length}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                                          {messages.filter((m: any) => m.status === 'FAILED').length}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Mensagens Detalhadas */}
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-lg font-semibold text-gray-900">{t('campaigns.report.detailedMessages')}</h4>
                            <button
                              onClick={handleDownloadReport}
                              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                            >
                              📊 {t('campaigns.report.downloadCsv')}
                            </button>
                          </div>

                          {(() => {
                            const messages = reportData.campaign.messages || [];
                            const totalPages = Math.ceil(messages.length / reportItemsPerPage);
                            const startIndex = (reportCurrentPage - 1) * reportItemsPerPage;
                            const endIndex = startIndex + reportItemsPerPage;
                            const currentMessages = messages.slice(startIndex, endIndex);

                            return (
                              <>
                                <div className="bg-white border rounded-lg overflow-hidden overflow-visible">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.report.table.name')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.report.table.phone')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.report.table.status')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.report.table.session')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.report.table.sentDate')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.report.table.error')}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {currentMessages.map((message: any) => (
                                        <tr key={message.id}>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{message.contactName}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{message.contactPhone}</td>
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${message.status === 'SENT' ? 'bg-green-100 text-green-800' :
                                              message.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                              }`}>
                                              {message.status === 'SENT' ? t('campaigns.report.table.sent') :
                                                message.status === 'FAILED' ? t('campaigns.report.table.failed') : t('campaigns.status.pending')}
                                            </span>
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{message.sessionName || 'N/A'}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {message.sentAt ? new Date(message.sentAt).toLocaleString('pt-BR') : 'N/A'}
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            {message.errorMessage && message.errorMessage !== 'N/A' ? (
                                              (() => {
                                                const errorInfo = getErrorIcon(message.errorMessage);
                                                return errorInfo ? (
                                                  <div className="group relative inline-flex items-center">
                                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${errorInfo.bgColor} cursor-help`}>
                                                      <span className="text-lg">{errorInfo.icon}</span>
                                                    </div>

                                                    {/* Tooltip com posicionamento inteligente */}
                                                    <div className="group-hover:block hidden absolute z-[9999]">
                                                      {/* Versão à direita */}
                                                      <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 w-96 max-w-sm p-4 text-sm bg-gray-900 text-white rounded-lg shadow-xl border border-gray-700 group-hover/right:block hidden">
                                                        {/* Seta esquerda */}
                                                        <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1">
                                                          <div className="w-2 h-2 bg-gray-900 border-l border-b border-gray-700 rotate-45"></div>
                                                        </div>

                                                        {/* Conteúdo */}
                                                        <div className="space-y-3">
                                                          <div className="flex items-center gap-2">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${errorInfo.bgColor} ${errorInfo.color}`}>
                                                              {errorInfo.icon} {errorInfo.category}
                                                            </span>
                                                          </div>
                                                          <div className="font-semibold text-white text-sm">
                                                            {t('campaigns.report.errorDetails')}
                                                          </div>
                                                          <div className="text-gray-200 break-all whitespace-normal text-xs leading-relaxed hyphens-auto overflow-wrap-anywhere">
                                                            {message.errorMessage}
                                                          </div>
                                                        </div>
                                                      </div>

                                                      {/* Versão à esquerda (fallback) */}
                                                      <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 w-96 max-w-sm p-4 text-sm bg-gray-900 text-white rounded-lg shadow-xl border border-gray-700">
                                                        {/* Seta derecha */}
                                                        <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1">
                                                          <div className="w-2 h-2 bg-gray-900 border-r border-t border-gray-700 rotate-45"></div>
                                                        </div>

                                                        {/* Conteúdo */}
                                                        <div className="space-y-3">
                                                          <div className="flex items-center gap-2">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${errorInfo.bgColor} ${errorInfo.color}`}>
                                                              {errorInfo.icon} {errorInfo.category}
                                                            </span>
                                                          </div>
                                                          <div className="font-semibold text-white text-sm">
                                                            {t('campaigns.report.errorDetails')}
                                                          </div>
                                                          <div className="text-gray-200 break-all whitespace-normal text-xs leading-relaxed hyphens-auto overflow-wrap-anywhere">
                                                            {message.errorMessage}
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <span className="text-sm text-red-600">
                                                    {message.errorMessage}
                                                  </span>
                                                );
                                              })()
                                            ) : (
                                              <span className="text-sm text-gray-400 flex items-center justify-center">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                                                  <span className="text-lg">✅</span>
                                                </div>
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  {messages.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                      {t('campaigns.report.noMessages')}
                                    </div>
                                  )}
                                </div>

                                {/* Paginação */}
                                {totalPages > 1 && (
                                  <div className="flex items-center justify-between mt-4">
                                    <div className="text-sm text-gray-700">
                                      {t('pagination.showing', { start: startIndex + 1, end: Math.min(endIndex, messages.length), total: messages.length })}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setReportCurrentPage(page => Math.max(page - 1, 1))}
                                        disabled={reportCurrentPage === 1}
                                        className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {t('pagination.previous')}
                                      </button>

                                      <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                                          <button
                                            key={pageNum}
                                            onClick={() => setReportCurrentPage(pageNum)}
                                            className={`px-3 py-2 text-sm rounded-md ${pageNum === reportCurrentPage
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                              }`}
                                          >
                                            {pageNum}
                                          </button>
                                        ))}
                                      </div>

                                      <button
                                        onClick={() => setReportCurrentPage(page => Math.min(page + 1, totalPages))}
                                        disabled={reportCurrentPage === totalPages}
                                        className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {t('pagination.next')}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        {t('campaigns.validation.loadReportError')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Portal>
          )
        }
      </div >
    </>
  );
}