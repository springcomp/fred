import { useCallback, useEffect, useRef, useState } from 'react';
import { type NodeRendererProps, Tree } from 'react-arborist';
import { Badge } from '@/components/ui/Badge';
import { type FFNode, type FFOccurrenceNode, getNodeLabel, UNBOUNDED } from '@/model/types';
import { useEditorStore } from '@/store/editorStore';
import { ContextMenu, type MenuPosition } from './ContextMenu';
import { NodeIcon, nodeKindLabel } from './NodeIcon';

/** Node kinds that have minOccurs / maxOccurs. */
const OCCURRENCE_KINDS = new Set<FFNode['kind']>(['record', 'element', 'sequence', 'choice']);

/** Format an occurrence hint like "0 … *". Returns null for the default 1…1. */
function occurrenceHint(node: FFNode): string | null {
  if (!OCCURRENCE_KINDS.has(node.kind)) {
    return null;
  }
  const { minOccurs, maxOccurs } = node as FFOccurrenceNode;
  if (minOccurs === 1 && maxOccurs === 1) {
    return null;
  }
  const max = maxOccurs === UNBOUNDED ? '*' : String(maxOccurs);
  return `${minOccurs} \u2026 ${max}`;
}

/** Node kinds that support inline editing on double-click. */
const EDITABLE_KINDS = new Set<FFNode['kind']>(['schema', 'record', 'element', 'attribute']);

function Node({ node, style, dragHandle }: NodeRendererProps<FFNode>) {
  const data = node.data;
  const selectedNodeId = useEditorStore(s => s.selectedNodeId);
  const selectNode = useEditorStore(s => s.selectNode);
  const updateNodeDirect = useEditorStore(s => s.updateNodeDirect);
  const dirtyNodeIds = useEditorStore(s => s.dirtyNodeIds);
  const pendingRenameNodeId = useEditorStore(s => s.pendingRenameNodeId);
  const clearPendingRename = useEditorStore(s => s.clearPendingRename);
  const isSelected = selectedNodeId === data.id;
  const isDirty = dirtyNodeIds.has(data.id);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const canEdit = EDITABLE_KINDS.has(data.kind);

  // Auto-enter inline rename for newly inserted nodes
  useEffect(() => {
    if (pendingRenameNodeId === data.id && canEdit) {
      setEditValue(getNodeLabel(data));
      setEditing(true);
      clearPendingRename();
    }
  }, [pendingRenameNodeId, data, canEdit, clearPendingRename]);

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== getNodeLabel(data)) {
      const prop = data.kind === 'schema' ? 'targetNamespace' : 'name';
      updateNodeDirect(data.id, prop, trimmed);
    }
    setEditing(false);
  }, [editValue, data, updateNodeDirect]);

  const cancelRename = useCallback(() => {
    setEditing(false);
  }, []);

  // Auto-focus and select all text when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canEdit) {
      setEditValue(getNodeLabel(data));
      setEditing(true);
    } else if (data.kind === 'sequence' || data.kind === 'choice') {
      const newKind = data.kind === 'sequence' ? 'choice' : 'sequence';
      updateNodeDirect(data.id, 'kind', newKind);
    }
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      selectNode(data.id);
      // Dispatch a custom event so the tree container can show the menu
      window.dispatchEvent(
        new CustomEvent('tree-context-menu', {
          detail: { x: e.clientX, y: e.clientY, nodeId: data.id },
        }),
      );
    },
    [data.id, selectNode],
  );

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`flex items-center gap-1.5 px-2 py-0.5 cursor-pointer rounded-sm text-sm select-none ${
        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
      }`}
      onClick={e => {
        e.stopPropagation();
        selectNode(data.id);
      }}
      onContextMenu={handleContextMenu}
    >
      <span
        className="cursor-pointer shrink-0 w-4 text-center text-xs text-muted-foreground"
        onClick={e => {
          e.stopPropagation();
          node.toggle();
        }}
      >
        {data.children.length > 0 ? (node.isOpen ? '▾' : '▸') : ' '}
      </span>
      <NodeIcon node={data} />
      {editing ? (
        <input
          ref={inputRef}
          className="flex-1 min-w-0 px-1 py-0 text-sm bg-background border border-input rounded-sm outline-none focus:ring-1 focus:ring-ring"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              commitRename();
            } else if (e.key === 'Escape') {
              cancelRename();
            }
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className={`truncate ${isDirty ? 'font-bold' : 'font-medium'}`} onDoubleClick={handleDoubleClick}>
          {getNodeLabel(data)}
        </span>
      )}
      {(() => {
        const hint = occurrenceHint(data);
        return hint ? <span className="shrink-0 text-xs font-bold italic text-muted-foreground">{hint}</span> : null;
      })()}
      <Badge variant="outline" className="ml-auto shrink-0">
        {nodeKindLabel(data.kind)}
      </Badge>
    </div>
  );
}

export function SchemaTree() {
  const schema = useEditorStore(s => s.schema);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  // Listen for context-menu events dispatched by Node rows
  useEffect(() => {
    function handleTreeContextMenu(e: Event) {
      const detail = (e as CustomEvent).detail as MenuPosition;
      setMenuPos(detail);
    }
    window.addEventListener('tree-context-menu', handleTreeContextMenu);
    return () => window.removeEventListener('tree-context-menu', handleTreeContextMenu);
  }, []);

  if (!schema) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Open an XSD file to get started
      </div>
    );
  }

  return (
    <>
      <AutoSizeTree schema={schema} />
      {menuPos && <ContextMenu position={menuPos} onClose={() => setMenuPos(null)} />}
    </>
  );
}

function AutoSizeTree({ schema }: { schema: FFNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 360, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const obs = new ResizeObserver(([entry]) => {
      setDims({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      <Tree<FFNode>
        data={[schema]}
        openByDefault={true}
        width={dims.width}
        height={dims.height}
        indent={20}
        rowHeight={28}
        disableDrag
        disableDrop
      >
        {Node}
      </Tree>
    </div>
  );
}
