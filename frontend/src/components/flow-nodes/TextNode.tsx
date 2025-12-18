import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { useTranslation } from 'react-i18next';
import { BaseNode } from './BaseNode';

export const TextNode = memo((props: NodeProps) => {
  const { t } = useTranslation();
  
  const getDescription = () => {
    const hasVariations = props.data.config?.useTextVariations;
    const variationsCount = props.data.config?.textVariations?.length || 0;

    if (hasVariations && variationsCount > 0) {
      return `${variationsCount} ${variationsCount > 1 ? t('flowBuilder.nodes.text.variations') : t('flowBuilder.nodes.text.variation')}`;
    }

    const content = props.data.config?.content;
    if (content) {
      return content.substring(0, 30) + (content.length > 30 ? '...' : '');
    }

    return t('flowBuilder.nodes.text.configureMessage');
  };

  return (
    <BaseNode
      {...props}
      icon="📝"
      label={t('flowBuilder.nodes.text.label')}
      color="#3ddc97"
      description={getDescription()}
      onDelete={props.data.onDelete}
    />
  );
});

TextNode.displayName = 'TextNode';
