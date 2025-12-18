import { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { useTranslation } from 'react-i18next';

export const ConditionNode = memo((props: NodeProps) => {
  const { t } = useTranslation();
  
  const getDescription = () => {
    const mode = props.data.config?.mode || 'simple';

    if (mode === 'switch') {
      const cases = props.data.config?.cases || [];
      return t('flowBuilder.nodes.condition.conditionCount', { count: cases.length });
    }

    const type = props.data.config?.conditionType;
    if (!type) return t('flowBuilder.nodes.condition.configureCondition');

    const conditionTypes: Record<string, string> = {
      contains: t('flowBuilder.nodes.condition.types.contains'),
      equals: t('flowBuilder.nodes.condition.types.equals'),
      regex: t('flowBuilder.nodes.condition.types.regex'),
      variable: t('flowBuilder.nodes.condition.types.variable'),
    };

    return conditionTypes[type] || type;
  };

  const isConfigured = props.data.config && Object.keys(props.data.config).length > 0;
  const mode = props.data.config?.mode || 'simple';
  const cases = props.data.config?.cases || [];

  // No modo switch, criar um handle para cada case + default
  const handleCount = mode === 'switch' ? cases.length + 1 : 2;

  return (
    <div
      onClick={props.data.onClick}
      className="relative bg-white border-2 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer min-w-[200px] group"
      style={{
        borderColor: '#ffd700',
        borderLeftWidth: '6px',
      }}
    >
      {/* Botão de deletar */}
      {props.data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.data.onDelete();
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

      {/* Conteúdo */}
      <div className="px-4 py-3">
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-xl">❓</span>
          <span className="font-semibold text-gray-900">
            {mode === 'switch' ? t('flowBuilder.nodes.condition.switch') : t('flowBuilder.nodes.condition.label')}
          </span>
        </div>

        <p className="text-xs text-gray-500 mt-1">{getDescription()}</p>

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

        {/* Labels das saídas para modo switch */}
        {mode === 'switch' && cases.length > 0 && (
          <div className="mt-2 space-y-1">
            {cases.map((caseItem: any, index: number) => (
              <div key={index} className="text-xs text-gray-600 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(${(index * 360) / handleCount}, 70%, 60%)` }}></span>
                <span className="truncate">{caseItem.label || caseItem.value}</span>
              </div>
            ))}
            <div className="text-xs text-gray-600 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              <span>{t('flowBuilder.nodes.condition.default')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Handles de saída */}
      {mode === 'switch' ? (
        // Modo switch: múltiplos handles
        <>
          {cases.map((caseItem: any, index: number) => (
            <Handle
              key={`case-${index}`}
              type="source"
              position={Position.Right}
              id={`case-${index}`}
              className="w-3 h-3 !border-2 !border-white"
              style={{
                backgroundColor: `hsl(${(index * 360) / handleCount}, 70%, 60%)`,
                top: `${((index + 1) * 100) / (handleCount + 1)}%`,
              }}
              title={caseItem.label || caseItem.value}
            />
          ))}
          {/* Handle default */}
          <Handle
            type="source"
            position={Position.Right}
            id="default"
            className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
            style={{
              top: `${((cases.length + 1) * 100) / (handleCount + 1)}%`,
            }}
            title={t('flowBuilder.nodes.condition.defaultTooltip')}
          />
        </>
      ) : (
        // Modo simples: 2 handles (true/false)
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="w-3 h-3 !bg-green-500 !border-2 !border-white"
            style={{ top: '40%' }}
            title={t('flowBuilder.nodes.condition.true')}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="w-3 h-3 !bg-red-500 !border-2 !border-white"
            style={{ top: '60%' }}
            title={t('flowBuilder.nodes.condition.false')}
          />
        </>
      )}
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';
