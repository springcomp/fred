import { create } from 'zustand';
import type { FFNode, FFSchemaNode, InsertableKind } from '@/model/types';
import { buildNodeMap, createNewNode, getInsertableKinds } from '@/model/types';

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
      const info = (node as unknown as Record<string, unknown>)[infoKey];
      if (info && typeof info === 'object') {
        for (const [prop, val] of Object.entries(info as Record<string, unknown>)) {
          map.set(`${nodeId}|${infoKey}|${prop}`, val);
        }
      }
    }
    // Snapshot direct node properties
    const directProps = DIRECT_PROPS[node.kind];
    if (directProps) {
      for (const prop of directProps) {
        map.set(`${nodeId}|.|${prop}`, (node as unknown as Record<string, unknown>)[prop]);
      }
    }
  }
  return map;
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
    const { schema } = get();
    if (!schema) {
      return;
    }

    // Deep-clone the entire tree so every node gets a new reference.
    // This ensures Zustand selectors detect changes and React re-renders.
    const newSchema = structuredClone(schema);
    const newMap = buildNodeMap(newSchema);

    const node = newMap.get(nodeId);
    if (!node) {
      return;
    }

    const info = (node as unknown as Record<string, unknown>)[infoKey];
    if (info && typeof info === 'object') {
      (info as Record<string, unknown>)[property] = value;
    }

    const pathKey = `${nodeId}|${infoKey}|${property}`;
    const dirtyPaths = new Set(get().dirtyPaths);
    const originalValues = get().originalValues;

    // Compare against the original value — clear dirty if reverted
    const original = originalValues.get(pathKey);
    if (original === value) {
      dirtyPaths.delete(pathKey);
    } else {
      dirtyPaths.add(pathKey);
    }

    // Derive the set of node ids that still have at least one dirty property
    const dirtyNodeIds = new Set<string>();
    for (const p of dirtyPaths) {
      dirtyNodeIds.add(p.split('|')[0]);
    }

    set({ schema: newSchema, dirty: dirtyPaths.size > 0, nodeMap: newMap, dirtyPaths, dirtyNodeIds });
  },

  updateNodeDirect: (nodeId, property, value) => {
    const { schema } = get();
    if (!schema) {
      return;
    }

    const newSchema = structuredClone(schema);
    const newMap = buildNodeMap(newSchema);

    const node = newMap.get(nodeId);
    if (!node) {
      return;
    }

    (node as unknown as Record<string, unknown>)[property] = value;

    // When the root record is renamed, keep schemaInfo.rootReference in sync
    if (property === 'name' && node.kind === 'record' && newSchema.children[0]?.id === nodeId) {
      newSchema.schemaInfo.rootReference = value as string;
    }

    const pathKey = `${nodeId}|.|${property}`;
    const dirtyPaths = new Set(get().dirtyPaths);
    const originalValues = get().originalValues;

    const original = originalValues.get(pathKey);
    if (original === value) {
      dirtyPaths.delete(pathKey);
    } else {
      dirtyPaths.add(pathKey);
    }

    const dirtyNodeIds = new Set<string>();
    for (const p of dirtyPaths) {
      dirtyNodeIds.add(p.split('|')[0]);
    }

    set({ schema: newSchema, dirty: dirtyPaths.size > 0, nodeMap: newMap, dirtyPaths, dirtyNodeIds });
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

    const newSchema = structuredClone(schema);
    const newMap = buildNodeMap(newSchema);
    const parentNode = newMap.get(parentId);
    if (!parentNode) {
      return;
    }

    const newNode = createNewNode(kind, newMap);

    // Record children redirect: elements and records go into the immediate group.
    // Attributes are inserted before the group; the group is always the last child.
    if (parentNode.kind === 'record' && (kind === 'element' || kind === 'record')) {
      const group = parentNode.children.find(c => c.kind === 'sequence' || c.kind === 'choice');
      if (!group) {
        return; // no group to insert into
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
    const { schema } = get();
    if (!schema) {
      return;
    }

    // Find parent of sibling
    const parentEntry = findParent(schema, siblingId);
    if (!parentEntry) {
      return;
    }
    const { parent } = parentEntry;
    if (!getInsertableKinds(parent).includes(kind)) {
      return;
    }

    const newSchema = structuredClone(schema);
    const newMap = buildNodeMap(newSchema);

    // Find cloned parent and sibling index
    const clonedParent = findParent(newSchema, siblingId);
    if (!clonedParent) {
      return;
    }
    const { parent: pNode, index: sibIdx } = clonedParent;

    const newNode = createNewNode(kind, newMap);
    pNode.children.splice(sibIdx + 1, 0, newNode);

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

    const newSchema = structuredClone(schema);
    const parentEntry = findParent(newSchema, nodeId);
    if (!parentEntry) {
      return;
    }

    const { parent, index } = parentEntry;
    parent.children.splice(index, 1);

    const finalMap = buildNodeMap(newSchema);
    // Select the parent after deletion
    set({
      schema: newSchema,
      nodeMap: finalMap,
      selectedNodeId: parent.id,
      dirty: true,
    });
  },

  moveNodeUp: nodeId => {
    const { schema } = get();
    if (!schema) {
      return;
    }

    const newSchema = structuredClone(schema);
    const parentEntry = findParent(newSchema, nodeId);
    if (!parentEntry || parentEntry.index === 0) {
      return;
    }

    const { parent, index } = parentEntry;
    const [removed] = parent.children.splice(index, 1);
    parent.children.splice(index - 1, 0, removed);

    const finalMap = buildNodeMap(newSchema);
    set({ schema: newSchema, nodeMap: finalMap, dirty: true });
  },

  moveNodeDown: nodeId => {
    const { schema } = get();
    if (!schema) {
      return;
    }

    const newSchema = structuredClone(schema);
    const parentEntry = findParent(newSchema, nodeId);
    if (!parentEntry) {
      return;
    }

    const { parent, index } = parentEntry;
    if (index >= parent.children.length - 1) {
      return;
    }

    const [removed] = parent.children.splice(index, 1);
    parent.children.splice(index + 1, 0, removed);

    const finalMap = buildNodeMap(newSchema);
    set({ schema: newSchema, nodeMap: finalMap, dirty: true });
  },
}));

// ─── Internal Helpers ───────────────────────────────────────────────────────

/** Walk the tree and return the parent node + index of the child with the given id. */
function findParent(root: FFNode, childId: string): { parent: FFNode; index: number } | null {
  function walk(node: FFNode): { parent: FFNode; index: number } | null {
    for (let i = 0; i < node.children.length; i++) {
      if (node.children[i].id === childId) {
        return { parent: node, index: i };
      }
      const found = walk(node.children[i]);
      if (found) {
        return found;
      }
    }
    return null;
  }
  return walk(root);
}

// ─── Selectors ──────────────────────────────────────────────────────────────

export function useSelectedNode(): FFNode | null {
  return useEditorStore(s => {
    if (!s.selectedNodeId) {
      return null;
    }
    return s.nodeMap.get(s.selectedNodeId) ?? null;
  });
}
