import { produce } from 'immer';
import { create } from 'zustand';
import type { FFNode, FFSchemaNode, InsertableKind } from '@/model/types';
import { buildNodeMap, createNewNode, findParent, getInsertableKinds } from '@/model/types';

/** The info keys we snapshot for dirty-tracking. */
const INFO_KEYS: Record<string, string> = {
  schema: 'schemaInfo',
  record: 'recordInfo',
  element: 'fieldInfo',
  attribute: 'fieldInfo',
  sequence: 'groupInfo',
  choice: 'groupInfo',
};

/** Direct (top-level) node properties we also track for dirty comparison. */
const DIRECT_PROPS: Record<string, string[]> = {
  schema: ['targetNamespace', 'elementFormDefault'],
  record: ['name', 'minOccurs', 'maxOccurs'],
  element: ['name', 'dataType'],
  attribute: ['name', 'dataType', 'use'],
  sequence: ['kind', 'minOccurs', 'maxOccurs'],
  choice: ['kind', 'minOccurs', 'maxOccurs'],
};

/** Build a flat map of "nodeId|infoKey|property" → value for every
 *  annotation property in the tree.  Used as the baseline for dirty comparison. */
function buildOriginalValues(nodeMap: Map<string, FFNode>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [nodeId, node] of nodeMap) {
    // Snapshot annotation sub-objects
    const infoKey = INFO_KEYS[node.kind];
    if (infoKey) {
      const info = getNodeInfo(node, infoKey);
      if (info) {
        for (const [prop, val] of Object.entries(info)) {
          map.set(`${nodeId}|${infoKey}|${prop}`, val);
        }
      }
    }
    // Snapshot direct node properties
    const directProps = DIRECT_PROPS[node.kind];
    if (directProps) {
      for (const prop of directProps) {
        map.set(`${nodeId}|.|${prop}`, getNodeDirect(node, prop));
      }
    }
  }
  return map;
}

/** Type-safe accessor for a node's annotation info sub-object. */
function getNodeInfo(node: FFNode, infoKey: string): Record<string, unknown> | null {
  switch (node.kind) {
    case 'schema':
      return infoKey === 'schemaInfo' ? (node.schemaInfo as unknown as Record<string, unknown>) : null;
    case 'record':
      return infoKey === 'recordInfo' ? (node.recordInfo as unknown as Record<string, unknown>) : null;
    case 'element':
    case 'attribute':
      return infoKey === 'fieldInfo' ? (node.fieldInfo as unknown as Record<string, unknown>) : null;
    case 'sequence':
    case 'choice':
      return infoKey === 'groupInfo' ? (node.groupInfo as unknown as Record<string, unknown>) : null;
  }
}

/** Type-safe accessor for a node's direct (top-level) property. */
function getNodeDirect(node: FFNode, property: string): unknown {
  return (node as unknown as Record<string, unknown>)[property];
}

/** Compute dirty-tracking state after a property change. */
function applyDirtyTracking(
  pathKey: string,
  value: unknown,
  get: () => EditorState,
): { dirtyPaths: Set<string>; dirtyNodeIds: Set<string>; dirty: boolean } {
  const dirtyPaths = new Set(get().dirtyPaths);
  const original = get().originalValues.get(pathKey);
  if (original === value) {
    dirtyPaths.delete(pathKey);
  } else {
    dirtyPaths.add(pathKey);
  }
  const dirtyNodeIds = new Set<string>();
  for (const p of dirtyPaths) {
    dirtyNodeIds.add(p.split('|')[0]);
  }
  return { dirtyPaths, dirtyNodeIds, dirty: dirtyPaths.size > 0 };
}

