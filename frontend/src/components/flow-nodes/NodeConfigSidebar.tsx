import { useState, useEffect, useRef } from 'react';
import { Node, Edge } from 'reactflow';
import { useTranslation } from 'react-i18next';
import { Connection } from '../../services/interactiveCampaignApi';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface Category {
  id: string;
  nome: string;
}

interface NodeConfigSidebarProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  connections: Connection[];
  categories?: Category[];
  onClose: () => void;
  onSave: (nodeId: string, config: any) => void;
}

export function NodeConfigSidebar({ node, nodes, edges, connections, categories = [], onClose, onSave }: NodeConfigSidebarProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<any>(() => {
    const nodeConfig = node?.data?.config || {};
    // Se for um nó de ação e não tem actionType definido, definir como 'text' por padrão
    if (node?.data?.nodeType === 'action' && !nodeConfig.actionType) {
      return { ...nodeConfig, actionType: 'text' };
    }
    return nodeConfig;
  });
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: boolean }>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<'single' | number>('single');
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Estado para teste de API
  const [apiTestResponse, setApiTestResponse] = useState<any>(null);
  const [apiTestError, setApiTestError] = useState<string | null>(null);
  const [testingApi, setTestingApi] = useState(false);

  // Estado para importar cURL
  const [showCurlImport, setShowCurlImport] = useState(false);
  const [curlCommand, setCurlCommand] = useState('');

  // Estado para autocomplete de variáveis
  const [showVariableSuggestions, setShowVariableSuggestions] = useState(false);
  const [variableSuggestions, setVariableSuggestions] = useState<Array<{ name: string; description: string }>>([]);
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 });
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [currentInputRef, setCurrentInputRef] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const nodeConfig = node?.data?.config || {};
    // Se for um nó de ação e não tem actionType definido, definir como 'text' por padrão
    if (node?.data?.nodeType === 'action' && !nodeConfig.actionType) {
      setConfig({ ...nodeConfig, actionType: 'text' });
    } else {
      setConfig(nodeConfig);
    }
  }, [node]);

  // Fechar emoji picker ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  if (!node) return null;

  const handleSave = () => {
    onSave(node.id, config);
    onClose();
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;

    if (emojiPickerTarget === 'single') {
      // Inserir emoji no texto único
      const currentText = config.content || '';
      const textarea = textareaRef.current;

      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = currentText.substring(0, start) + emoji + currentText.substring(end);
        setConfig({ ...config, content: newText });

        // Restaurar a posição do cursor após o emoji
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + emoji.length, start + emoji.length);
        }, 0);
      } else {
        setConfig({ ...config, content: currentText + emoji });
      }
    } else {
      // Inserir emoji em uma variação específica
      const variations = config.textVariations || [''];
      const currentText = variations[emojiPickerTarget] || '';
      const newVariations = [...variations];
      newVariations[emojiPickerTarget] = currentText + emoji;
      setConfig({ ...config, textVariations: newVariations });
    }

    setShowEmojiPicker(false);
  };

  const handleFileUpload = async (file: File, variationIndex?: number) => {
    const uploadKey = variationIndex !== undefined ? `variation-${variationIndex}` : 'single';
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

      if (variationIndex !== undefined) {
        // Upload para variação
        const newVariations = [...(config.mediaVariations || [])];
        while (newVariations.length <= variationIndex) {
          newVariations.push({ url: '', caption: '', fileName: '' });
        }
        newVariations[variationIndex] = {
          ...newVariations[variationIndex],
          url: data.fileUrl,
          fileName: data.originalName
        };
        setConfig({ ...config, mediaVariations: newVariations });
      } else {
        // Upload para modo single
        setConfig({ ...config, mediaUrl: data.fileUrl, fileName: data.originalName });
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert(error instanceof Error ? error.message : t('flowBuilder.sidebar.config.errors.uploadError'));
    } finally {
      setUploadingFiles(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const handleRemoveFile = (variationIndex?: number) => {
    if (variationIndex !== undefined) {
      const newVariations = [...(config.mediaVariations || [])];
      newVariations[variationIndex] = { url: '', caption: '', fileName: '' };
      setConfig({ ...config, mediaVariations: newVariations });
    } else {
      setConfig({ ...config, mediaUrl: '', fileName: '' });
    }
  };

  const renderTriggerConfig = () => (
    <div className="space-y-6">
      {/* Tipo de Início da Campanha */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Início da Campanha
        </h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="immediate"
              name="scheduleType"
              value="immediate"
              checked={config.scheduleType === 'immediate' || !config.scheduleType}
              onChange={(e) => setConfig({ ...config, scheduleType: e.target.value, scheduledDate: undefined, scheduledTime: undefined })}
              className="text-brand-primary focus:ring-brand-primary"
            />
            <label htmlFor="immediate" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center">
              <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Início Imediato
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="scheduled"
              name="scheduleType"
              value="scheduled"
              checked={config.scheduleType === 'scheduled'}
              onChange={(e) => setConfig({ ...config, scheduleType: e.target.value })}
              className="text-brand-primary focus:ring-brand-primary"
            />
            <label htmlFor="scheduled" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center">
              <svg className="w-4 h-4 mr-1 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Agendar Envio
            </label>
          </div>

          {config.scheduleType === 'scheduled' && (
            <div className="mt-3 space-y-2 pl-6">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                <input
                  type="date"
                  value={config.scheduledDate || ''}
                  onChange={(e) => setConfig({ ...config, scheduledDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
                <input
                  type="time"
                  value={config.scheduledTime || ''}
                  onChange={(e) => setConfig({ ...config, scheduledTime: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              {config.scheduledDate && config.scheduledTime && (
                <div className="mt-2 p-2 bg-white rounded border border-brand-secondary text-xs">
                  <div className="text-gray-600">Agendado para:</div>
                  <div className="text-gray-800 font-medium">
                    {new Date(`${config.scheduledDate}T${config.scheduledTime}`).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Categorias de Contatos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Categorias de Contatos
          </label>
          {categories.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const allSelected = config.categories?.length === categories.length;
                setConfig({
                  ...config,
                  categories: allSelected ? [] : categories.map(c => c.id)
                });
              }}
              className="text-xs px-2 py-1 text-brand-primary hover:text-brand-primary/80 hover:bg-brand-secondary/10 rounded transition-colors font-medium"
            >
              {config.categories?.length === categories.length ? '✓ Desmarcar Todos' : '☐ Selecionar Todos'}
            </button>
          )}
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
          {categories.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">Nenhuma categoria disponível</p>
          ) : (
            categories.map((cat) => (
              <label key={cat.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.categories?.includes(cat.id) || false}
                  onChange={(e) => {
                    const newCategories = e.target.checked
                      ? [...(config.categories || []), cat.id]
                      : (config.categories || []).filter((id: string) => id !== cat.id);
                    setConfig({ ...config, categories: newCategories });
                  }}
                  className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700">{cat.nome}</div>
                </div>
              </label>
            ))
          )}
        </div>
        {!config.categories?.length && (
          <p className="text-xs text-orange-600 mt-1">⚠️ Selecione ao menos uma categoria</p>
        )}
      </div>

      {/* Conexões WhatsApp */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Conexões WhatsApp
          </label>
          {connections.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const allSelected = config.connections?.length === connections.length;
                setConfig({
                  ...config,
                  connections: allSelected ? [] : connections.map(c => c.id)
                });
              }}
              className="text-xs px-2 py-1 text-brand-primary hover:text-brand-primary/80 hover:bg-brand-secondary/10 rounded transition-colors font-medium"
            >
              {config.connections?.length === connections.length ? '✓ Desmarcar Todos' : '☐ Selecionar Todos'}
            </button>
          )}
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
          {connections.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">Nenhuma conexão disponível</p>
          ) : (
            connections.map((conn) => (
              <label key={conn.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.connections?.includes(conn.id) || false}
                  onChange={(e) => {
                    const newConnections = e.target.checked
                      ? [...(config.connections || []), conn.id]
                      : (config.connections || []).filter((id: string) => id !== conn.id);
                    setConfig({ ...config, connections: newConnections });
                  }}
                  className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700">{conn.instanceName}</div>
                  <div className="text-xs text-gray-500">{conn.phoneNumber}</div>
                </div>
              </label>
            ))
          )}
        </div>
        {!config.connections?.length && (
          <p className="text-xs text-orange-600 mt-1">⚠️ Selecione ao menos uma conexão</p>
        )}
      </div>
    </div>
  );

  const renderActionConfig = () => {
    const isMediaType = ['image', 'video', 'audio', 'document'].includes(config.actionType || 'text');

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Ação
          </label>
          <select
            value={config.actionType || 'text'}
            onChange={(e) => {
              const newType = e.target.value;
              // Limpar config ao mudar tipo
              setConfig({
                actionType: newType
              });
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="text">📝 Texto</option>
            <option value="image">🖼️ Imagem</option>
            <option value="video">🎬 Vídeo</option>
            <option value="audio">🎵 Áudio</option>
            <option value="document">📄 Arquivo</option>
            <option value="openai">🤖 OpenAI</option>
            <option value="groq">⚡ Groq AI</option>
          </select>
        </div>

        {/* TIPO: TEXTO */}
        {config.actionType === 'text' && (
          <>
            <div className="space-y-3">
              {/* Checkbox para usar variações */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useTextVariations"
                  checked={config.useTextVariations || false}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      useTextVariations: e.target.checked,
                      textVariations: e.target.checked ? [''] : undefined,
                      content: e.target.checked ? undefined : config.content
                    });
                  }}
                  className="rounded text-brand-primary focus:ring-brand-primary"
                />
                <label htmlFor="useTextVariations" className="text-sm font-medium text-gray-700">
                  Usar variações de texto
                </label>
              </div>

              {config.useTextVariations ? (
                /* Modo variações */
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Variações de texto
                  </label>
                  {(config.textVariations || ['']).map((variation: string, index: number) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1 relative">
                        <textarea
                          placeholder={`Variação ${index + 1}... Use variáveis como {{nome}}, {{telefone}}`}
                          value={variation}
                          onChange={(e) => {
                            const newVariations = [...(config.textVariations || [''])];
                            newVariations[index] = e.target.value;
                            setConfig({ ...config, textVariations: newVariations });
                          }}
                          className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                          rows={2}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEmojiPickerTarget(index);
                            setShowEmojiPicker(!showEmojiPicker || emojiPickerTarget !== index);
                          }}
                          className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                          title={t('flowBuilder.sidebar.config.addEmoji')}
                        >
                          😊
                        </button>
                        {showEmojiPicker && emojiPickerTarget === index && (
                          <div ref={emojiPickerRef} className="absolute z-50 top-12 right-0">
                            <EmojiPicker onEmojiClick={handleEmojiClick} />
                          </div>
                        )}
                      </div>
                      {(config.textVariations || ['']).length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newVariations = [...(config.textVariations || [''])];
                            newVariations.splice(index, 1);
                            setConfig({ ...config, textVariations: newVariations });
                          }}
                          className="px-2 py-1 text-red-600 hover:text-red-800"
                          title={t('flowBuilder.sidebar.config.removeVariation')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const newVariations = [...(config.textVariations || ['']), ''];
                      setConfig({ ...config, textVariations: newVariations });
                    }}
                    className="px-3 py-1 bg-blue-100 text-blue-600 text-sm rounded hover:bg-blue-200 flex items-center gap-1"
                  >
                    <span>+</span>
                    Nova variação
                  </button>
                </div>
              ) : (
                /* Modo texto único */
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensagem
                  </label>
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={config.content || ''}
                      onChange={(e) => setConfig({ ...config, content: e.target.value })}
                      placeholder={t('flowBuilder.sidebar.config.messagePlaceholder')}
                      rows={6}
                      className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEmojiPickerTarget('single');
                        setShowEmojiPicker(!showEmojiPicker);
                      }}
                      className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Adicionar emoji"
                    >
                      😊
                    </button>
                    {showEmojiPicker && emojiPickerTarget === 'single' && (
                      <div ref={emojiPickerRef} className="absolute z-50 top-12 right-0">
                        <EmojiPicker onEmojiClick={handleEmojiClick} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Variáveis disponíveis - FORA do condicional ternário */}
            <div className="flex flex-wrap gap-2 items-center mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-xs font-medium text-gray-600">Variáveis disponíveis:</span>
              {['{{nome}}', '{{telefone}}'].map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => {
                    if (config.useTextVariations) {
                      const variations = config.textVariations || [''];
                      let targetIndex = variations.findIndex((v: string) => !v.trim());
                      if (targetIndex === -1) targetIndex = 0;
                      const newVariations = [...variations];
                      newVariations[targetIndex] = (newVariations[targetIndex] || '') + variable;
                      setConfig({ ...config, textVariations: newVariations });
                    } else {
                      const currentText = config.content || '';
                      setConfig({ ...config, content: currentText + variable });
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                >
                  {variable}
                </button>
              ))}
            </div>
          </>
        )}

        {/* TIPO: IMAGEM, VIDEO, AUDIO, DOCUMENTO */}
        {isMediaType && (
          <div className="space-y-3">
            {/* Checkbox para usar variações */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="useMediaVariations"
                checked={config.useMediaVariations || false}
                onChange={(e) => {
                  setConfig({
                    ...config,
                    useMediaVariations: e.target.checked,
                    mediaVariations: e.target.checked
                      ? Array.from({ length: 4 }, () => ({ url: '', caption: '', fileName: '' }))
                      : undefined,
                    mediaUrl: e.target.checked ? '' : config.mediaUrl
                  });
                }}
                className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-sm text-gray-600">Usar Variações</span>
            </div>

            {config.useMediaVariations ? (
              /* Grid horizontal de 4 variações */
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }, (_, varIndex) => {
                  const mediaVariations = config.mediaVariations || [];
                  const variation = mediaVariations[varIndex] || { url: '', caption: '', fileName: '' };
                  const hasFile = variation.url;
                  const uploadKey = `variation-${varIndex}`;
                  const isUploading = uploadingFiles[uploadKey];

                  return (
                    <div key={varIndex} className="space-y-2">
                      {/* Header da variação */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">
                          {varIndex === 0 ? 'Principal' : `Var. ${varIndex + 1}`}
                        </span>
                        {hasFile && varIndex > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(varIndex)}
                            className="text-red-500 hover:text-red-700 text-xs p-0.5"
                            title={t('flowBuilder.sidebar.config.remove')}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Área de Upload */}
                      {!hasFile ? (
                        <>
                          <input
                            type="file"
                            id={`file-upload-var-${varIndex}`}
                            className="hidden"
                            accept={
                              config.actionType === 'image' ? 'image/*' :
                              config.actionType === 'video' ? 'video/*' :
                              config.actionType === 'audio' ? 'audio/*' :
                              'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip'
                            }
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file, varIndex);
                              }
                            }}
                            disabled={isUploading}
                          />
                          <label
                            htmlFor={`file-upload-var-${varIndex}`}
                            className={`block aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                              isUploading
                                ? 'border-gray-200 bg-gray-100 cursor-not-allowed'
                                : 'border-gray-300 hover:border-brand-primary hover:bg-brand-secondary/10'
                            }`}
                          >
                            {isUploading ? (
                              <div className="flex flex-col items-center gap-1">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div>
                                <span className="text-xs text-gray-500">Enviando...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <div className="text-2xl">
                                  {config.actionType === 'image' && '🖼️'}
                                  {config.actionType === 'video' && '🎬'}
                                  {config.actionType === 'audio' && '🎵'}
                                  {config.actionType === 'document' && '📄'}
                                </div>
                                <span className="text-xs text-center text-gray-500 px-2">Clique para fazer upload</span>
                              </div>
                            )}
                          </label>
                        </>
                      ) : (
                        <div className="aspect-square border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                          {config.actionType === 'image' ? (
                            <img src={variation.url} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <div className="text-3xl">
                                {config.actionType === 'video' && '🎬'}
                                {config.actionType === 'audio' && '🎵'}
                                {config.actionType === 'document' && '📄'}
                              </div>
                              <span className="text-xs text-gray-600 px-2 text-center">{variation.fileName || 'Arquivo'}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Campo de legenda para imagem e vídeo */}
                      {hasFile && ['image', 'video'].includes(config.actionType) && (
                        <input
                          type="text"
                          placeholder="Legenda..."
                          value={variation.caption || ''}
                          onChange={(e) => {
                            const newVariations = [...(config.mediaVariations || [])];
                            while (newVariations.length <= varIndex) {
                              newVariations.push({ url: '', caption: '', fileName: '' });
                            }
                            newVariations[varIndex] = { ...newVariations[varIndex], caption: e.target.value };
                            setConfig({ ...config, mediaVariations: newVariations });
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Interface de arquivo único */
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Arquivo
                  </label>
                  {!config.mediaUrl ? (
                    <>
                      <input
                        type="file"
                        id="file-upload-single"
                        className="hidden"
                        accept={
                          config.actionType === 'image' ? 'image/*' :
                          config.actionType === 'video' ? 'video/*' :
                          config.actionType === 'audio' ? 'audio/*' :
                          'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip'
                        }
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(file);
                          }
                        }}
                        disabled={uploadingFiles['single']}
                      />
                      <label
                        htmlFor="file-upload-single"
                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          uploadingFiles['single']
                            ? 'border-gray-200 bg-gray-100 cursor-not-allowed'
                            : 'border-gray-300 hover:border-brand-primary hover:bg-brand-secondary/10'
                        }`}
                      >
                        {uploadingFiles['single'] ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                            <span className="text-sm text-gray-500">Enviando arquivo...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-3xl">📁</div>
                            <span className="text-sm font-medium text-gray-700">Clique para fazer upload do arquivo</span>
                            <span className="text-xs text-gray-500">
                              {config.actionType === 'image' && 'Imagens: JPG, PNG, GIF, WebP'}
                              {config.actionType === 'video' && 'Vídeos: MP4, AVI, MOV, WMV, MKV'}
                              {config.actionType === 'audio' && 'Áudios: MP3, WAV, OGG, AAC, M4A'}
                              {config.actionType === 'document' && 'Documentos: PDF, DOC, XLS, TXT, ZIP'}
                            </span>
                          </div>
                        )}
                      </label>
                    </>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {config.actionType === 'image' ? (
                            <img src={config.mediaUrl} alt="Preview" className="w-12 h-12 object-cover rounded" />
                          ) : (
                            <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center text-2xl">
                              {config.actionType === 'video' && '🎬'}
                              {config.actionType === 'audio' && '🎵'}
                              {config.actionType === 'document' && '📄'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {config.fileName || 'Arquivo carregado'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile()}
                          className="text-red-600 hover:text-red-800 p-1"
                          title={t('flowBuilder.sidebar.config.removeFile')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {['image', 'video'].includes(config.actionType) && config.mediaUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Legenda (opcional)
                    </label>
                    <textarea
                      value={config.caption || ''}
                      onChange={(e) => setConfig({ ...config, caption: e.target.value })}
                      placeholder="Legenda da mídia..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                    />
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-xs text-gray-500">Variáveis:</span>
                      {['{{nome}}', '{{telefone}}'].map((variable) => (
                        <button
                          key={variable}
                          type="button"
                          onClick={() => {
                            const currentCaption = config.caption || '';
                            setConfig({ ...config, caption: currentCaption + variable });
                          }}
                          className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded hover:bg-blue-200"
                        >
                          {variable}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TIPO: OPENAI */}
        {config.actionType === 'openai' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt do Sistema
              </label>
              <textarea
                value={config.systemPrompt || ''}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                placeholder="Ex: Você é um assistente prestativo que responde perguntas..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt do Usuário
              </label>
              <textarea
                value={config.userPrompt || ''}
                onChange={(e) => setConfig({ ...config, userPrompt: e.target.value })}
                placeholder="Ex: Escreva uma mensagem de boas-vindas para {{nome}}..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use variáveis: {'{{nome}}, {{telefone}}'}
              </p>
            </div>
          </div>
        )}

        {/* TIPO: GROQ */}
        {config.actionType === 'groq' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt do Sistema
              </label>
              <textarea
                value={config.systemPrompt || ''}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                placeholder="Ex: Você é um assistente prestativo que responde perguntas..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt do Usuário
              </label>
              <textarea
                value={config.userPrompt || ''}
                onChange={(e) => setConfig({ ...config, userPrompt: e.target.value })}
                placeholder="Ex: Escreva uma mensagem de boas-vindas para {{nome}}..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use variáveis: {'{{nome}}, {{telefone}}'}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizar configuração de nó de Texto
  const renderTextConfig = () => {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {/* Checkbox para usar variações */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="useTextVariations"
              checked={config.useTextVariations || false}
              onChange={(e) => {
                setConfig({
                  ...config,
                  useTextVariations: e.target.checked,
                  textVariations: e.target.checked ? [''] : undefined,
                  content: e.target.checked ? undefined : config.content
                });
              }}
              className="rounded text-brand-primary focus:ring-brand-primary"
            />
            <label htmlFor="useTextVariations" className="text-sm font-medium text-gray-700">
              Usar variações de texto
            </label>
          </div>

          {config.useTextVariations ? (
            /* Modo variações */
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Variações de texto
              </label>
              {(config.textVariations || ['']).map((variation: string, index: number) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      placeholder={`Variação ${index + 1}... Use variáveis como {{nome}}, {{telefone}} ou digite {{ para ver sugestões`}
                      value={variation}
                      onChange={(e) => {
                        const newVariations = [...(config.textVariations || [''])];
                        newVariations[index] = e.target.value;
                        setConfig({ ...config, textVariations: newVariations });
                        handleInputChange(e, 'textVariations');
                      }}
                      onKeyDown={handleInputKeyDown}
                      className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                      rows={2}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEmojiPickerTarget(index);
                        setShowEmojiPicker(!showEmojiPicker || emojiPickerTarget !== index);
                      }}
                      className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                      title="Adicionar emoji"
                    >
                      😊
                    </button>
                    {showEmojiPicker && emojiPickerTarget === index && (
                      <div ref={emojiPickerRef} className="absolute z-50 top-12 right-0">
                        <EmojiPicker onEmojiClick={handleEmojiClick} />
                      </div>
                    )}
                  </div>
                  {(config.textVariations || ['']).length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newVariations = [...(config.textVariations || [''])];
                        newVariations.splice(index, 1);
                        setConfig({ ...config, textVariations: newVariations });
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
                  const newVariations = [...(config.textVariations || ['']), ''];
                  setConfig({ ...config, textVariations: newVariations });
                }}
                className="px-3 py-1 bg-blue-100 text-blue-600 text-sm rounded hover:bg-blue-200 flex items-center gap-1"
              >
                <span>+</span>
                Nova variação
              </button>
            </div>
          ) : (
            /* Modo texto único */
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mensagem
              </label>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={config.content || ''}
                  onChange={(e) => handleInputChange(e, 'content')}
                  onKeyDown={handleInputKeyDown}
                  placeholder={t('flowBuilder.sidebar.config.messagePlaceholderWithVars')}
                  rows={6}
                  className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setEmojiPickerTarget('single');
                    setShowEmojiPicker(!showEmojiPicker);
                  }}
                  className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Adicionar emoji"
                >
                  😊
                </button>
                {showEmojiPicker && emojiPickerTarget === 'single' && (
                  <div ref={emojiPickerRef} className="absolute z-50 top-12 right-0">
                    <EmojiPicker onEmojiClick={handleEmojiClick} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Variáveis disponíveis */}
        <div className="flex flex-wrap gap-2 items-center mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <span className="text-xs font-medium text-gray-600">Variáveis disponíveis:</span>
          {['{{nome}}', '{{telefone}}'].map((variable) => (
            <button
              key={variable}
              type="button"
              onClick={() => {
                if (config.useTextVariations) {
                  const variations = config.textVariations || [''];
                  let targetIndex = variations.findIndex((v: string) => !v.trim());
                  if (targetIndex === -1) targetIndex = 0;
                  const newVariations = [...variations];
                  newVariations[targetIndex] = (newVariations[targetIndex] || '') + variable;
                  setConfig({ ...config, textVariations: newVariations });
                } else {
                  const currentText = config.content || '';
                  setConfig({ ...config, content: currentText + variable });
                }
              }}
              className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              {variable}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Renderizar configuração para nós de mídia com função renderGenericMediaConfig
  const renderGenericMediaConfig = (mediaType: 'image' | 'video' | 'audio' | 'document', label: string, icon: string, accept: string) => {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {/* Checkbox para usar variações */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="useMediaVariations"
              checked={config.useMediaVariations || false}
              onChange={(e) => {
                setConfig({
                  ...config,
                  useMediaVariations: e.target.checked,
                  mediaVariations: e.target.checked
                    ? Array.from({ length: 4 }, () => ({ url: '', caption: '', fileName: '' }))
                    : undefined,
                  mediaUrl: e.target.checked ? '' : config.mediaUrl
                });
              }}
              className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
            />
            <span className="text-sm text-gray-600">Usar Variações</span>
          </div>

          {config.useMediaVariations ? (
            /* Grid horizontal de 4 variações */
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }, (_, varIndex) => {
                const mediaVariations = config.mediaVariations || [];
                const variation = mediaVariations[varIndex] || { url: '', caption: '', fileName: '' };
                const hasFile = variation.url;
                const uploadKey = `variation-${varIndex}`;
                const isUploading = uploadingFiles[uploadKey];

                return (
                  <div key={varIndex} className="space-y-2">
                    {/* Header da variação */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">
                        {varIndex === 0 ? 'Principal' : `Var. ${varIndex + 1}`}
                      </span>
                      {hasFile && varIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(varIndex)}
                          className="text-red-500 hover:text-red-700 text-xs p-0.5"
                          title="Remover"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Área de Upload */}
                    {!hasFile ? (
                      <>
                        <input
                          type="file"
                          id={`file-upload-var-${varIndex}`}
                          className="hidden"
                          accept={accept}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(file, varIndex);
                            }
                          }}
                          disabled={isUploading}
                        />
                        <label
                          htmlFor={`file-upload-var-${varIndex}`}
                          className={`block aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                            isUploading
                              ? 'border-gray-200 bg-gray-100 cursor-not-allowed'
                              : 'border-gray-300 hover:border-brand-primary hover:bg-brand-secondary/10'
                          }`}
                        >
                          {isUploading ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div>
                              <span className="text-xs text-gray-500">Enviando...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-2xl">{icon}</div>
                              <span className="text-xs text-center text-gray-500 px-2">Clique para fazer upload</span>
                            </div>
                          )}
                        </label>
                      </>
                    ) : (
                      <div className="aspect-square border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                        {mediaType === 'image' ? (
                          <img src={variation.url} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-3xl">{icon}</div>
                            <span className="text-xs text-gray-600 px-2 text-center">{variation.fileName || 'Arquivo'}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Campo de legenda para imagem e vídeo */}
                    {hasFile && ['image', 'video'].includes(mediaType) && (
                      <input
                        type="text"
                        placeholder="Legenda..."
                        value={variation.caption || ''}
                        onChange={(e) => {
                          const newVariations = [...(config.mediaVariations || [])];
                          while (newVariations.length <= varIndex) {
                            newVariations.push({ url: '', caption: '', fileName: '' });
                          }
                          newVariations[varIndex] = { ...newVariations[varIndex], caption: e.target.value };
                          setConfig({ ...config, mediaVariations: newVariations });
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Interface de arquivo único */
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {label}
                </label>
                {!config.mediaUrl ? (
                  <>
                    <input
                      type="file"
                      id="file-upload-single"
                      className="hidden"
                      accept={accept}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(file);
                        }
                      }}
                      disabled={uploadingFiles['single']}
                    />
                    <label
                      htmlFor="file-upload-single"
                      className={`block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition-colors ${
                        uploadingFiles['single']
                          ? 'bg-gray-100 cursor-not-allowed'
                          : 'hover:border-brand-primary hover:bg-brand-secondary/10'
                      }`}
                    >
                      {uploadingFiles['single'] ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                          <span className="text-sm text-gray-600">Fazendo upload...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-4xl">{icon}</div>
                          <span className="text-sm text-gray-600">
                            Clique para fazer upload ou arraste o arquivo aqui
                          </span>
                        </div>
                      )}
                    </label>
                  </>
                ) : (
                  <div className="relative border rounded-lg p-4 bg-gray-50">
                    {mediaType === 'image' ? (
                      <img src={config.mediaUrl} alt="Preview" className="max-w-full h-auto rounded" />
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{icon}</div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{config.fileName || 'Arquivo carregado'}</p>
                            <p className="text-xs text-gray-500">{label}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile()}
                          className="text-red-500 hover:text-red-700 p-2"
                          title={t('flowBuilder.sidebar.config.removeFile')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Campo de legenda para imagem e vídeo */}
              {config.mediaUrl && ['image', 'video'].includes(mediaType) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Legenda (opcional)
                  </label>
                  <input
                    type="text"
                    value={config.caption || ''}
                    onChange={(e) => setConfig({ ...config, caption: e.target.value })}
                    placeholder={t('flowBuilder.sidebar.config.mediaCaptionPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderImageConfig = () => renderGenericMediaConfig('image', 'Imagem', '🖼️', 'image/*');
  const renderVideoConfig = () => renderGenericMediaConfig('video', 'Vídeo', '🎬', 'video/*');
  const renderAudioConfig = () => renderGenericMediaConfig('audio', 'Áudio', '🎵', 'audio/*');
  const renderDocumentConfig = () => renderGenericMediaConfig('document', 'Arquivo', '📄', 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip');

  // Renderizar configuração de nó de IA
  const renderAIConfig = () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Provedor de IA
          </label>
          <select
            value={config.aiProvider || 'openai'}
            onChange={(e) => setConfig({ ...config, aiProvider: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="openai">🤖 OpenAI</option>
            <option value="groq">⚡ Groq AI</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prompt/Instrução
          </label>
          <textarea
            value={config.prompt || ''}
            onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
            placeholder={t('flowBuilder.sidebar.config.aiPromptPlaceholder')}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
          />
          <p className="text-xs text-gray-500 mt-2">
            Use variáveis: {'{{nome}}, {{telefone}}, {{mensagem_usuario}}'}
          </p>
        </div>
      </div>
    );
  };

  const renderConditionConfig = () => {
    const mode = config.mode || 'simple';
    const cases = config.cases || [];

    const addCase = () => {
      setConfig({
        ...config,
        cases: [...cases, { value: '', label: '', conditionType: 'equals' }],
      });
    };

    const removeCase = (index: number) => {
      setConfig({
        ...config,
        cases: cases.filter((_: any, i: number) => i !== index),
      });
    };

    const updateCase = (index: number, field: string, value: any) => {
      const newCases = [...cases];
      newCases[index] = { ...newCases[index], [field]: value };
      setConfig({ ...config, cases: newCases });
    };

    return (
      <div className="space-y-4">
        {/* Modo: Simples ou Switch */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Modo
          </label>
          <select
            value={mode}
            onChange={(e) => setConfig({ ...config, mode: e.target.value, cases: e.target.value === 'switch' ? [] : undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="simple">Simples (Verdadeiro/Falso)</option>
            <option value="switch">Switch (Múltiplas Condições)</option>
          </select>
        </div>

        {mode === 'simple' ? (
          // Configuração simples
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Condição
              </label>
              <select
                value={config.conditionType || 'contains'}
                onChange={(e) => setConfig({ ...config, conditionType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="contains">Contém texto</option>
                <option value="equals">Igual a</option>
                <option value="regex">Expressão regular</option>
                <option value="variable">Comparar variável</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor a comparar
              </label>
              <input
                type="text"
                value={config.value || ''}
                onChange={(e) => setConfig({ ...config, value: e.target.value })}
                placeholder={
                  config.conditionType === 'regex'
                    ? 'Ex: ^[0-9]+$'
                    : config.conditionType === 'variable'
                    ? 'Ex: {{status}}'
                    : 'Ex: sim'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                💡 Conecte a saída <strong>verde</strong> (verdadeiro) e <strong>vermelha</strong> (falso) a blocos diferentes.
              </p>
            </div>
          </>
        ) : (
          // Configuração switch
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Condições ({cases.length})
                </label>
                <button
                  type="button"
                  onClick={addCase}
                  className="text-xs px-3 py-1 bg-brand-primary text-white rounded-lg hover:opacity-90"
                >
                  + Adicionar
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {cases.map((caseItem: any, index: number) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Condição {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeCase(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Rótulo (exibido no node)
                      </label>
                      <input
                        type="text"
                        value={caseItem.label || ''}
                        onChange={(e) => updateCase(index, 'label', e.target.value)}
                        placeholder="Ex: Opção 1, Sim, Não"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Tipo
                      </label>
                      <select
                        value={caseItem.conditionType || 'equals'}
                        onChange={(e) => updateCase(index, 'conditionType', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      >
                        <option value="equals">Igual a</option>
                        <option value="contains">Contém</option>
                        <option value="regex">Regex</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Valor
                      </label>
                      <input
                        type="text"
                        value={caseItem.value || ''}
                        onChange={(e) => updateCase(index, 'value', e.target.value)}
                        placeholder={t('flowBuilder.sidebar.config.compareValuePlaceholder')}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      />
                    </div>
                  </div>
                ))}

                {cases.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {t('flowBuilder.sidebar.config.noConditions')}
                  </p>
                )}
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                💡 Cada condição terá uma saída <strong>colorida</strong>. A saída <strong>cinza</strong> é executada se nenhuma condição for atendida (padrão).
              </p>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderDelayConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tempo
        </label>
        <input
          type="number"
          min="1"
          value={config.value || 1}
          onChange={(e) => setConfig({ ...config, value: parseInt(e.target.value) || 1 })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Unidade
        </label>
        <select
          value={config.unit || 'seconds'}
          onChange={(e) => setConfig({ ...config, unit: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <option value="seconds">Segundos</option>
          <option value="minutes">Minutos</option>
          <option value="hours">Horas</option>
          <option value="days">Dias</option>
        </select>
      </div>
    </div>
  );

  // Função para parsear comando cURL
  const parseCurlCommand = (curl: string) => {
    try {
      // Limpar comando e remover quebras de linha com \
      let cmd = curl.trim().replace(/\\\s*\n\s*/g, ' ');

      // Remover 'curl' do início
      cmd = cmd.replace(/^curl\s+/i, '');

      // Extrair URL (procurar por http:// ou https://)
      let url = '';
      const urlMatch1 = cmd.match(/["']([^"']*(?:https?:\/\/)[^"']*)["']/);
      const urlMatch2 = cmd.match(/(https?:\/\/[^\s"']+)/);

      if (urlMatch1) {
        url = urlMatch1[1];
      } else if (urlMatch2) {
        url = urlMatch2[1];
      }

      // Extrair método
      const methodMatch = cmd.match(/-X\s+(\w+)/i);
      const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';

      // Extrair headers
      const headerMatches = cmd.matchAll(/-H\s+["']([^"']+)["']/gi);
      const headers: Record<string, string> = {};
      for (const match of headerMatches) {
        const header = match[1];
        const colonIndex = header.indexOf(':');
        if (colonIndex > 0) {
          const key = header.substring(0, colonIndex).trim();
          const value = header.substring(colonIndex + 1).trim();
          headers[key] = value;
        }
      }

      // Extrair body
      const dataMatch = cmd.match(/(?:--data-raw|--data|-d)\s+["'](.+?)["']/s);
      let body = dataMatch ? dataMatch[1] : '';

      // Tentar formatar JSON
      if (body) {
        try {
          const parsed = JSON.parse(body);
          body = JSON.stringify(parsed, null, 2);
        } catch {
          // Manter como string se não for JSON válido
        }
      }

      return {
        url,
        method,
        headers: Object.keys(headers).length > 0 ? JSON.stringify(headers, null, 2) : '',
        body,
      };
    } catch (error) {
      console.error('Error parsing cURL:', error);
      return null;
    }
  };

  // Função para importar cURL
  const handleImportCurl = () => {
    const parsed = parseCurlCommand(curlCommand);
    if (parsed) {
      setConfig({
        ...config,
        url: parsed.url,
        method: parsed.method,
        headers: parsed.headers,
        body: parsed.body,
      });
      setShowCurlImport(false);
      setCurlCommand('');
    } else {
      alert(t('flowBuilder.sidebar.config.errors.curlParseError'));
    }
  };

  // Função para testar a chamada HTTP REST
  const handleTestApi = async () => {
    setTestingApi(true);
    setApiTestError(null);
    setApiTestResponse(null);

    try {
      const url = config.url || '';
      const method = config.method || 'GET';
      const headers = config.headers ? JSON.parse(config.headers) : {};
      const body = config.body && ['POST', 'PUT', 'PATCH'].includes(method) ? JSON.parse(config.body) : undefined;
      const timeout = config.timeout || 30;

      // Get auth token from localStorage
      const token = localStorage.getItem('auth_token');

      // Use backend proxy to avoid CORS issues
      const response = await fetch('/api/http-proxy/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          url,
          method,
          headers,
          body,
          timeout,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setApiTestResponse(result.data);
      } else {
        setApiTestError(result.error || 'Erro ao testar API');
      }

    } catch (error: any) {
      setApiTestError(error.message || 'Erro ao testar API');
    } finally {
      setTestingApi(false);
    }
  };

  // Função para extrair todos os caminhos possíveis do JSON (como Typebot)
  const extractJsonPaths = (obj: any, prefix: string = '', isArrayItem: boolean = false): string[] => {
    const paths: string[] = [];

    if (obj === null || obj === undefined) {
      return paths;
    }

    // Se é um array, adicionar opções com .flatMap()
    if (Array.isArray(obj)) {
      if (obj.length > 0) {
        const itemPaths = extractJsonPaths(obj[0], '', true);
        itemPaths.forEach(itemPath => {
          paths.push(`${prefix}.flatMap(item => item.${itemPath})`);
        });
      }
      return paths;
    }

    // Se é um objeto
    if (typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        const currentPath = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        // Se é array, adicionar path com flatMap
        if (Array.isArray(value) && value.length > 0) {
          paths.push(currentPath);
          const itemPaths = extractJsonPaths(value[0], '', true);
          itemPaths.forEach(itemPath => {
            paths.push(`${currentPath}.flatMap(item => item.${itemPath})`);
          });
        }
        // Se é objeto, recursivamente extrair paths
        else if (value !== null && typeof value === 'object') {
          const nestedPaths = extractJsonPaths(value, currentPath, isArrayItem);
          paths.push(...nestedPaths);
        }
        // Se é valor primitivo, adicionar o path
        else {
          paths.push(currentPath);
        }
      });
    }

    return paths;
  };

  // Função para coletar variáveis disponíveis de nós anteriores
  const getAvailableVariables = (): Array<{ name: string; description: string }> => {
    if (!node) return [];

    const variables: Array<{ name: string; description: string }> = [
      { name: 'nome', description: 'Nome do contato' },
      { name: 'telefone', description: 'Telefone do contato' },
      { name: 'email', description: 'Email do contato' },
    ];

    // Função recursiva para encontrar nós anteriores
    const getPreviousNodes = (nodeId: string, visited: Set<string> = new Set()): Node[] => {
      if (visited.has(nodeId)) return [];
      visited.add(nodeId);

      const incomingEdges = edges.filter(edge => edge.target === nodeId);
      let previousNodes: Node[] = [];

      for (const edge of incomingEdges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode) {
          previousNodes.push(sourceNode);
          previousNodes = [...previousNodes, ...getPreviousNodes(sourceNode.id, visited)];
        }
      }

      return previousNodes;
    };

    // Obter todos os nós anteriores ao nó atual
    const previousNodes = getPreviousNodes(node.id);

    // Extrair variáveis de nós HTTP REST anteriores
    previousNodes.forEach(prevNode => {
      if (prevNode.data?.nodeType === 'httprest') {
        const prevConfig = prevNode.data?.config;
        if (prevConfig?.variableMappings && Array.isArray(prevConfig.variableMappings)) {
          prevConfig.variableMappings.forEach((mapping: any) => {
            if (mapping.variableName) {
              variables.push({
                name: mapping.variableName,
                description: `HTTP REST: ${mapping.jsonPath || 'Campo da API'}`,
              });
            }
          });
        }
      }
    });

    return variables;
  };

  // Função para adicionar mapeamento de variável
  const handleAddVariableMapping = (path: string) => {
    const variableMappings = config.variableMappings || [];
    const newMapping = {
      jsonPath: path,
      variableName: path.replace(/\./g, '_').replace(/flatMap\(item => item\./g, '').replace(/\)/g, ''),
    };
    setConfig({
      ...config,
      variableMappings: [...variableMappings, newMapping],
    });
  };

  // Função para remover mapeamento de variável
  const handleRemoveVariableMapping = (index: number) => {
    const variableMappings = [...(config.variableMappings || [])];
    variableMappings.splice(index, 1);
    setConfig({ ...config, variableMappings });
  };

  // Handler para detectar {{ e mostrar sugestões de variáveis
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: string) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    // Atualizar config
    setConfig({ ...config, [field]: value });

    // Detectar se usuário digitou {{
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastTwoBrackets = textBeforeCursor.slice(-2);

    if (lastTwoBrackets === '{{') {
      // Mostrar sugestões
      const variables = getAvailableVariables();
      setVariableSuggestions(variables);
      setActiveSuggestionIndex(0);
      setCurrentInputRef(e.target);

      // Calcular posição do dropdown
      const rect = e.target.getBoundingClientRect();
      setSuggestionPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });

      setShowVariableSuggestions(true);
    } else {
      setShowVariableSuggestions(false);
    }
  };

  // Handler para navegar nas sugestões com teclado
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!showVariableSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev =>
        prev < variableSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && showVariableSuggestions) {
      e.preventDefault();
      insertVariable(variableSuggestions[activeSuggestionIndex].name);
    } else if (e.key === 'Escape') {
      setShowVariableSuggestions(false);
    }
  };

  // Função para inserir variável no campo
  const insertVariable = (variableName: string) => {
    if (!currentInputRef) return;

    const cursorPosition = currentInputRef.selectionStart || 0;
    const currentValue = currentInputRef.value;

    // Remover {{ que já foi digitado
    const beforeCursor = currentValue.substring(0, cursorPosition - 2);
    const afterCursor = currentValue.substring(cursorPosition);

    // Inserir variável com }}
    const newValue = `${beforeCursor}{{${variableName}}}${afterCursor}`;

    // Descobrir qual campo estamos editando
    const fieldName = Object.keys(config).find(key => config[key] === currentValue);
    if (fieldName) {
      setConfig({ ...config, [fieldName]: newValue });
    }

    setShowVariableSuggestions(false);
  };

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showVariableSuggestions && !(e.target as Element).closest('.variable-suggestions')) {
        setShowVariableSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVariableSuggestions]);

  const renderHttpRestConfig = () => (
    <div className="space-y-4">
      {/* Botão Importar cURL */}
      <div>
        <button
          onClick={() => setShowCurlImport(true)}
          className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center space-x-2"
        >
          <span>📋</span>
          <span>Importar cURL</span>
        </button>
      </div>

      {/* Modal de importação cURL */}
      {showCurlImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCurlImport(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">📋 Importar comando cURL</h3>
              <button
                onClick={() => setShowCurlImport(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cole o comando cURL aqui
                </label>
                <textarea
                  value={curlCommand}
                  onChange={(e) => setCurlCommand(e.target.value)}
                  placeholder={`curl 'https://api.exemplo.com/endpoint' \\\n  -X POST \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer token' \\\n  --data '{"campo": "valor"}'`}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono text-xs"
                />
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  💡 Cole o comando cURL completo (ex: do DevTools do navegador). Os campos URL, método, headers e body serão preenchidos automaticamente.
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCurlImport(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportCurl}
                  disabled={!curlCommand.trim()}
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Importar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Método HTTP */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Método HTTP
        </label>
        <select
          value={config.method || 'GET'}
          onChange={(e) => setConfig({ ...config, method: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          URL *
        </label>
        <input
          type="url"
          value={config.url || ''}
          onChange={(e) => setConfig({ ...config, url: e.target.value })}
          placeholder="https://api.exemplo.com/endpoint"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
        <p className="text-xs text-gray-500 mt-1">
          Use variáveis: {'{{nome}}, {{telefone}}'}
        </p>
      </div>

      {/* Headers */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Headers (JSON)
        </label>
        <textarea
          value={config.headers || ''}
          onChange={(e) => setConfig({ ...config, headers: e.target.value })}
          placeholder={'{\n  "Authorization": "Bearer {{token}}",\n  "Content-Type": "application/json"\n}'}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none font-mono text-xs"
        />
        <p className="text-xs text-gray-500 mt-1">
          Formato JSON. Use variáveis como {'{{nome}}, {{telefone}}'}
        </p>
      </div>

      {/* Body (apenas para POST, PUT, PATCH) */}
      {['POST', 'PUT', 'PATCH'].includes(config.method || 'GET') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Body (JSON)
          </label>
          <textarea
            value={config.body || ''}
            onChange={(e) => setConfig({ ...config, body: e.target.value })}
            placeholder={'{\n  "name": "{{nome}}",\n  "phone": "{{telefone}}"\n}'}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none font-mono text-xs"
          />
          <p className="text-xs text-gray-500 mt-1">
            Formato JSON. Use variáveis como {'{{nome}}, {{telefone}}'}
          </p>
        </div>
      )}

      {/* Timeout */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Timeout (segundos)
        </label>
        <input
          type="number"
          min="1"
          max="60"
          value={config.timeout || 30}
          onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) || 30 })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
        <p className="text-xs text-gray-500 mt-1">
          Tempo máximo de espera pela resposta (1-60 segundos)
        </p>
      </div>

      {/* Variável de resposta */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Salvar resposta em variável (opcional)
        </label>
        <input
          type="text"
          value={config.responseVar || ''}
          onChange={(e) => setConfig({ ...config, responseVar: e.target.value })}
          placeholder="response"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
        <p className="text-xs text-gray-500 mt-1">
          Nome da variável para armazenar a resposta da API. Use {'{{response.campo}}'} em nós seguintes.
        </p>
      </div>

      {/* Botão de teste */}
      <div>
        <button
          onClick={handleTestApi}
          disabled={!config.url || testingApi}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {testingApi ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>Testando...</span>
            </>
          ) : (
            <>
              <span>🧪</span>
              <span>Testar API</span>
            </>
          )}
        </button>
      </div>

      {/* Resposta do teste */}
      {apiTestResponse && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ✅ Resposta da API
          </label>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 max-h-64 overflow-y-auto">
            <pre className="text-xs font-mono text-green-900 whitespace-pre-wrap">
              {JSON.stringify(apiTestResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Erro do teste */}
      {apiTestError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">
            ❌ <strong>Erro:</strong> {apiTestError}
          </p>
        </div>
      )}

      {/* Mapeamento de variáveis */}
      {apiTestResponse && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📋 Mapear campos para variáveis
          </label>
          <div className="space-y-3">
            {(config.variableMappings || []).map((mapping: any, index: number) => {
              const availablePaths = extractJsonPaths(apiTestResponse);
              return (
                <div key={index} className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">Mapeamento {index + 1}</span>
                    <button
                      onClick={() => handleRemoveVariableMapping(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      🗑️ Remover
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Selecione o campo
                    </label>
                    <select
                      value={mapping.jsonPath}
                      onChange={(e) => {
                        const newMappings = [...(config.variableMappings || [])];
                        newMappings[index].jsonPath = e.target.value;
                        // Auto-gerar nome da variável baseado no caminho
                        const autoVarName = e.target.value
                          .replace(/\./g, '_')
                          .replace(/flatMap\(item => item\./g, '')
                          .replace(/\)/g, '')
                          .replace(/[^a-zA-Z0-9_]/g, '');
                        newMappings[index].variableName = autoVarName;
                        setConfig({ ...config, variableMappings: newMappings });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                    >
                      <option value="">Selecione um campo...</option>
                      {availablePaths.map((path, pathIndex) => (
                        <option key={pathIndex} value={path}>
                          {path}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {mapping.jsonPath && (
                        <span>
                          Valor: <code className="bg-gray-200 px-1 rounded text-xs">
                            {(() => {
                              try {
                                const pathParts = mapping.jsonPath.split('.');
                                let value = apiTestResponse;
                                for (const part of pathParts) {
                                  if (part.includes('flatMap')) break;
                                  value = value?.[part];
                                }
                                return JSON.stringify(value);
                              } catch {
                                return 'N/A';
                              }
                            })()}
                          </code>
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Nome da Variável
                    </label>
                    <input
                      type="text"
                      value={mapping.variableName}
                      onChange={(e) => {
                        const newMappings = [...(config.variableMappings || [])];
                        newMappings[index].variableName = e.target.value;
                        setConfig({ ...config, variableMappings: newMappings });
                      }}
                      placeholder="nomeUsuario"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('flowBuilder.sidebar.config.variableUsage')} <code className="bg-gray-200 px-1 rounded">{'{{'}{mapping.variableName || 'nomeVariavel'}{'}}'}</code>
                    </p>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => handleAddVariableMapping('')}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-brand-primary hover:text-brand-primary transition-colors flex items-center justify-center space-x-2"
            >
              <span>➕</span>
              <span>Adicionar Mapeamento</span>
            </button>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                💡 <strong>Dica:</strong> Selecione os campos da resposta que você quer usar nos próximos nós. Arrays usam automaticamente .flatMap() para extrair valores.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          💡 <strong>Dica:</strong> Teste a API primeiro, depois mapeie os campos que você quer usar como variáveis nos próximos nós do fluxo.
        </p>
      </div>
    </div>
  );

  const renderPerfexIntegrationConfig = () => {
    const [statuses, setStatuses] = useState<Array<{ id: string; name: string }>>([]);
    const [sources, setSources] = useState<Array<{ id: string; name: string }>>([]);
    const [staff, setStaff] = useState<Array<{ staffid: string; firstname: string; lastname: string }>>([]);
    const [loading, setLoading] = useState(false);

    // Inicializar action se não existir
    useEffect(() => {
      if (!config.action) {
        setConfig({ ...config, action: 'update_status' });
      }
    }, []);

    useEffect(() => {
      const loadPerfexData = async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('auth_token');
          if (!token) return;

          // Carregar status, fontes e staff em paralelo
          const [statusRes, sourcesRes, staffRes] = await Promise.all([
            fetch('/api/perfex/statuses', {
              headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json()).catch(() => ({ statuses: [] })),
            fetch('/api/perfex/sources', {
              headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json()).catch(() => ({ sources: [] })),
            fetch('/api/perfex/staff', {
              headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json()).catch(() => ({ staff: [] }))
          ]);

          setStatuses(statusRes.statuses || []);
          setSources(sourcesRes.sources || []);
          setStaff(staffRes.staff || []);
        } catch (error) {
          console.error('Erro ao carregar dados do Perfex:', error);
        } finally {
          setLoading(false);
        }
      };

      loadPerfexData();
    }, []);

    return (
      <div className="space-y-4">
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-xs text-purple-700">
            🔧 <strong>Perfex CRM:</strong> Configure a ação que será executada no lead após finalizar o fluxo.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ação
          </label>
          <select
            value={config.action || 'update_status'}
            onChange={(e) => setConfig({ ...config, action: e.target.value, value: '' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="update_status">Atualizar Status</option>
            <option value="update_source">Atualizar Fonte</option>
            <option value="assign_to">Atribuir Para</option>
            <option value="mark_lost">Marcar como Perdido</option>
            <option value="mark_junk">Marcar como Lixo</option>
          </select>
        </div>

        {(config.action === 'update_status' || !config.action) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status (ID)
            </label>
            <input
              type="text"
              value={config.value || ''}
              onChange={(e) => setConfig({ ...config, value: e.target.value })}
              placeholder={t('flowBuilder.sidebar.config.statusIdPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 IDs dos status cadastrados no Perfex CRM
            </p>
            {!loading && statuses.length > 0 && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                <strong>Status encontrados nos leads:</strong>
                <ul className="mt-1 space-y-1">
                  {statuses.map((status) => (
                    <li key={status.id} className="text-gray-600">
                      • ID <strong>{status.id}</strong>: {status.name}
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, value: status.id })}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        [usar]
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {config.action === 'update_source' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fonte (ID)
            </label>
            <input
              type="text"
              value={config.value || ''}
              onChange={(e) => setConfig({ ...config, value: e.target.value })}
              placeholder={t('flowBuilder.sidebar.config.sourceIdPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 IDs das fontes cadastradas no Perfex CRM
            </p>
            {!loading && sources.length > 0 && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                <strong>Fontes encontradas nos leads:</strong>
                <ul className="mt-1 space-y-1">
                  {sources.map((source) => (
                    <li key={source.id} className="text-gray-600">
                      • ID <strong>{source.id}</strong>: {source.name}
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, value: source.id })}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        [usar]
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {config.action === 'assign_to' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Atribuir Para (ID)
            </label>
            <input
              type="text"
              value={config.value || ''}
              onChange={(e) => setConfig({ ...config, value: e.target.value })}
              placeholder={t('flowBuilder.sidebar.config.userIdPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 IDs dos usuários cadastrados no Perfex CRM
            </p>
            {!loading && staff.length > 0 && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                <strong>Usuários encontrados nos leads:</strong>
                <ul className="mt-1 space-y-1">
                  {staff.map((member) => (
                    <li key={member.staffid} className="text-gray-600">
                      • ID <strong>{member.staffid}</strong>: {member.firstname} {member.lastname} {member.email && `(${member.email})`}
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, value: member.staffid })}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        [usar]
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderChatwootIntegrationConfig = () => {
    const tags = config.tags || [];
    const [newTag, setNewTag] = useState('');

    const addTag = () => {
      if (newTag.trim() && !tags.includes(newTag.trim())) {
        setConfig({ ...config, tags: [...tags, newTag.trim()] });
        setNewTag('');
      }
    };

    const removeTag = (tagToRemove: string) => {
      setConfig({ ...config, tags: tags.filter((t: string) => t !== tagToRemove) });
    };

    return (
      <div className="space-y-4">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            💬 <strong>Chatwoot:</strong> Configure as tags que serão adicionadas ou removidas do contato após finalizar o fluxo.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ação
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="add"
                checked={config.action === 'add' || !config.action}
                onChange={(e) => setConfig({ ...config, action: e.target.value })}
                className="mr-2"
              />
              <span className="text-sm">➕ Adicionar Tags</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="remove"
                checked={config.action === 'remove'}
                onChange={(e) => setConfig({ ...config, action: e.target.value })}
                className="mr-2"
              />
              <span className="text-sm">➖ Remover Tags</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder={t('flowBuilder.sidebar.config.tagPlaceholder')}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Adicionar
            </button>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {tags.length === 0 && (
            <p className="text-xs text-gray-500">Nenhuma tag adicionada ainda</p>
          )}
        </div>
      </div>
    );
  };

  const getNodeIcon = () => {
    const icons: Record<string, string> = {
      trigger: '⚡',
      text: '📝',
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      document: '📄',
      ai: '🤖',
      action: '🚀',
      condition: '❓',
      delay: '⏱️',
      httprest: '🌐',
      stop: '🛑',
      integration_perfex: '🔧',
      integration_chatwoot: '💬',
    };
    return icons[node.data.nodeType] || '📦';
  };

  const getNodeLabel = () => {
    const labels: Record<string, string> = {
      trigger: 'Trigger',
      text: t('flowBuilder.nodes.text.label'),
      image: t('flowBuilder.nodes.image.label'),
      video: t('flowBuilder.nodes.video.label'),
      audio: t('flowBuilder.nodes.audio.label'),
      document: t('flowBuilder.nodes.document.label'),
      ai: t('flowBuilder.nodes.ai.label'),
      action: t('flowBuilder.sidebar.config.nodeTypes.action'),
      condition: t('flowBuilder.sidebar.config.nodeTypes.condition'),
      delay: t('flowBuilder.nodes.delay.label'),
      httprest: t('flowBuilder.nodes.httprest.label'),
      stop: t('flowBuilder.nodes.stop.label'),
      integration_perfex: t('flowBuilder.nodes.integration_perfex.label'),
      integration_chatwoot: t('flowBuilder.nodes.integration_chatwoot.label'),
    };
    return labels[node.data.nodeType] || t('flowBuilder.nodes.base.deleteNode');
  };

  const renderConfig = () => {
    switch (node.data.nodeType) {
      case 'trigger':
        return renderTriggerConfig();
      case 'text':
        return renderTextConfig();
      case 'image':
        return renderImageConfig();
      case 'video':
        return renderVideoConfig();
      case 'audio':
        return renderAudioConfig();
      case 'document':
        return renderDocumentConfig();
      case 'ai':
        return renderAIConfig();
      case 'condition':
        return renderConditionConfig();
      case 'delay':
        return renderDelayConfig();
      case 'httprest':
        return renderHttpRestConfig();
      case 'action':
        // Manter compatibilidade com nós antigos
        return renderActionConfig();
      case 'integration_perfex':
        return renderPerfexIntegrationConfig();
      case 'integration_chatwoot':
        return renderChatwootIntegrationConfig();
      default:
        return <p className="text-gray-500">Sem configurações disponíveis</p>;
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{getNodeIcon()}</span>
          <h2 className="text-lg font-semibold text-gray-900">{getNodeLabel()}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {renderConfig()}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 flex space-x-3">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Salvar
        </button>
      </div>

      {/* Dropdown de sugestões de variáveis */}
      {showVariableSuggestions && (
        <div
          className="variable-suggestions fixed bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
          style={{
            top: `${suggestionPosition.top}px`,
            left: `${suggestionPosition.left}px`,
            minWidth: '300px',
          }}
        >
          {variableSuggestions.length > 0 ? (
            variableSuggestions.map((variable, index) => (
              <div
                key={variable.name}
                onClick={() => insertVariable(variable.name)}
                className={`px-4 py-2 cursor-pointer transition-colors ${
                  index === activeSuggestionIndex
                    ? 'bg-brand-primary text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="font-medium text-sm">{`{{${variable.name}}}`}</div>
                <div
                  className={`text-xs ${
                    index === activeSuggestionIndex ? 'text-white opacity-80' : 'text-gray-500'
                  }`}
                >
                  {variable.description}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-sm text-gray-500">
              Nenhuma variável disponível
            </div>
          )}
        </div>
      )}
    </div>
  );
}
