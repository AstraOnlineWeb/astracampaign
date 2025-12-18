import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { useTranslation } from 'react-i18next';
import { BaseNode } from './BaseNode';

export const ActionNode = memo((props: NodeProps) => {
  const { t } = useTranslation();
  
  const getDescription = () => {
    const type = props.data.config?.actionType;
    if (!type) return t('flowBuilder.nodes.action.selectAction');

    const actionTypes: Record<string, string> = {
      text: t('flowBuilder.nodes.action.types.text'),
      image: t('flowBuilder.nodes.action.types.image'),
      video: t('flowBuilder.nodes.action.types.video'),
      audio: t('flowBuilder.nodes.action.types.audio'),
      document: t('flowBuilder.nodes.action.types.document'),
      openai: t('flowBuilder.nodes.action.types.openai'),
      groq: t('flowBuilder.nodes.action.types.groq'),
    };

    return actionTypes[type] || type;
  };

  return (
    <BaseNode
      {...props}
      icon="🚀"
      label={t('flowBuilder.nodes.action.label')}
      color="#3ddc97"
      description={getDescription()}
      onDelete={props.data.onDelete}
    />
  );
});

ActionNode.displayName = 'ActionNode';
