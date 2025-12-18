import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Header } from '../components/Header';
import { Portal } from '../components/Portal';
import { InteractiveCampaignModal } from '../components/InteractiveCampaignModal';
import {
  interactiveCampaignApi,
  InteractiveCampaign,
  Connection,
} from '../services/interactiveCampaignApi';

// Função helper para remover @c.us dos telefones
const cleanPhoneNumber = (phone: string): string => {
  return phone ? phone.replace(/@c\.us$/, '') : phone;
};

export function InteractiveCampaignPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<InteractiveCampaign[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<InteractiveCampaign[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Estados para o modal de relatório
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'details'>('dashboard');

  useEffect(() => {
    loadData();

    // Auto-refresh a cada 30 segundos
    const intervalId = setInterval(() => {
      loadData();
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [campaignsData, connectionsData] = await Promise.all([
        interactiveCampaignApi.getCampaigns(),
        interactiveCampaignApi.getConnections(),
      ]);
      setAllCampaigns(campaignsData);
      setCampaigns(campaignsData);
      setConnections(connectionsData);
    } catch (error: any) {
      toast.error(`${t('campaigns.validation.loadError')}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar campanhas baseado na busca e filtro de status
  useEffect(() => {
    let filtered = allCampaigns;

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(campaign =>
        campaign.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro de status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(campaign => campaign.status === statusFilter);
    }

    setCampaigns(filtered);
  }, [searchTerm, statusFilter, allCampaigns]);

  const handleCreateCampaign = async (name: string) => {
    try {
      const newCampaign = await interactiveCampaignApi.createCampaign({
        name,
        graph: {
          nodes: [],
          edges: [],
        },
      });

      toast.success(t('interactiveCampaigns.messages.createSuccess'));

      // Redirecionar para o builder
      navigate(`/campanhas/interativa/${newCampaign.id}`);
    } catch (error: any) {
      toast.error(`${t('interactiveCampaigns.messages.createError')}: ${error.message}`);
    }
  };

  const handleEditCampaign = (id: string) => {
    navigate(`/campanhas/interativa/${id}`);
  };

  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!confirm(t('interactiveCampaigns.messages.deleteConfirm', { name }))) {
      return;
    }

    try {
      setDeletingId(id);
      await interactiveCampaignApi.deleteCampaign(id);
      toast.success(t('interactiveCampaigns.messages.deleteSuccess'));
      await loadData();
    } catch (error: any) {
      toast.error(`${t('interactiveCampaigns.messages.deleteError')}: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePublishCampaign = async (id: string, name: string) => {
    if (!confirm(t('interactiveCampaigns.messages.publishConfirm', { name }))) {
      return;
    }

    try {
      await interactiveCampaignApi.publishCampaign(id);
      toast.success(t('interactiveCampaigns.messages.publishSuccess'));
      await loadData();
    } catch (error: any) {
      toast.error(`${t('interactiveCampaigns.messages.publishError')}: ${error.message}`);
    }
  };

  const handlePauseCampaign = async (id: string, name: string) => {
    try {
      await interactiveCampaignApi.pauseCampaign(id);
      toast.success(t('interactiveCampaigns.messages.pauseSuccess', { name }));
      await loadData();
    } catch (error: any) {
      toast.error(`${t('interactiveCampaigns.messages.pauseError')}: ${error.message}`);
    }
  };

  const handleCompleteCampaign = async (id: string, name: string) => {
    if (!confirm(t('interactiveCampaigns.messages.completeConfirm', { name }))) {
      return;
    }
    try {
      await interactiveCampaignApi.completeCampaign(id);
      toast.success(t('interactiveCampaigns.messages.completeSuccess', { name }));
      await loadData();
    } catch (error: any) {
      toast.error(`${t('interactiveCampaigns.messages.completeError')}: ${error.message}`);
    }
  };

  const handleDuplicateCampaign = async (id: string, name: string) => {
    try {
      const duplicatedCampaign = await interactiveCampaignApi.duplicateCampaign(id);
      toast.success(t('interactiveCampaigns.messages.duplicateSuccess', { name }));
      await loadData();

      // Redirecionar para editar a campanha duplicada
      navigate(`/campanhas/interativa/${duplicatedCampaign.id}`);
    } catch (error: any) {
      toast.error(`${t('interactiveCampaigns.messages.duplicateError')}: ${error.message}`);
    }
  };

  const handleViewReport = async (id: string) => {
    setReportLoading(true);
    setShowReportModal(true);

    try {
      const data = await interactiveCampaignApi.getCampaignReport(id);
      setReportData(data);
    } catch (error: any) {
      toast.error(`${t('interactiveCampaigns.messages.reportLoadError')}: ${error.message}`);
      setShowReportModal(false);
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportToExcel = () => {
    if (!reportData) return;

    try {
      // Preparar dados para exportação
      const exportData = reportData.campaign.sessions.map((session: any) => {
        const row: any = {
          'Nome': session.contactName,
          'Telefone': cleanPhoneNumber(session.contactPhone),
          'Status': session.status === 'ACTIVE' ? 'Ativa' :
            session.status === 'COMPLETED' ? 'Concluída' :
              session.status === 'FAILED' ? 'Falhada' : 'Expirada',
        };

        // Adicionar colunas para cada nó do fluxo
        if (reportData.flowNodes) {
          reportData.flowNodes.forEach((node: any) => {
            const nodeData = session.visitedNodes?.[node.id];
            if (nodeData) {
              row[`${node.label} (${node.type})`] = nodeData.sent ?
                `✓ ${new Date(nodeData.visitedAt).toLocaleString(i18n.language)}` :
                `✗ ${nodeData.error || t('common.error')}`;
            } else {
              row[`${node.label} (${node.type})`] = '-';
            }
          });
        }

        return row;
      });

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 20 }, // Nome
        { wch: 15 }, // Telefone
        { wch: 12 }, // Status
      ];

      // Adicionar larguras para colunas de nós
      if (reportData.flowNodes) {
        reportData.flowNodes.forEach(() => {
          colWidths.push({ wch: 25 });
        });
      }

      ws['!cols'] = colWidths;

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, t('interactiveCampaigns.report.title'));

      // Gerar arquivo e fazer download
      const fileName = `relatorio_${reportData.campaign.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(t('interactiveCampaigns.messages.exportSuccess'));
    } catch (error: any) {
      toast.error(`${t('interactiveCampaigns.messages.exportError')}: ${error.message}`);
    }
  };

  const handleRefreshReport = async () => {
    if (!reportData?.campaign?.id) return;
    setReportLoading(true);
    try {
      const data = await interactiveCampaignApi.getCampaignReport(reportData.campaign.id);
      setReportData(data);
      toast.success(t('interactiveCampaigns.messages.reportRefreshSuccess'));
    } catch (error: any) {
      toast.error(`${t('interactiveCampaigns.messages.reportRefreshError')}: ${error.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  const handleToggleSelectCampaign = (campaignId: string) => {
    setSelectedCampaignIds(prev =>
      prev.includes(campaignId)
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    );
  };

  const handleSelectAllCampaigns = () => {
    if (selectedCampaignIds.length === campaigns.length) {
      setSelectedCampaignIds([]);
    } else {
      setSelectedCampaignIds(campaigns.map(c => c.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCampaignIds.length === 0) return;

    if (!confirm(t('interactiveCampaigns.messages.bulkDeleteConfirm', { count: selectedCampaignIds.length }))) {
      return;
    }

    try {
      setBulkDeleting(true);

      // Deletar todas as campanhas selecionadas
      await Promise.all(
        selectedCampaignIds.map(id => interactiveCampaignApi.deleteCampaign(id))
      );

      toast.success(t('interactiveCampaigns.messages.bulkDeleteSuccess', { count: selectedCampaignIds.length }));
      setSelectedCampaignIds([]);
      await loadData();
    } catch (error: any) {
      toast.error(`${t('interactiveCampaigns.messages.bulkDeleteError')}: ${error.message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'STARTED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {t('interactiveCampaigns.status.started')}
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {t('interactiveCampaigns.status.scheduled')}
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            {t('interactiveCampaigns.status.paused')}
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-500 text-white">
            {t('interactiveCampaigns.status.completed')}
          </span>
        );
      default: // DRAFT
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {t('interactiveCampaigns.status.draft')}
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Extrai as conexões configuradas no nó Trigger
  const getTriggerConnections = (campaign: any) => {
    const graph = campaign.graph;
    if (!graph || !graph.nodes) return [];

    const triggerNode = graph.nodes.find((n: any) => n.data?.nodeType === 'trigger');
    if (!triggerNode || !triggerNode.data?.config) return [];

    return triggerNode.data.config.connections || [];
  };

  return (
    <div className="min-h-screen bg-ui-bg">
      <Header
        title={t('interactiveCampaigns.title')}
        subtitle={
          selectedCampaignIds.length > 0
            ? t('interactiveCampaigns.selectedSubtitle', { count: selectedCampaignIds.length })
            : t('interactiveCampaigns.subtitle', { count: allCampaigns.length })
        }
        actions={
          <div className="flex gap-3">
            {selectedCampaignIds.length > 0 ? (
              <>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {bulkDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{t('interactiveCampaigns.actions.deleting')}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>{t('interactiveCampaigns.actions.deleteSelected', { count: selectedCampaignIds.length })}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedCampaignIds([])}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm font-medium transition-colors"
                >
                  {t('interactiveCampaigns.actions.cancelSelection')}
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-brand-primary text-white rounded-xl hover:opacity-90 transition-opacity flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>{t('interactiveCampaigns.newCampaign')}</span>
              </button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Buscador e Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Campo de busca */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('interactiveCampaigns.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Filtro de status */}
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option value="all">{t('interactiveCampaigns.statusFilter.all')}</option>
                <option value="DRAFT">{t('interactiveCampaigns.statusFilter.draft')}</option>
                <option value="SCHEDULED">{t('interactiveCampaigns.statusFilter.scheduled')}</option>
                <option value="STARTED">{t('interactiveCampaigns.statusFilter.started')}</option>
                <option value="PAUSED">{t('interactiveCampaigns.statusFilter.paused')}</option>
                <option value="COMPLETED">{t('interactiveCampaigns.statusFilter.completed')}</option>
              </select>
            </div>

            {/* Botão de limpar filtros */}
            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('interactiveCampaigns.clearFilters')}
              </button>
            )}
          </div>
        </div>

        {/* Seleção de todos */}
        {campaigns.length > 0 && (
          <div className="flex items-center justify-between">
            <button
              onClick={handleSelectAllCampaigns}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
            >
              {selectedCampaignIds.length === campaigns.length ? t('interactiveCampaigns.deselectAll') : t('interactiveCampaigns.selectAll')}
            </button>
            {selectedCampaignIds.length > 0 && (
              <span className="text-sm text-gray-600">
                {t('interactiveCampaigns.selectedCount', { count: selectedCampaignIds.length, total: campaigns.length })}
              </span>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {t('interactiveCampaigns.emptyState.title')}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {t('interactiveCampaigns.emptyState.description')}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-brand-primary text-white rounded-xl hover:opacity-90 transition-opacity"
                >
                  {t('interactiveCampaigns.emptyState.button')}
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectedCampaignIds.length === campaigns.length && campaigns.length > 0}
                        onChange={handleSelectAllCampaigns}
                        className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('interactiveCampaigns.table.name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('interactiveCampaigns.table.connections')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('interactiveCampaigns.table.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('interactiveCampaigns.table.createdAt')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('interactiveCampaigns.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedCampaignIds.includes(campaign.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleSelectCampaign(campaign.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleEditCampaign(campaign.id)}>
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-brand-secondary/10 rounded-xl">
                            <svg
                              className="h-6 w-6 text-brand-primary"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {campaign.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {t('interactiveCampaigns.table.nodes', { count: campaign.graph?.nodes?.length || 0 })}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => handleEditCampaign(campaign.id)}>
                        {(() => {
                          const triggerConnectionIds = getTriggerConnections(campaign);
                          if (triggerConnectionIds.length === 0) {
                            return <div className="text-sm text-gray-500">-</div>;
                          }

                          const triggerConnections = connections.filter(c =>
                            triggerConnectionIds.includes(c.id)
                          );

                          if (triggerConnections.length === 0) {
                            return <div className="text-sm text-gray-500">-</div>;
                          }

                          return (
                            <div>
                              <div className="text-sm text-gray-900">
                                {triggerConnections[0].instanceName}
                              </div>
                              {triggerConnections.length > 1 && (
                                <div className="text-xs text-gray-500">
                                  {t('interactiveCampaigns.table.otherConnections', { count: triggerConnections.length - 1 })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleEditCampaign(campaign.id)}>
                        {getStatusBadge(campaign.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer" onClick={() => handleEditCampaign(campaign.id)}>
                        {formatDate(campaign.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {campaign.status === 'DRAFT' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePublishCampaign(campaign.id, campaign.name);
                              }}
                              className="text-green-600 hover:text-green-900 p-2 rounded-lg hover:bg-green-50 transition-colors"
                              title={t('interactiveCampaigns.actions.publish')}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}
                          {(campaign.status === 'STARTED' || campaign.status === 'SCHEDULED') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePauseCampaign(campaign.id, campaign.name);
                              }}
                              className="text-yellow-600 hover:text-yellow-900 p-2 rounded-lg hover:bg-yellow-50 transition-colors"
                              title={t('interactiveCampaigns.actions.pause')}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                          {(campaign.status === 'STARTED' || campaign.status === 'SCHEDULED' || campaign.status === 'PAUSED') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteCampaign(campaign.id, campaign.name);
                              }}
                              className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                              title={t('interactiveCampaigns.actions.complete')}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCampaign(campaign.id);
                            }}
                            className="text-brand-primary hover:text-brand-primary/80 p-2 rounded-lg hover:bg-brand-secondary/10 transition-colors"
                            title={t('interactiveCampaigns.actions.edit')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewReport(campaign.id);
                            }}
                            className="text-purple-600 hover:text-purple-900 p-2 rounded-lg hover:bg-purple-50 transition-colors"
                            title={t('interactiveCampaigns.actions.viewReport')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateCampaign(campaign.id, campaign.name);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                            title={t('interactiveCampaigns.actions.duplicate')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCampaign(campaign.id, campaign.name);
                            }}
                            disabled={deletingId === campaign.id}
                            className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            title={t('interactiveCampaigns.actions.delete')}
                          >
                            {deletingId === campaign.id ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Relatório */}
      {showReportModal && (
        <Portal>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center backdrop-blur-sm" style={{ zIndex: 9999 }}>
            <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] overflow-y-auto relative" style={{ zIndex: 1000 }}>
              <div className="flex justify-between items-center p-6 border-b">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-medium text-gray-900">{t('interactiveCampaigns.report.title')}</h3>
                  <button
                    onClick={handleRefreshReport}
                    disabled={reportLoading}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-600 text-sm rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('interactiveCampaigns.report.refresh')}
                  >
                    <svg className={`w-4 h-4 ${reportLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {reportLoading ? t('interactiveCampaigns.report.refreshing') : t('interactiveCampaigns.report.refresh')}
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

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px px-6">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dashboard'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    {t('interactiveCampaigns.report.dashboard')}
                  </button>
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    {t('interactiveCampaigns.report.details')}
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {reportLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">{t('common.loading')}</span>
                  </div>
                ) : reportData ? (
                  <div className="space-y-6">
                    {/* Tab Dashboard */}
                    {activeTab === 'dashboard' && (
                      <div className="space-y-6">
                        {/* Header com informações da campanha */}
                        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-2xl font-bold mb-2">{reportData.campaign.name}</h3>
                              <p className="text-blue-100 text-sm">
                                {t('interactiveCampaigns.report.createdAt')}: {new Date(reportData.campaign.createdAt).toLocaleDateString(i18n.language)}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${reportData.campaign.status === 'DRAFT' ? 'bg-gray-500/30 backdrop-blur-sm' :
                                reportData.campaign.status === 'SCHEDULED' ? 'bg-yellow-500/30 backdrop-blur-sm' :
                                  reportData.campaign.status === 'STARTED' ? 'bg-green-500/30 backdrop-blur-sm' :
                                    reportData.campaign.status === 'PAUSED' ? 'bg-orange-500/30 backdrop-blur-sm' :
                                      'bg-blue-500/30 backdrop-blur-sm'
                                }`}>
                                {reportData.campaign.status === 'DRAFT' ? `📝 ${t('interactiveCampaigns.status.draft')}` :
                                  reportData.campaign.status === 'SCHEDULED' ? `⏰ ${t('interactiveCampaigns.status.scheduled')}` :
                                    reportData.campaign.status === 'STARTED' ? `✅ ${t('interactiveCampaigns.status.started')}` :
                                      reportData.campaign.status === 'PAUSED' ? `⏸️ ${t('interactiveCampaigns.status.paused')}` : `✅ ${t('interactiveCampaigns.status.completed')}`}
                              </div>
                              <p className="text-blue-100 text-sm mt-2">
                                📱 {reportData.campaign.connection?.instanceName || 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* KPIs Principais - Cards Grandes */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-blue-600 text-sm font-medium">{t('interactiveCampaigns.report.totalContacts')}</span>
                              <span className="text-3xl">👥</span>
                            </div>
                            <div className="text-3xl font-bold text-blue-700">{reportData.stats.total}</div>
                            <p className="text-xs text-blue-600 mt-1">{t('interactiveCampaigns.report.reachedContacts')}</p>
                          </div>

                          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-green-600 text-sm font-medium">{t('interactiveCampaigns.report.activeSessions')}</span>
                              <span className="text-3xl">⚡</span>
                            </div>
                            <div className="text-3xl font-bold text-green-700">{reportData.stats.active}</div>
                            <p className="text-xs text-green-600 mt-1">
                              {reportData.stats.total > 0 ? `${((reportData.stats.active / reportData.stats.total) * 100).toFixed(1)}%` : '0%'} {t('interactiveCampaigns.report.ofTotal')}
                            </p>
                          </div>

                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-purple-600 text-sm font-medium">{t('interactiveCampaigns.report.completed')}</span>
                              <span className="text-3xl">✅</span>
                            </div>
                            <div className="text-3xl font-bold text-purple-700">{reportData.stats.completed}</div>
                            <p className="text-xs text-purple-600 mt-1">
                              {reportData.stats.total > 0 ? `${((reportData.stats.completed / reportData.stats.total) * 100).toFixed(1)}%` : '0%'} {t('interactiveCampaigns.report.completionRate')}
                            </p>
                          </div>

                          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-red-600 text-sm font-medium">{t('interactiveCampaigns.report.failed')}</span>
                              <span className="text-3xl">❌</span>
                            </div>
                            <div className="text-3xl font-bold text-red-700">{reportData.stats.failed}</div>
                            <p className="text-xs text-red-600 mt-1">
                              {reportData.stats.total > 0 ? `${((reportData.stats.failed / reportData.stats.total) * 100).toFixed(1)}%` : '0%'} {t('interactiveCampaigns.report.errorRate')}
                            </p>
                          </div>
                        </div>

                        {/* Funil de Conversão por Nó */}
                        {reportData.flowNodes && reportData.flowNodes.length > 0 && (
                          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <span className="text-2xl">📈</span>
                              {t('interactiveCampaigns.report.conversionFunnel')}
                            </h4>
                            <div className="space-y-3">
                              {reportData.flowNodes.map((node: any, index: number) => {
                                // Calcular quantos contatos chegaram neste nó
                                const reachedCount = reportData.campaign.sessions.filter((session: any) =>
                                  session.visitedNodes?.[node.id]
                                ).length;
                                const sentCount = reportData.campaign.sessions.filter((session: any) =>
                                  session.visitedNodes?.[node.id]?.sent
                                ).length;
                                const percentage = reportData.stats.total > 0 ? (reachedCount / reportData.stats.total) * 100 : 0;
                                const successRate = reachedCount > 0 ? (sentCount / reachedCount) * 100 : 0;

                                return (
                                  <div key={node.id} className="relative">
                                    <div className="flex items-center gap-4">
                                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                                        {index + 1}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${node.type === 'text' ? 'bg-blue-100 text-blue-800' :
                                              node.type === 'image' ? 'bg-green-100 text-green-800' :
                                                node.type === 'video' ? 'bg-purple-100 text-purple-800' :
                                                  node.type === 'audio' ? 'bg-yellow-100 text-yellow-800' :
                                                    node.type === 'document' ? 'bg-red-100 text-red-800' :
                                                      'bg-gray-100 text-gray-800'
                                              }`}>
                                              {t(`interactiveCampaigns.nodes.${node.type}`)}
                                            </span>
                                            <span className="font-medium text-gray-700">{node.label}</span>
                                          </div>
                                          <div className="flex items-center gap-4 text-sm">
                                            <span className="text-gray-600">
                                              <strong className="text-blue-600">{reachedCount}</strong> {t('interactiveCampaigns.report.reached')}
                                            </span>
                                            <span className="text-gray-600">
                                              <strong className="text-green-600">{sentCount}</strong> {t('interactiveCampaigns.report.sent')}
                                            </span>
                                            <span className="font-semibold text-purple-600">
                                              {percentage.toFixed(1)}%
                                            </span>
                                          </div>
                                        </div>
                                        <div className="relative">
                                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                            <div
                                              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                                              style={{ width: `${percentage}%` }}
                                            >
                                              {percentage > 10 && (
                                                <span className="text-xs font-bold text-white">{percentage.toFixed(1)}%</span>
                                              )}
                                            </div>
                                          </div>
                                          {/* Barra de sucesso sobreposta */}
                                          <div className="absolute top-0 left-0 w-full h-3">
                                            <div
                                              className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full opacity-60"
                                              style={{ width: `${(sentCount / reportData.stats.total) * 100}%` }}
                                            />
                                          </div>
                                        </div>
                                        {reachedCount > 0 && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            {t('interactiveCampaigns.report.successRate')}: <strong className="text-green-600">{successRate.toFixed(1)}%</strong>
                                            {reachedCount - sentCount > 0 && (
                                              <span className="text-red-600 ml-2">
                                                ({reachedCount - sentCount} {t('interactiveCampaigns.report.failures')})
                                              </span>
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {index < reportData.flowNodes.length - 1 && (
                                      <div className="ml-6 my-2">
                                        <div className="w-0.5 h-4 bg-gradient-to-b from-gray-300 to-gray-400"></div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Métricas de Performance */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Taxa de Conversão Geral */}
                          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <span className="text-2xl">🎯</span>
                              {t('interactiveCampaigns.insights.conversionRate')}
                            </h4>
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm text-gray-600">{t('interactiveCampaigns.insights.journeyCompletion')}</span>
                                  <span className="text-lg font-bold text-purple-600">
                                    {reportData.stats.total > 0 ? ((reportData.stats.completed / reportData.stats.total) * 100).toFixed(1) : '0'}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-purple-700 rounded-full"
                                    style={{ width: `${reportData.stats.total > 0 ? (reportData.stats.completed / reportData.stats.total) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm text-gray-600">{t('interactiveCampaigns.insights.activeEngagement')}</span>
                                  <span className="text-lg font-bold text-green-600">
                                    {reportData.stats.total > 0 ? ((reportData.stats.active / reportData.stats.total) * 100).toFixed(1) : '0'}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div
                                    className="h-full bg-gradient-to-r from-green-500 to-green-700 rounded-full"
                                    style={{ width: `${reportData.stats.total > 0 ? (reportData.stats.active / reportData.stats.total) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm text-gray-600">{t('interactiveCampaigns.report.errorRate')}</span>
                                  <span className="text-lg font-bold text-red-600">
                                    {reportData.stats.total > 0 ? ((reportData.stats.failed / reportData.stats.total) * 100).toFixed(1) : '0'}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div
                                    className="h-full bg-gradient-to-r from-red-500 to-red-700 rounded-full"
                                    style={{ width: `${reportData.stats.total > 0 ? (reportData.stats.failed / reportData.stats.total) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Principais Insights */}
                          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <span className="text-2xl">💡</span>
                              {t('interactiveCampaigns.insights.title')}
                            </h4>
                            <div className="space-y-3">
                              {reportData.flowNodes && reportData.flowNodes.length > 0 && (() => {
                                // Calcular nó com maior drop-off
                                const nodeStats = reportData.flowNodes.map((node: any, index: number) => {
                                  const reachedCount = reportData.campaign.sessions.filter((session: any) =>
                                    session.visitedNodes?.[node.id]
                                  ).length;
                                  const prevNode = index > 0 ? reportData.flowNodes[index - 1] : null;
                                  const prevReached = prevNode ? reportData.campaign.sessions.filter((session: any) =>
                                    session.visitedNodes?.[prevNode.id]
                                  ).length : reportData.stats.total;
                                  const dropOff = prevReached > 0 ? ((prevReached - reachedCount) / prevReached) * 100 : 0;
                                  return { node, dropOff, reachedCount, index };
                                });

                                const maxDropOff = nodeStats.reduce((max, curr) => curr.dropOff > max.dropOff ? curr : max, nodeStats[0]);
                                const successRate = reportData.stats.total > 0 ? (reportData.stats.completed / reportData.stats.total) * 100 : 0;

                                return (
                                  <>
                                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                                      <span className="text-2xl">📊</span>
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{t('interactiveCampaigns.insights.generalPerformance')}</p>
                                        <p className="text-xs text-gray-600 mt-1">
                                          {successRate >= 70 ? t('interactiveCampaigns.insights.excellent') : successRate >= 40 ? t('interactiveCampaigns.insights.reasonable') : t('interactiveCampaigns.insights.critical')}
                                          <span dangerouslySetInnerHTML={{ __html: t('interactiveCampaigns.insights.completionMessage', { rate: successRate.toFixed(1) }) }} />
                                        </p>
                                      </div>
                                    </div>

                                    {maxDropOff.dropOff > 10 && (
                                      <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                                        <span className="text-2xl">⚠️</span>
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-900">{t('interactiveCampaigns.insights.highestDropoff')}</p>
                                          <p className="text-xs text-gray-600 mt-1">
                                            <span dangerouslySetInnerHTML={{ __html: t('interactiveCampaigns.insights.dropoffMessage', { step: maxDropOff.index + 1, label: maxDropOff.node.label, rate: maxDropOff.dropOff.toFixed(1) }) }} />
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    {reportData.stats.failed > 0 && (
                                      <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                                        <span className="text-2xl">🔧</span>
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-900">{t('interactiveCampaigns.insights.attention')}</p>
                                          <p className="text-xs text-gray-600 mt-1">
                                            {t(reportData.stats.failed === 1 ? 'interactiveCampaigns.insights.failedMessage' : 'interactiveCampaigns.insights.failedMessage_plural', { count: reportData.stats.failed })}
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    {reportData.stats.expired > 0 && (
                                      <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                                        <span className="text-2xl">⏰</span>
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-900">{t('interactiveCampaigns.insights.expiredTitle')}</p>
                                          <p className="text-xs text-gray-600 mt-1">
                                            {t(reportData.stats.expired === 1 ? 'interactiveCampaigns.insights.expiredMessage' : 'interactiveCampaigns.insights.expiredMessage_plural', { count: reportData.stats.expired })}
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    {successRate >= 70 && reportData.stats.failed === 0 && (
                                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                                        <span className="text-2xl">🎉</span>
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-900">{t('interactiveCampaigns.insights.successTitle')}</p>
                                          <p className="text-xs text-gray-600 mt-1">
                                            {t('interactiveCampaigns.insights.successMessage')}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Resumo de Status */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="text-2xl">📋</span>
                            {t('interactiveCampaigns.report.statusSummary')}
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <div className="text-3xl mb-2">📊</div>
                              <div className="text-2xl font-bold text-gray-900">{reportData.stats.total}</div>
                              <div className="text-sm text-gray-600">{t('interactiveCampaigns.report.totalContacts')}</div>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                              <div className="text-3xl mb-2">✅</div>
                              <div className="text-2xl font-bold text-green-700">{reportData.stats.active}</div>
                              <div className="text-sm text-green-600">{t('interactiveCampaigns.report.activeSessions')}</div>
                            </div>
                            <div className="text-center p-4 bg-purple-50 rounded-lg">
                              <div className="text-3xl mb-2">🎯</div>
                              <div className="text-2xl font-bold text-purple-700">{reportData.stats.completed}</div>
                              <div className="text-sm text-purple-600">{t('interactiveCampaigns.report.completed')}</div>
                            </div>
                            <div className="text-center p-4 bg-yellow-50 rounded-lg">
                              <div className="text-3xl mb-2">⏰</div>
                              <div className="text-2xl font-bold text-yellow-700">{reportData.stats.expired}</div>
                              <div className="text-sm text-yellow-600">{t('interactiveCampaigns.report.expired')}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab Detalhes */}
                    {activeTab === 'details' && (
                      <div className="space-y-6">
                        {/* Informações da Campanha */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-lg font-semibold text-gray-900 mb-3">{reportData.campaign.name}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">{t('interactiveCampaigns.table.status')}:</span>
                              <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${reportData.campaign.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                                reportData.campaign.status === 'SCHEDULED' ? 'bg-yellow-100 text-yellow-800' :
                                  reportData.campaign.status === 'STARTED' ? 'bg-blue-100 text-blue-800' :
                                    reportData.campaign.status === 'PAUSED' ? 'bg-orange-100 text-orange-800' :
                                      'bg-green-100 text-green-800'
                                }`}>
                                {reportData.campaign.status === 'DRAFT' ? t('interactiveCampaigns.status.draft') :
                                  reportData.campaign.status === 'SCHEDULED' ? t('interactiveCampaigns.status.scheduled') :
                                    reportData.campaign.status === 'STARTED' ? t('interactiveCampaigns.status.started') :
                                      reportData.campaign.status === 'PAUSED' ? t('interactiveCampaigns.status.paused') : t('interactiveCampaigns.status.completed')}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">{t('interactiveCampaigns.report.connection')}:</span>
                              <span className="ml-2 text-gray-900">
                                {reportData.campaign.connection?.instanceName || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">{t('interactiveCampaigns.report.createdAt')}:</span>
                              <span className="ml-2 text-gray-900">{new Date(reportData.campaign.createdAt).toLocaleString(i18n.language)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Estatísticas */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-3">{t('interactiveCampaigns.report.sessionStats')}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-blue-50 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-blue-600">{reportData.stats.total}</div>
                              <div className="text-sm text-blue-800">{t('interactiveCampaigns.report.totalContacts')}</div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-green-600">{reportData.stats.active}</div>
                              <div className="text-sm text-green-800">{t('interactiveCampaigns.report.activeSessions')}</div>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-purple-600">{reportData.stats.completed}</div>
                              <div className="text-sm text-purple-800">{t('interactiveCampaigns.report.completed')}</div>
                            </div>
                            <div className="bg-red-50 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-red-600">{reportData.stats.failed}</div>
                              <div className="text-sm text-red-800">{t('interactiveCampaigns.report.failed')}</div>
                            </div>
                            <div className="bg-yellow-50 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-yellow-600">{reportData.stats.expired}</div>
                              <div className="text-sm text-yellow-800">{t('interactiveCampaigns.report.expired')}</div>
                            </div>
                          </div>
                        </div>

                        {/* Sessões Detalhadas com Nós */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-lg font-semibold text-gray-900">{t('interactiveCampaigns.report.sessionDetails')}</h4>
                            <button
                              onClick={handleExportToExcel}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                              title={t('interactiveCampaigns.report.exportExcel')}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="font-medium">{t('interactiveCampaigns.report.exportExcel')}</span>
                            </button>
                          </div>
                          <div className="bg-white border rounded-lg overflow-x-auto overflow-y-auto max-h-[400px]">
                            <table className="min-w-full divide-y divide-gray-200 table-auto">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{t('interactiveCampaigns.report.table.name')}</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-32 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{t('interactiveCampaigns.report.table.phone')}</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">{t('interactiveCampaigns.report.table.status')}</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">{t('interactiveCampaigns.report.table.reason')}</th>
                                  {/* Colunas dinâmicas para cada nó do fluxo */}
                                  {reportData.flowNodes && reportData.flowNodes.map((node: any) => (
                                    <th key={node.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                                      <div className="flex flex-col items-center">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium mb-1 ${node.type === 'text' ? 'bg-blue-100 text-blue-800' :
                                          node.type === 'image' ? 'bg-green-100 text-green-800' :
                                            node.type === 'video' ? 'bg-purple-100 text-purple-800' :
                                              node.type === 'audio' ? 'bg-yellow-100 text-yellow-800' :
                                                node.type === 'document' ? 'bg-red-100 text-red-800' :
                                                  'bg-gray-100 text-gray-800'
                                          }`}>
                                          {t(`interactiveCampaigns.nodes.${node.type}`)}
                                        </span>
                                        <span className="text-xs text-gray-600 truncate max-w-[100px]" title={node.label}>
                                          {node.label}
                                        </span>
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {reportData.campaign.sessions.map((session: any) => (
                                  <tr key={session.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{session.contactName}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 sticky left-32 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{cleanPhoneNumber(session.contactPhone)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap bg-white">
                                      <span
                                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-help ${session.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                          session.status === 'COMPLETED' ? 'bg-purple-100 text-purple-800' :
                                            session.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                              'bg-yellow-100 text-yellow-800'
                                          }`}
                                        title={session.status === 'FAILED' && session.variables?.errorReason
                                          ? `❌ ${session.variables.errorReason}`
                                          : session.status === 'ACTIVE' ? t('interactiveCampaigns.report.sessionStatus.activeTooltip') :
                                            session.status === 'COMPLETED' ? t('interactiveCampaigns.report.sessionStatus.completedTooltip') :
                                              session.status === 'FAILED' ? t('interactiveCampaigns.report.sessionStatus.failedTooltip') : t('interactiveCampaigns.report.sessionStatus.expiredTooltip')}
                                      >
                                        {session.status === 'ACTIVE' ? t('interactiveCampaigns.report.sessionStatus.active') :
                                          session.status === 'COMPLETED' ? t('interactiveCampaigns.report.sessionStatus.completed') :
                                            session.status === 'FAILED' ? t('interactiveCampaigns.report.sessionStatus.failed') : t('interactiveCampaigns.report.sessionStatus.expired')}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 bg-white max-w-xs">
                                      {session.status === 'FAILED' && session.variables?.errorReason ? (
                                        <div className="flex items-start gap-2">
                                          <span className="text-red-500 flex-shrink-0 mt-0.5">⚠️</span>
                                          <span className="text-xs text-red-600 break-words">{session.variables.errorReason}</span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400">-</span>
                                      )}
                                    </td>
                                    {/* Colunas dinâmicas com status de cada nó */}
                                    {reportData.flowNodes && reportData.flowNodes.map((node: any) => {
                                      const nodeData = session.visitedNodes?.[node.id];
                                      return (
                                        <td key={node.id} className="px-4 py-3 text-center">
                                          {nodeData ? (
                                            <div className="flex flex-col items-center gap-1">
                                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${nodeData.sent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {nodeData.sent ? `✓ ${t('interactiveCampaigns.report.sent')}` : `✗ ${t('interactiveCampaigns.report.failed')}`}
                                              </span>
                                              {nodeData.visitedAt && (
                                                <span className="text-xs text-gray-500">
                                                  {new Date(nodeData.visitedAt).toLocaleTimeString('pt-BR')}
                                                </span>
                                              )}
                                              {nodeData.error && (
                                                <span className="text-xs text-red-600 truncate max-w-[100px]" title={nodeData.error}>
                                                  {nodeData.error}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-gray-400 text-xs">-</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    {t('common.noData')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Modal de Criar Campanha */}
      <InteractiveCampaignModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateCampaign}
      />
    </div>
  );
}
