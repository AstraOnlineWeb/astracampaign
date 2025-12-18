import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { useTranslation } from 'react-i18next';

interface BaseNodeProps extends NodeProps {
  icon: string;
  label: string;
  color: string;
  description?: string;
  preview?: React.ReactNode;
  onClick?: () => void;
  onDelete?: () => void;
}

export const BaseNode = memo(({ id, data, icon, label, color, description, preview, onClick, onDelete }: BaseNodeProps & { id: string; data: any }) => {
  const { t } = useTranslation();
  const isConfigured = data.config && Object.keys(data.config).length > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [customLabel, setCustomLabel] = useState(data.customLabel || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes } = useReactFlow();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomLabel(e.target.value);
  };

  const handleLabelBlur = () => {
    setIsEditing(false);
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, customLabel } }
          : node
      )
    );
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLabelBlur();
    } else if (e.key === 'Escape') {
      setCustomLabel(data.customLabel || '');
      setIsEditing(false);
    }
  };

  const displayLabel = customLabel || label;

  return (
    <div
      onClick={onClick}
      className="relative bg-white border-2 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer min-w-[180px] group"
      style={{
        borderColor: color,
        borderLeftWidth: '6px',
      }}
    >
      {/* Botão de deletar */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600 z-10"
          title={t('flowBuilder.nodes.base.deleteNode')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Handle de entrada */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* Conteúdo do node */}
      <div className="px-4 py-3">
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-xl">{icon}</span>
          <div className="flex-1">
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={customLabel}
                onChange={handleLabelChange}
                onBlur={handleLabelBlur}
                onKeyDown={handleLabelKeyDown}
                className="w-full px-2 py-1 text-sm font-semibold text-gray-900 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div onClick={handleLabelClick} className="cursor-text">
                <div className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                  {displayLabel}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            )}
          </div>
        </div>

        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}

        {/* Preview de mídia */}
        {preview && (
          <div className="mt-2">
            {preview}
          </div>
        )}

        {isConfigured && (
          <div className="mt-2 px-2 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700 font-medium">
            ✓ {t('flowBuilder.nodes.base.configured')}
          </div>
        )}

        {!isConfigured && (
          <div className="mt-2 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 font-medium">
            ! {t('flowBuilder.nodes.base.clickToConfigure')}
          </div>
        )}
      </div>

      {/* Handle de saída */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />
    </div>
  );
});

BaseNode.displayName = 'BaseNode';
