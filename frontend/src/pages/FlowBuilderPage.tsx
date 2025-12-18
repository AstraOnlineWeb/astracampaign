import { useCallback, useState, useEffect, DragEvent, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  ReactFlowProvider,
  NodeTypes,
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import toast from 'react-hot-toast';
import { Header } from '../components/Header';
import { TriggerNode } from '../components/flow-nodes/TriggerNode';
import { TextNode } from '../components/flow-nodes/TextNode';
import { ImageNode } from '../components/flow-nodes/ImageNode';
import { VideoNode } from '../components/flow-nodes/VideoNode';
import { AudioNode } from '../components/flow-nodes/AudioNode';
import { DocumentNode } from '../components/flow-nodes/DocumentNode';
import { AINode } from '../components/flow-nodes/AINode';
import { ActionNode } from '../components/flow-nodes/ActionNode';
import { ConditionNode } from '../components/flow-nodes/ConditionNode';
import { DelayNode } from '../components/flow-nodes/DelayNode';
import { HttpRestNode } from '../components/flow-nodes/HttpRestNode';
import { StopNode } from '../components/flow-nodes/StopNode';
import { IntegrationPerfexNode } from '../components/flow-nodes/IntegrationPerfexNode';
import { IntegrationChatwootNode } from '../components/flow-nodes/IntegrationChatwootNode';
import { NodeConfigSidebar } from '../components/flow-nodes/NodeConfigSidebar';
import { FlowPreviewModal } from '../components/FlowPreviewModal';
import { interactiveCampaignApi, InteractiveCampaign, Connection as ApiConnection } from '../services/interactiveCampaignApi';
import { api } from '../services/api';

// Tipos de nodes disponíveis
const NODE_TYPES_CONFIG = {
  trigger: { label: '⚡ Trigger', color: '#8ad0f3', description: 'Inicia' },
  text: { label: '📝 Texto', color: '#3ddc97', description: 'Mensagem' },
  image: { label: '🖼️ Imagem', color: '#60a5fa', description: 'Foto' },
  video: { label: '🎬 Vídeo', color: '#a78bfa', description: 'Vídeo' },
  audio: { label: '🎵 Áudio', color: '#f59e0b', description: 'Áudio' },
  document: { label: '📄 Arquivo', color: '#ec4899', description: 'Doc' },
  ai: { label: '🤖 IA', color: '#8b5cf6', description: 'IA' },
  condition: { label: '❓ Condição', color: '#ffd700', description: 'Condição' },
  delay: { label: '⏱️ Delay', color: '#ff7a7a', description: 'Espera' },
  httprest: { label: '🌐 HTTP REST', color: '#f59e0b', description: 'API' },
  stop: { label: '🛑 Stop', color: '#233e4f', description: 'Fim' },
};

// Tipos de nodes de integração (exibidos condicionalmente)
const INTEGRATION_NODES_CONFIG = {
  integration_perfex: { label: '🔧 Perfex CRM', color: '#9333ea', description: 'Integração' },
  integration_chatwoot: { label: '💬 Chatwoot', color: '#1f93ff', description: 'Integração' },
};

// Edge customizada com botão de deletar
function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const { t } = useTranslation();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = () => {
    if (data?.onDelete) {
      data.onDelete(id);
    }
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-5 h-5 bg-white hover:bg-gray-50 border border-gray-300 hover:border-red-400 text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center text-sm shadow-sm transition-all hover:scale-110"
            onClick={onEdgeClick}
            title={t('flowBuilder.actions.deleteConnection')}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function FlowBuilderPageInner() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [campaign, setCampaign] = useState<InteractiveCampaign | null>(null);
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; nome: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [integrationSettings, setIntegrationSettings] = useState<{
    hasPerfex: boolean;
    hasChatwoot: boolean;
  }>({ hasPerfex: false, hasChatwoot: false });

  // Custom node types
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      trigger: TriggerNode,
      text: TextNode,
      image: ImageNode,
      video: VideoNode,
      audio: AudioNode,
      document: DocumentNode,
      ai: AINode,
      action: ActionNode,
      condition: ConditionNode,
      delay: DelayNode,
      httprest: HttpRestNode,
      stop: StopNode,
      integration_perfex: IntegrationPerfexNode,
      integration_chatwoot: IntegrationChatwootNode,
    }),
    []
  );

  // Custom edge types
  const edgeTypes = useMemo(
    () => ({
      default: CustomEdge,
    }),
    []
  );

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [setNodes, setEdges]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  }, [setEdges]);

  useEffect(() => {
    if (id) {
      loadCampaign(id);
      loadConnections();
      loadCategories();
      loadIntegrationSettings();
    }
  }, [id]);

  const loadCampaign = async (campaignId: string) => {
    try {
      setLoading(true);
      const data = await interactiveCampaignApi.getCampaign(campaignId);
      setCampaign(data);

      if (data.graph?.nodes) {
        // Adicionar função onDelete para cada node carregado
        const nodesWithDelete = data.graph.nodes.map((node: Node) => ({
          ...node,
          data: {
            ...node.data,
            onDelete: () => handleDeleteNode(node.id),
          },
        }));
        setNodes(nodesWithDelete);

        // Adicionar função onDelete para cada edge carregada
        const edgesWithDelete = (data.graph.edges || []).map((edge: Edge) => ({
          ...edge,
          data: {
            ...edge.data,
            onDelete: handleDeleteEdge,
          },
        }));
        setEdges(edgesWithDelete);
      }
    } catch (error: any) {
      toast.error(t('flowBuilder.messages.loadError'));
      navigate('/campanhas/interativa');
    } finally {
      setLoading(false);
    }
  };

  const loadConnections = async () => {
    try {
      const data = await interactiveCampaignApi.getConnections();
      setConnections(data);
    } catch (error: any) {
      console.error('Error loading connections:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await api.getAllCategories();
      setCategories(data);
    } catch (error: any) {
      console.error('Error loading categories:', error);
      // Fallback para método paginado se getAllCategories falhar
      try {
        const response = await api.getCategories({ pageSize: 1000 });
        setCategories(response.categories);
      } catch (fallbackError: any) {
        console.error('Error loading categories (fallback):', fallbackError);
      }
    }
  };

  const loadIntegrationSettings = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const settings = await response.json();
        setIntegrationSettings({
          hasPerfex: !!(settings.perfexUrl && settings.perfexToken),
          hasChatwoot: !!(settings.chatwootUrl && settings.chatwootAccountId && settings.chatwootApiToken),
        });
      }
    } catch (error: any) {
      console.error('Error loading integration settings:', error);
    }
  };

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      const newEdge = {
        ...params,
        data: { onDelete: handleDeleteEdge },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, handleDeleteEdge]
  );

  const handleSave = async () => {
    if (!campaign) return;

    setSaving(true);

    try {
      const graph = { nodes, edges };

      // Extrair scheduledDate do nó trigger
      const triggerNode = nodes.find(n => n.data.nodeType === 'trigger');
      const triggerConfig = triggerNode?.data?.config;

      let scheduledDateTime = null;
      if (triggerConfig?.scheduleType === 'scheduled' && triggerConfig?.scheduledDate && triggerConfig?.scheduledTime) {
        scheduledDateTime = new Date(`${triggerConfig.scheduledDate}T${triggerConfig.scheduledTime}:00`);
      }

      await interactiveCampaignApi.updateCampaign(campaign.id, {
        graph,
        scheduledDate: scheduledDateTime || undefined,
      });

      toast.success(t('flowBuilder.messages.saveSuccess'));
    } catch (error: any) {
      toast.error(`${t('flowBuilder.messages.saveError')}: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!campaign) return;

    // Validar se há pelo menos um nó trigger
    const triggerNode = nodes.find(n => n.data.nodeType === 'trigger');
    if (!triggerNode) {
      toast.error(t('flowBuilder.messages.publishTriggerMissing'));
      return;
    }

    const triggerConfig = triggerNode.data.config;

    // Validar configurações do trigger
    if (!triggerConfig?.connections?.length) {
      toast.error(t('flowBuilder.messages.publishNoConnection'));
      return;
    }

    if (!triggerConfig?.categories?.length) {
      toast.error(t('flowBuilder.messages.publishNoCategory'));
      return;
    }

    // Validar agendamento se selecionado
    let scheduledDateTime = null;
    if (triggerConfig?.scheduleType === 'scheduled') {
      if (!triggerConfig?.scheduledDate || !triggerConfig?.scheduledTime) {
        toast.error(t('flowBuilder.messages.publishScheduleMissing'));
        return;
      }
      scheduledDateTime = new Date(`${triggerConfig.scheduledDate}T${triggerConfig.scheduledTime}:00`);
    }

    const message = scheduledDateTime
      ? t('flowBuilder.messages.publishConfirmScheduled', { name: campaign.name, date: scheduledDateTime.toLocaleString() })
      : t('flowBuilder.messages.publishConfirmDefault', { name: campaign.name });

    if (!confirm(message)) {
      return;
    }

    try {
      // Salvar antes de publicar
      await handleSave();

      await interactiveCampaignApi.publishCampaign(campaign.id, scheduledDateTime || undefined);

      if (scheduledDateTime) {
        toast.success(t('flowBuilder.messages.publishScheduledSuccess', { date: scheduledDateTime.toLocaleString() }));
      } else {
        toast.success(t('flowBuilder.messages.publishSuccess'));
      }

      // Recarregar
      await loadCampaign(campaign.id);
    } catch (error: any) {
      toast.error(`${t('flowBuilder.messages.publishError')}: ${error.message}`);
    }
  };

  const onDragStart = (event: DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      if (!reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const nodeId = `${type}-${Date.now()}`;

      // Buscar configuração do nó (pode estar em NODE_TYPES_CONFIG ou INTEGRATION_NODES_CONFIG)
      const nodeConfig = NODE_TYPES_CONFIG[type as keyof typeof NODE_TYPES_CONFIG] ||
        INTEGRATION_NODES_CONFIG[type as keyof typeof INTEGRATION_NODES_CONFIG];

      const newNode: Node = {
        id: nodeId,
        type: type, // Use o tipo customizado
        position,
        data: {
          label: type.startsWith('integration_') ? t(`flowBuilder.nodes.${type}.label`) : t(`flowBuilder.nodes.${type}.label`),
          nodeType: type,
          config: {}, // Configuração vazia inicialmente
          onDelete: () => handleDeleteNode(nodeId),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, handleDeleteNode]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Não abrir config para node do tipo stop
    if (node.data.nodeType !== 'stop') {
      setSelectedNode(node);
    }
  }, []);

  const handleNodeConfigSave = (nodeId: string, config: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              config,
            },
          };
        }
        return node;
      })
    );
  };

  const handleBack = () => {
    navigate('/campanhas/interativa');
  };

  const handleNameClick = () => {
    if (campaign) {
      setEditedName(campaign.name);
      setIsEditingName(true);
    }
  };

  const handleNameSave = async () => {
    if (!campaign || !id || !editedName.trim()) {
      setIsEditingName(false);
      return;
    }

    try {
      await interactiveCampaignApi.updateCampaign(id, { name: editedName.trim() });
      setCampaign({ ...campaign, name: editedName.trim() });
      await interactiveCampaignApi.updateCampaign(id, { name: editedName.trim() });
      setCampaign({ ...campaign, name: editedName.trim() });
      setIsEditingName(false);
      toast.success(t('flowBuilder.messages.nameUpdated'));
    } catch (error: any) {
      toast.error(`${t('flowBuilder.messages.nameUpdateError')}: ${error.message}`);
    }
  };

  const handleNameCancel = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-ui-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-ui-bg">
      {/* Header */}
      <Header
        title={
          isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleNameSave}
                autoFocus
                className="px-3 py-1 border-2 border-brand-primary rounded-lg text-xl font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                style={{ minWidth: '300px' }}
              />
            </div>
          ) : (
            <div
              onClick={handleNameClick}
              className="cursor-pointer hover:text-brand-primary transition-colors flex items-center gap-2 group"
              title={t('flowBuilder.actions.editName')}
            >
              <span>{campaign.name}</span>
              <svg
                className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-ui-sub"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          )
        }
        subtitle={`${campaign.connection?.instanceName} (${campaign.connection?.phoneNumber})`}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-ui-sub hover:text-ui-text transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>{t('flowBuilder.actions.back')}</span>
            </button>

            {campaign.status === 'DRAFT' && (
              <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                {t('flowBuilder.status.draft')}
              </span>
            )}
            {campaign.status === 'PUBLISHED' && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {t('flowBuilder.status.published')}
              </span>
            )}

            <button
              onClick={() => setShowPreview(true)}
              className="px-6 py-2 bg-purple-100 text-purple-700 rounded-xl font-medium hover:bg-purple-200 transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>{t('flowBuilder.actions.preview')}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-brand-secondary text-brand-primary rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-primary"></div>
                  <span>{t('flowBuilder.actions.saving')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  <span>{t('flowBuilder.actions.save')}</span>
                </>
              )}
            </button>

            {campaign.status === 'DRAFT' && (
              <button
                onClick={handlePublish}
                className="px-6 py-2 bg-brand-primary text-white rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{t('flowBuilder.actions.publish')}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Palette */}
        <aside className="w-64 bg-white border-r border-ui-border p-4 shadow-sm overflow-y-auto">
          <h2 className="text-lg font-semibold text-ui-text mb-4">{t('flowBuilder.sidebar.blocks')}</h2>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(NODE_TYPES_CONFIG).map(([nodeType, config]) => (
              <div
                key={nodeType}
                draggable
                onDragStart={(event) => onDragStart(event, nodeType)}
                className="h-14 px-2 py-2 bg-ui-bg rounded-lg border-2 border-ui-border text-ui-text hover:border-brand-secondary hover:bg-brand-secondary/5 transition-all cursor-grab active:cursor-grabbing flex flex-col justify-center"
                style={{ borderLeft: `4px solid ${config.color}` }}
              >
                <div className="font-medium text-xs truncate">{t(`flowBuilder.nodes.${nodeType}.label`)}</div>
                <div className="text-xs text-ui-sub truncate">{t(`flowBuilder.nodes.${nodeType}.description`)}</div>
              </div>
            ))}
          </div>

          {/* Integrações Externas */}
          {(integrationSettings.hasPerfex || integrationSettings.hasChatwoot) && (
            <>
              <div className="mt-6 mb-3">
                <h3 className="text-sm font-semibold text-ui-text flex items-center gap-2">
                  {t('flowBuilder.sidebar.integrations')}
                </h3>
                <div className="h-px bg-ui-border mt-2"></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {integrationSettings.hasPerfex && (
                  <div
                    key="integration_perfex"
                    draggable
                    onDragStart={(event) => onDragStart(event, 'integration_perfex')}
                    className="h-14 px-2 py-2 bg-ui-bg rounded-lg border-2 border-ui-border text-ui-text hover:border-brand-secondary hover:bg-brand-secondary/5 transition-all cursor-grab active:cursor-grabbing flex flex-col justify-center"
                    style={{ borderLeft: `4px solid ${INTEGRATION_NODES_CONFIG.integration_perfex.color}` }}
                  >
                    <div className="font-medium text-xs truncate">{t('flowBuilder.nodes.integration_perfex.label')}</div>
                    <div className="text-xs text-ui-sub truncate">{t('flowBuilder.nodes.integration_perfex.description')}</div>
                  </div>
                )}
                {integrationSettings.hasChatwoot && (
                  <div
                    key="integration_chatwoot"
                    draggable
                    onDragStart={(event) => onDragStart(event, 'integration_chatwoot')}
                    className="h-14 px-2 py-2 bg-ui-bg rounded-lg border-2 border-ui-border text-ui-text hover:border-brand-secondary hover:bg-brand-secondary/5 transition-all cursor-grab active:cursor-grabbing flex flex-col justify-center"
                    style={{ borderLeft: `4px solid ${INTEGRATION_NODES_CONFIG.integration_chatwoot.color}` }}
                  >
                    <div className="font-medium text-xs truncate">{t('flowBuilder.nodes.integration_chatwoot.label')}</div>
                    <div className="text-xs text-ui-sub truncate">{t('flowBuilder.nodes.integration_chatwoot.description')}</div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="mt-6 p-3 bg-ui-bg rounded-lg border border-ui-border">
            <h3 className="text-sm font-medium text-ui-text mb-2">💡 Dicas</h3>
            <ul className="text-xs text-ui-sub space-y-1">
              <li>• <strong>Arraste</strong> blocos para o canvas</li>
              <li>• <strong>Conecte</strong> blocos arrastando entre eles</li>
              <li>• <strong>Clique</strong> em um bloco para configurar</li>
              <li>• Use <strong>scroll</strong> para zoom</li>
              <li>• Salve antes de publicar</li>
            </ul>
          </div>
        </aside>

        {/* Flow Builder */}
        <main className="flex-1 relative bg-gray-50">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <MiniMap
              nodeColor={(node) => {
                const nodeType = node.data.nodeType;
                // Verificar primeiro nos nós de integração
                if (INTEGRATION_NODES_CONFIG[nodeType as keyof typeof INTEGRATION_NODES_CONFIG]) {
                  return INTEGRATION_NODES_CONFIG[nodeType as keyof typeof INTEGRATION_NODES_CONFIG].color;
                }
                // Depois verificar nos nós padrão
                return NODE_TYPES_CONFIG[nodeType as keyof typeof NODE_TYPES_CONFIG]?.color || '#233e4f';
              }}
              zoomable
              pannable
            />
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </main>

        {/* Config Sidebar */}
        {selectedNode && (
          <NodeConfigSidebar
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            connections={connections}
            categories={categories}
            onClose={() => setSelectedNode(null)}
            onSave={handleNodeConfigSave}
          />
        )}

        {showPreview && (
          <FlowPreviewModal
            nodes={nodes}
            edges={edges}
            onClose={() => setShowPreview(false)}
          />
        )}
      </div>
    </div>
  );
}

export function FlowBuilderPage() {
  return (
    <ReactFlowProvider>
      <FlowBuilderPageInner />
    </ReactFlowProvider>
  );
}
