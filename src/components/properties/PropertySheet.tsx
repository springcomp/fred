import { useCallback } from 'react';
import { NodeIcon, nodeKindLabel } from '@/components/tree/NodeIcon';
import { useEditorStore, useSelectedNode } from '@/store/editorStore';
import { FieldInfoPanel, GroupInfoPanel, RecordInfoPanel, SchemaInfoPanel } from './InfoPanels';

export function PropertySheet() {
  const node = useSelectedNode();
  const updateNodeProperty = useEditorStore(s => s.updateNodeProperty);
  const updateNodeDirect = useEditorStore(s => s.updateNodeDirect);
  const dirtyPaths = useEditorStore(s => s.dirtyPaths);

  const makeOnChange = useCallback(
    (infoKey: string) => (property: string, value: unknown) => {
      if (node) {
        updateNodeProperty(node.id, infoKey, property, value);
      }
    },
    [node, updateNodeProperty],
  );

  const makeIsDirty = useCallback(
    (infoKey: string) => (property: string) => {
      if (!node) {
        return false;
      }
      return dirtyPaths.has(`${node.id}|${infoKey}|${property}`);
    },
    [node, dirtyPaths],
  );

  const onDirectChange = useCallback(
    (property: string, value: unknown) => {
      if (node) {
        updateNodeDirect(node.id, property, value);
      }
    },
    [node, updateNodeDirect],
  );

  const isDirectDirty = useCallback(
    (property: string) => {
      if (!node) {
        return false;
      }
      return dirtyPaths.has(`${node.id}|.|${property}`);
    },
    [node, dirtyPaths],
  );

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a node to view properties
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border">
        <NodeIcon node={node} size={20} />
        <span className="font-semibold text-sm">{nodeKindLabel(node.kind)}</span>
      </div>

      {/* Kind-specific panel */}
      {node.kind === 'schema' && (
        <SchemaInfoPanel
          info={node.schemaInfo}
          elementFormDefault={node.elementFormDefault}
          onChange={makeOnChange('schemaInfo')}
          onDirectChange={onDirectChange}
          isDirty={makeIsDirty('schemaInfo')}
          isDirectDirty={isDirectDirty}
        />
      )}

      {node.kind === 'record' && (
        <RecordInfoPanel
          info={node.recordInfo}
          name={node.name}
          minOccurs={node.minOccurs}
          maxOccurs={node.maxOccurs}
          onChange={makeOnChange('recordInfo')}
          onDirectChange={onDirectChange}
          isDirty={makeIsDirty('recordInfo')}
          isDirectDirty={isDirectDirty}
        />
      )}

      {node.kind === 'element' && (
        <FieldInfoPanel
          info={node.fieldInfo}
          name={node.name}
          dataType={node.dataType}
          onChange={makeOnChange('fieldInfo')}
          onDirectChange={onDirectChange}
          isDirty={makeIsDirty('fieldInfo')}
          isDirectDirty={isDirectDirty}
        />
      )}

      {node.kind === 'attribute' && (
        <FieldInfoPanel
          info={node.fieldInfo}
          name={node.name}
          dataType={node.dataType}
          isAttribute
          use={node.use}
          onChange={makeOnChange('fieldInfo')}
          onDirectChange={onDirectChange}
          isDirty={makeIsDirty('fieldInfo')}
          isDirectDirty={isDirectDirty}
        />
      )}

      {(node.kind === 'sequence' || node.kind === 'choice') && (
        <GroupInfoPanel
          info={node.groupInfo}
          kind={node.kind}
          minOccurs={node.minOccurs}
          maxOccurs={node.maxOccurs}
          onChange={makeOnChange('groupInfo')}
          onDirectChange={onDirectChange}
          isDirty={makeIsDirty('groupInfo')}
          isDirectDirty={isDirectDirty}
        />
      )}
    </div>
  );
}