/** Walk the tree and return the first node with the given id (used inside Immer drafts). */
function findNode(root: FFNode, nodeId: string): FFNode | null {
  if (root.id === nodeId) {
    return root;
  }
  for (const child of root.children) {
    const found = findNode(child, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

export interface EditorState {
  /** The loaded schema tree (null when no file is open). */
  schema: FFSchemaNode | null;

  /** Flat node lookup map, rebuilt every time schema changes. */
  nodeMap: Map<string, FFNode>;

  /** Currently selected node id. */
  selectedNodeId: string | null;

  /** Whether the schema has unsaved changes. */
  dirty: boolean;

  /** Set of property paths that have been modified since last save.
   *  Each entry is a key of the form "nodeId|infoKey|property". */
  dirtyPaths: Set<string>;

  /** Snapshot of original property values at load / last save.
   *  Keys match dirtyPaths format; values are the clean value. */
  originalValues: Map<string, unknown>;

  /** Set of node ids that have at least one dirty property. */
  dirtyNodeIds: Set<string>;

  /** The file handle from the File System Access API (for Save). */
  fileHandle: FileSystemFileHandle | null;

  // ── Actions ──

  /** Load a parsed schema tree into the store. */
  loadSchema: (schema: FFSchemaNode, fileHandle?: FileSystemFileHandle) => void;

  /** Select a node by id. */
  selectNode: (id: string | null) => void;

  /** Update a property on a node's annotation info object. */
  updateNodeProperty: (nodeId: string, infoKey: string, property: string, value: unknown) => void;

  /** Update a direct (top-level) property on a node (e.g. kind, minOccurs). */
  updateNodeDirect: (nodeId: string, property: string, value: unknown) => void;

  /** Mark the schema as dirty (unsaved changes). */
  markDirty: () => void;

  /** Mark the schema as clean (just saved). */
  markClean: () => void;

  /** Store the file handle after save-as. */
  setFileHandle: (handle: FileSystemFileHandle) => void;

  /** Id of a newly inserted node that should enter inline-rename mode. */
  pendingRenameNodeId: string | null;

  /** Clear the pending rename flag (called after the tree picks it up). */
  clearPendingRename: () => void;

  /** Insert a new child node of the given kind under the target parent. */
  addChildNode: (parentId: string, kind: InsertableKind) => void;

  /** Insert a new sibling node after the target node. */
  addSiblingAfter: (siblingId: string, kind: InsertableKind) => void;

  /** Delete a node (and its descendants) from the tree. */
  deleteNode: (nodeId: string) => void;

  /** Move a node one position up among its siblings. */
  moveNodeUp: (nodeId: string) => void;

  /** Move a node one position down among its siblings. */
  moveNodeDown: (nodeId: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  schema: null,
  nodeMap: new Map(),
  selectedNodeId: null,
  dirty: false,
  dirtyPaths: new Set(),
  originalValues: new Map(),
  dirtyNodeIds: new Set(),
  fileHandle: null,
  pendingRenameNodeId: null,

  loadSchema: (schema, fileHandle) => {
    const nodeMap = buildNodeMap(schema);
    set({
      schema,
      nodeMap,
      selectedNodeId: schema.id,
      dirty: false,
      dirtyPaths: new Set(),
      originalValues: buildOriginalValues(nodeMap),
      dirtyNodeIds: new Set(),
      fileHandle: fileHandle ?? null,
    });
  },

  selectNode: id => {
    set({ selectedNodeId: id });
  },

  updateNodeProperty: (nodeId, infoKey, property, value) => {
    const { schema, nodeMap } = get();
    if (!schema || !nodeMap.has(nodeId)) {
      return;
    }

    const newSchema = produce(schema, draft => {
      const node = findNode(draft, nodeId);
      if (node) {
        const info = getNodeInfo(node, infoKey);
        if (info) {
          info[property] = value;
        }
      }
    });

    const pathKey = `${nodeId}|${infoKey}|${property}`;
    const tracking = applyDirtyTracking(pathKey, value, get);
    const newMap = buildNodeMap(newSchema);

    set({ schema: newSchema, nodeMap: newMap, ...tracking });
  },

  updateNodeDirect: (nodeId, property, value) => {
    const { schema, nodeMap } = get();
    if (!schema || !nodeMap.has(nodeId)) {
      return;
    }

    const newSchema = produce(schema, draft => {
      const node = findNode(draft, nodeId);
      if (node) {
        (node as unknown as Record<string, unknown>)[property] = value;

        // When the root record is renamed, keep schemaInfo.rootReference in sync
        if (property === 'name' && node.kind === 'record' && draft.children[0]?.id === nodeId) {
          draft.schemaInfo.rootReference = value as string;
        }
      }
    });

    const pathKey = `${nodeId}|.|${property}`;
    const tracking = applyDirtyTracking(pathKey, value, get);
    const newMap = buildNodeMap(newSchema);

    set({ schema: newSchema, nodeMap: newMap, ...tracking });
  },

  markDirty: () => set({ dirty: true }),
  markClean: () => {
    const { nodeMap } = get();
    set({
      dirty: false,
      dirtyPaths: new Set(),
      dirtyNodeIds: new Set(),
      originalValues: buildOriginalValues(nodeMap),
    });
  },
  setFileHandle: handle => set({ fileHandle: handle }),

  clearPendingRename: () => set({ pendingRenameNodeId: null }),

  addChildNode: (parentId, kind) => {
    const { schema, nodeMap } = get();
    if (!schema) {
      return;
    }

    // Validate that this parent accepts this child kind
    const parent = nodeMap.get(parentId);
    if (!parent) {
      return;
    }
    if (!getInsertableKinds(parent).includes(kind)) {
      return;
    }

    // For record parents accepting elements/records, verify the group exists
    if (parent.kind === 'record' && (kind === 'element' || kind === 'record')) {
      const group = parent.children.find(c => c.kind === 'sequence' || c.kind === 'choice');
      if (!group) {
        return; // no group to insert into
      }
    }

    const newNode = createNewNode(kind, nodeMap);

    const newSchema = produce(schema, draft => {
      const parentNode = findNode(draft, parentId);
      if (!parentNode) {
        return;
      }

      // Record children redirect: elements and records go into the immediate group.
      // Attributes are inserted before the group; the group is always the last child.
      if (parentNode.kind === 'record' && (kind === 'element' || kind === 'record')) {
        const group = parentNode.children.find(c => c.kind === 'sequence' || c.kind === 'choice');
        if (!group) {
          return;
        }
        group.children.push(newNode);
      } else if (parentNode.kind === 'record' && kind === 'attribute') {
        // Insert attribute before the group (keep attributes at the start)
        const groupIdx = parentNode.children.findIndex(c => c.kind === 'sequence' || c.kind === 'choice');
        if (groupIdx >= 0) {
          parentNode.children.splice(groupIdx, 0, newNode);
        } else {
          parentNode.children.push(newNode);
        }
      } else {
        parentNode.children.push(newNode);
      }
    });

    // Rebuild map to include the new node
    const finalMap = buildNodeMap(newSchema);
    const needsRename = kind === 'record' || kind === 'element' || kind === 'attribute';
    set({
      schema: newSchema,
      nodeMap: finalMap,
      selectedNodeId: newNode.id,
      dirty: true,
      pendingRenameNodeId: needsRename ? newNode.id : null,
    });
  },

  addSiblingAfter: (siblingId, kind) => {
    const { schema, nodeMap } = get();
    if (!schema) {
      return;
    }

    // Find parent of sibling and validate
    const parentEntry = findParent(schema, siblingId);
    if (!parentEntry) {
      return;
    }
    if (!getInsertableKinds(parentEntry.parent).includes(kind)) {
      return;
    }

    const newNode = createNewNode(kind, nodeMap);

    const newSchema = produce(schema, draft => {
      const clonedParent = findParent(draft, siblingId);
      if (!clonedParent) {
        return;
      }
      const { parent: pNode, index: sibIdx } = clonedParent;
      pNode.children.splice(sibIdx + 1, 0, newNode);
    });

    const finalMap = buildNodeMap(newSchema);
    const needsRename = kind === 'record' || kind === 'element' || kind === 'attribute';
    set({
      schema: newSchema,
      nodeMap: finalMap,
      selectedNodeId: newNode.id,
      dirty: true,
      pendingRenameNodeId: needsRename ? newNode.id : null,
    });
  },

  deleteNode: nodeId => {
    const { schema } = get();
    if (!schema) {
      return;
    }
    // Don't delete the schema root
    if (schema.id === nodeId) {
      return;
    }

    // Validate on original tree and capture parent id for selection
    const parentEntry = findParent(schema, nodeId);
    if (!parentEntry) {
      return;
    }
    const parentId = parentEntry.parent.id;

    const newSchema = produce(schema, draft => {
      const entry = findParent(draft, nodeId);
      if (!entry) {
        return;
      }
      entry.parent.children.splice(entry.index, 1);
    });

    const finalMap = buildNodeMap(newSchema);
    // Select the parent after deletion
    set({
      schema: newSchema,
      nodeMap: finalMap,
      selectedNodeId: parentId,
      dirty: true,
    });
  },

  moveNodeUp: nodeId => {
    const { schema } = get();
    if (!schema) {
      return;
    }

    // Validate on original tree
    const check = findParent(schema, nodeId);
    if (!check || check.index === 0) {
      return;
    }

    const newSchema = produce(schema, draft => {
      const parentEntry = findParent(draft, nodeId);
      if (!parentEntry) {
        return;
      }
      const { parent, index } = parentEntry;
      const [removed] = parent.children.splice(index, 1);
      parent.children.splice(index - 1, 0, removed);
    });

    const finalMap = buildNodeMap(newSchema);
    set({ schema: newSchema, nodeMap: finalMap, dirty: true });
  },

  moveNodeDown: nodeId => {
    const { schema } = get();
    if (!schema) {
      return;
    }

    // Validate on original tree
    const check = findParent(schema, nodeId);
    if (!check || check.index >= check.parent.children.length - 1) {
      return;
    }

    const newSchema = produce(schema, draft => {
      const parentEntry = findParent(draft, nodeId);
      if (!parentEntry) {
        return;
      }
      const { parent, index } = parentEntry;
      const [removed] = parent.children.splice(index, 1);
      parent.children.splice(index + 1, 0, removed);
    });

    const finalMap = buildNodeMap(newSchema);
    set({ schema: newSchema, nodeMap: finalMap, dirty: true });
  },
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export function useSelectedNode(): FFNode | null {
  return useEditorStore(s => {
    if (!s.selectedNodeId) {
      return null;
    }
    return s.nodeMap.get(s.selectedNodeId) ?? null;
  });
}
