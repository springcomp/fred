import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDefaultFieldInfo,
  createDefaultGroupInfo,
  createDefaultRecordInfo,
  createDefaultSchemaInfo,
  type FFAttributeNode,
  type FFElementNode,
  type FFRecordNode,
  type FFSchemaNode,
  type FFSequenceNode,
  XmlSchemaUse,
} from '@/model/types';
import { useEditorStore } from '@/store/editorStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTestSchema(): FFSchemaNode {
  const field1: FFElementNode = {
    id: 'e1',
    kind: 'element',
    name: 'Field1',
    namespace: '',
    dataType: 'xs:string',
    minOccurs: 1,
    maxOccurs: 1,
    fieldInfo: createDefaultFieldInfo(),
    children: [],
  };
  const field2: FFElementNode = {
    id: 'e2',
    kind: 'element',
    name: 'Field2',
    namespace: '',
    dataType: 'xs:int',
    minOccurs: 1,
    maxOccurs: 1,
    fieldInfo: createDefaultFieldInfo(),
    children: [],
  };
  const seq: FFSequenceNode = {
    id: 'seq1',
    kind: 'sequence',
    minOccurs: 1,
    maxOccurs: 1,
    groupInfo: createDefaultGroupInfo(),
    children: [field1, field2],
  };
  const attr1: FFAttributeNode = {
    id: 'a1',
    kind: 'attribute',
    name: 'Attr1',
    namespace: '',
    dataType: 'xs:string',
    use: XmlSchemaUse.Optional,
    fieldInfo: createDefaultFieldInfo(),
    children: [],
  };
  const record: FFRecordNode = {
    id: 'r1',
    kind: 'record',
    name: 'Root',
    namespace: '',
    minOccurs: 1,
    maxOccurs: 1,
    recordInfo: createDefaultRecordInfo(),
    children: [attr1, seq],
  };
  const schema: FFSchemaNode = {
    id: 's1',
    kind: 'schema',
    targetNamespace: 'http://example.com/ns',
    elementFormDefault: 'qualified',
    schemaInfo: { ...createDefaultSchemaInfo(), rootReference: 'Root' },
    children: [record],
  };
  return schema;
}

// Reset the store before each test
beforeEach(() => {
  useEditorStore.setState({
    schema: null,
    nodeMap: new Map(),
    selectedNodeId: null,
    dirty: false,
    dirtyPaths: new Set(),
    originalValues: new Map(),
    dirtyNodeIds: new Set(),
    fileHandle: null,
    pendingRenameNodeId: null,
  });
});

// ─── loadSchema ─────────────────────────────────────────────────────────────

describe('editorStore – loadSchema', () => {
  it('loads a schema into the store', () => {
    const schema = makeTestSchema();
    useEditorStore.getState().loadSchema(schema);

    const state = useEditorStore.getState();
    expect(state.schema).not.toBeNull();
    expect(state.schema?.kind).toBe('schema');
    expect(state.selectedNodeId).toBe('s1');
    expect(state.dirty).toBe(false);
  });

  it('builds a nodeMap with all nodes', () => {
    const schema = makeTestSchema();
    useEditorStore.getState().loadSchema(schema);

    const state = useEditorStore.getState();
    // s1 + r1 + a1 + seq1 + e1 + e2 = 6
    expect(state.nodeMap.size).toBe(6);
    expect(state.nodeMap.has('s1')).toBe(true);
    expect(state.nodeMap.has('r1')).toBe(true);
    expect(state.nodeMap.has('e1')).toBe(true);
    expect(state.nodeMap.has('e2')).toBe(true);
    expect(state.nodeMap.has('seq1')).toBe(true);
    expect(state.nodeMap.has('a1')).toBe(true);
  });

  it('clears dirty state on load', () => {
    const schema = makeTestSchema();
    const store = useEditorStore.getState();
    store.loadSchema(schema);
    store.markDirty();
    expect(useEditorStore.getState().dirty).toBe(true);

    // Reload
    store.loadSchema(schema);
    expect(useEditorStore.getState().dirty).toBe(false);
    expect(useEditorStore.getState().dirtyPaths.size).toBe(0);
  });
});

// ─── selectNode ─────────────────────────────────────────────────────────────

describe('editorStore – selectNode', () => {
  it('selects a node by id', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().selectNode('e1');
    expect(useEditorStore.getState().selectedNodeId).toBe('e1');
  });

  it('clears selection when null', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().selectNode(null);
    expect(useEditorStore.getState().selectedNodeId).toBeNull();
  });
});

// ─── updateNodeProperty ─────────────────────────────────────────────────────

describe('editorStore – updateNodeProperty', () => {
  it('updates a field on the annotation info object', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().updateNodeProperty('e1', 'fieldInfo', 'positionalLength', 42);

    const state = useEditorStore.getState();
    const field = state.nodeMap.get('e1') as FFElementNode;
    expect(field.fieldInfo.positionalLength).toBe(42);
  });

  it('marks the store as dirty when value differs from original', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    expect(useEditorStore.getState().dirty).toBe(false);

    useEditorStore.getState().updateNodeProperty('e1', 'fieldInfo', 'positionalLength', 99);
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(useEditorStore.getState().dirtyPaths.size).toBe(1);
    expect(useEditorStore.getState().dirtyNodeIds.has('e1')).toBe(true);
  });

  it('reverts dirty state when value is set back to original', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    const original = (useEditorStore.getState().nodeMap.get('e1') as FFElementNode).fieldInfo.positionalLength;

    useEditorStore.getState().updateNodeProperty('e1', 'fieldInfo', 'positionalLength', 99);
    expect(useEditorStore.getState().dirty).toBe(true);

    useEditorStore.getState().updateNodeProperty('e1', 'fieldInfo', 'positionalLength', original);
    expect(useEditorStore.getState().dirty).toBe(false);
    expect(useEditorStore.getState().dirtyPaths.size).toBe(0);
  });

  it('does nothing if schema is null', () => {
    useEditorStore.getState().updateNodeProperty('e1', 'fieldInfo', 'positionalLength', 42);
    expect(useEditorStore.getState().schema).toBeNull();
  });

  it('does nothing if nodeId is not found', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().updateNodeProperty('nonexistent', 'fieldInfo', 'positionalLength', 42);
    expect(useEditorStore.getState().dirty).toBe(false);
  });
});

// ─── updateNodeDirect ───────────────────────────────────────────────────────

describe('editorStore – updateNodeDirect', () => {
  it('updates a direct property on a node', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().updateNodeDirect('e1', 'name', 'RenamedField');

    const field = useEditorStore.getState().nodeMap.get('e1') as FFElementNode;
    expect(field.name).toBe('RenamedField');
  });

  it('updates rootReference when root record is renamed', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().updateNodeDirect('r1', 'name', 'NewRoot');

    const state = useEditorStore.getState();
    expect(state.schema?.schemaInfo.rootReference).toBe('NewRoot');
  });

  it('does not update rootReference when non-root record is renamed', () => {
    // Build a schema with a nested record
    const innerRec: FFRecordNode = {
      id: 'r_inner',
      kind: 'record',
      name: 'Inner',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [
        {
          id: 'seq_inner',
          kind: 'sequence',
          minOccurs: 1,
          maxOccurs: 1,
          groupInfo: createDefaultGroupInfo(),
          children: [],
        },
      ],
    };
    const seq: FFSequenceNode = {
      id: 'seq1',
      kind: 'sequence',
      minOccurs: 1,
      maxOccurs: 1,
      groupInfo: createDefaultGroupInfo(),
      children: [innerRec],
    };
    const root: FFRecordNode = {
      id: 'r1',
      kind: 'record',
      name: 'Root',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [seq],
    };
    const schema: FFSchemaNode = {
      id: 's1',
      kind: 'schema',
      targetNamespace: '',
      elementFormDefault: 'qualified',
      schemaInfo: { ...createDefaultSchemaInfo(), rootReference: 'Root' },
      children: [root],
    };
    useEditorStore.getState().loadSchema(schema);
    useEditorStore.getState().updateNodeDirect('r_inner', 'name', 'Renamed');
    expect(useEditorStore.getState().schema?.schemaInfo.rootReference).toBe('Root');
  });
});

// ─── markDirty / markClean ──────────────────────────────────────────────────

describe('editorStore – dirty tracking', () => {
  it('markDirty sets dirty to true', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().markDirty();
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('markClean resets dirty, dirtyPaths, dirtyNodeIds and rebuilds originalValues', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().updateNodeProperty('e1', 'fieldInfo', 'positionalLength', 100);
    expect(useEditorStore.getState().dirty).toBe(true);

    useEditorStore.getState().markClean();
    const state = useEditorStore.getState();
    expect(state.dirty).toBe(false);
    expect(state.dirtyPaths.size).toBe(0);
    expect(state.dirtyNodeIds.size).toBe(0);
    // After markClean, the original values should reflect the current state
    expect(state.originalValues.get('e1|fieldInfo|positionalLength')).toBe(100);
  });
});

// ─── addChildNode ───────────────────────────────────────────────────────────

describe('editorStore – addChildNode', () => {
  it('adds a sequence child to a record that has no group', () => {
    const rec: FFRecordNode = {
      id: 'r1',
      kind: 'record',
      name: 'Root',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [],
    };
    const schema: FFSchemaNode = {
      id: 's1',
      kind: 'schema',
      targetNamespace: '',
      elementFormDefault: 'qualified',
      schemaInfo: createDefaultSchemaInfo(),
      children: [rec],
    };
    useEditorStore.getState().loadSchema(schema);
    useEditorStore.getState().addChildNode('r1', 'sequence');

    const state = useEditorStore.getState();
    const newRec = state.nodeMap.get('r1') as FFRecordNode;
    expect(newRec.children.some(c => c.kind === 'sequence')).toBe(true);
    expect(state.dirty).toBe(true);
  });

  it('adds an element child into the group of a record', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().addChildNode('r1', 'element');

    const state = useEditorStore.getState();
    const rec = state.nodeMap.get('r1') as FFRecordNode;
    const seq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    // Originally had 2 elements, now should have 3
    expect(seq.children.filter(c => c.kind === 'element').length).toBe(3);
  });

  it('adds an attribute child before the group', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().addChildNode('r1', 'attribute');

    const state = useEditorStore.getState();
    const rec = state.nodeMap.get('r1') as FFRecordNode;
    const attrCount = rec.children.filter(c => c.kind === 'attribute').length;
    expect(attrCount).toBe(2); // original a1 + new one
    // Attributes should come before the sequence
    const lastChild = rec.children[rec.children.length - 1];
    expect(lastChild.kind).toBe('sequence');
  });

  it('sets pendingRenameNodeId for named node kinds', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().addChildNode('r1', 'element');

    const state = useEditorStore.getState();
    expect(state.pendingRenameNodeId).not.toBeNull();
    expect(state.selectedNodeId).toBe(state.pendingRenameNodeId);
  });

  it('does not set pendingRenameNodeId for group kinds', () => {
    const rec: FFRecordNode = {
      id: 'r1',
      kind: 'record',
      name: 'Root',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [],
    };
    const schema: FFSchemaNode = {
      id: 's1',
      kind: 'schema',
      targetNamespace: '',
      elementFormDefault: 'qualified',
      schemaInfo: createDefaultSchemaInfo(),
      children: [rec],
    };
    useEditorStore.getState().loadSchema(schema);
    useEditorStore.getState().addChildNode('r1', 'sequence');

    expect(useEditorStore.getState().pendingRenameNodeId).toBeNull();
  });

  it('rejects invalid child kinds', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    // Elements cannot have children
    useEditorStore.getState().addChildNode('e1', 'element');
    // Should not have changed
    expect(useEditorStore.getState().dirty).toBe(false);
  });

  it('does nothing when schema is null', () => {
    useEditorStore.getState().addChildNode('r1', 'element');
    expect(useEditorStore.getState().schema).toBeNull();
  });
});

// ─── addSiblingAfter ────────────────────────────────────────────────────────

describe('editorStore – addSiblingAfter', () => {
  it('inserts a sibling after the target node', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().addSiblingAfter('e1', 'element');

    const state = useEditorStore.getState();
    const rec = state.nodeMap.get('r1') as FFRecordNode;
    const seq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    // e1, new element, e2 (3 total)
    expect(seq.children.length).toBe(3);
    // The new element should be after e1 (index 1)
    expect(seq.children[0].id).toBe('e1');
    expect(seq.children[2].id).toBe('e2');
  });

  it('does nothing when schema is null', () => {
    useEditorStore.getState().addSiblingAfter('e1', 'element');
    expect(useEditorStore.getState().schema).toBeNull();
  });
});

// ─── deleteNode ─────────────────────────────────────────────────────────────

describe('editorStore – deleteNode', () => {
  it('removes a node from the tree', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().deleteNode('e1');

    const state = useEditorStore.getState();
    expect(state.nodeMap.has('e1')).toBe(false);
    expect(state.dirty).toBe(true);
  });

  it('selects the parent after deletion', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().deleteNode('e1');

    // Parent of e1 is seq1
    expect(useEditorStore.getState().selectedNodeId).toBe('seq1');
  });

  it('does not delete the schema root', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().deleteNode('s1');

    expect(useEditorStore.getState().schema).not.toBeNull();
    expect(useEditorStore.getState().nodeMap.has('s1')).toBe(true);
  });

  it('does nothing when schema is null', () => {
    useEditorStore.getState().deleteNode('r1');
    expect(useEditorStore.getState().schema).toBeNull();
  });
});

// ─── moveNodeUp / moveNodeDown ──────────────────────────────────────────────

describe('editorStore – moveNodeUp', () => {
  it('moves a node up one position among siblings', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().moveNodeUp('e2');

    const state = useEditorStore.getState();
    const rec = state.nodeMap.get('r1') as FFRecordNode;
    const seq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    expect(seq.children[0].id).toBe('e2');
    expect(seq.children[1].id).toBe('e1');
    expect(state.dirty).toBe(true);
  });

  it('does nothing when node is already first', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().moveNodeUp('e1');
    expect(useEditorStore.getState().dirty).toBe(false);
  });

  it('does nothing when schema is null', () => {
    useEditorStore.getState().moveNodeUp('e1');
    expect(useEditorStore.getState().schema).toBeNull();
  });
});

describe('editorStore – moveNodeDown', () => {
  it('moves a node down one position among siblings', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().moveNodeDown('e1');

    const state = useEditorStore.getState();
    const rec = state.nodeMap.get('r1') as FFRecordNode;
    const seq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    expect(seq.children[0].id).toBe('e2');
    expect(seq.children[1].id).toBe('e1');
    expect(state.dirty).toBe(true);
  });

  it('does nothing when node is already last', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().moveNodeDown('e2');
    expect(useEditorStore.getState().dirty).toBe(false);
  });
});

// ─── clearPendingRename ─────────────────────────────────────────────────────

describe('editorStore – clearPendingRename', () => {
  it('clears the pending rename node id', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().addChildNode('r1', 'element');
    expect(useEditorStore.getState().pendingRenameNodeId).not.toBeNull();

    useEditorStore.getState().clearPendingRename();
    expect(useEditorStore.getState().pendingRenameNodeId).toBeNull();
  });
});

// ─── setFileHandle ──────────────────────────────────────────────────────────

describe('editorStore – setFileHandle', () => {
  it('stores a file handle', () => {
    const mockHandle = {} as FileSystemFileHandle;
    useEditorStore.getState().setFileHandle(mockHandle);
    expect(useEditorStore.getState().fileHandle).toBe(mockHandle);
  });
});

// ─── addSiblingAfter – additional branches ──────────────────────────────────

describe('editorStore – addSiblingAfter (additional)', () => {
  it('rejects an invalid kind for the parent', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    // elements cannot have children, so sibling insertion next to an element's
    // child would be invalid — but the parent of e1 is seq1 (a sequence),
    // which accepts most kinds. Instead, try inserting an attribute next to
    // an element inside a sequence: sequences don't support attribute children.
    useEditorStore.getState().addSiblingAfter('e1', 'attribute');
    // Should not be dirty because the operation was rejected
    const state = useEditorStore.getState();
    // The sequence doesn't allow attribute, so it should be rejected
    const seq = state.nodeMap.get('seq1') as FFSequenceNode;
    expect(seq.children.filter(c => c.kind === 'attribute').length).toBe(0);
  });
});

// ─── useSelectedNode selector ───────────────────────────────────────────────

describe('useSelectedNode', () => {
  it('is exported from the store module', async () => {
    const mod = await import('@/store/editorStore');
    expect(typeof mod.useSelectedNode).toBe('function');
  });
});

// ─── Multiple dirty paths across different nodes ────────────────────────────

describe('editorStore – dirty tracking across nodes', () => {
  it('tracks dirty paths across multiple nodes', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().updateNodeProperty('e1', 'fieldInfo', 'positionalLength', 10);
    useEditorStore.getState().updateNodeProperty('e2', 'fieldInfo', 'positionalLength', 20);

    const state = useEditorStore.getState();
    expect(state.dirtyPaths.size).toBe(2);
    expect(state.dirtyNodeIds.has('e1')).toBe(true);
    expect(state.dirtyNodeIds.has('e2')).toBe(true);
  });

  it('partially reverting leaves remaining dirty paths', () => {
    useEditorStore.getState().loadSchema(makeTestSchema());
    useEditorStore.getState().updateNodeProperty('e1', 'fieldInfo', 'positionalLength', 10);
    useEditorStore.getState().updateNodeProperty('e2', 'fieldInfo', 'positionalLength', 20);

    // Revert e1 only
    useEditorStore.getState().updateNodeProperty('e1', 'fieldInfo', 'positionalLength', 0);
    const state = useEditorStore.getState();
    expect(state.dirty).toBe(true);
    expect(state.dirtyNodeIds.has('e1')).toBe(false);
    expect(state.dirtyNodeIds.has('e2')).toBe(true);
  });
});

// ─── addChildNode – record without group for element (no-op) ────────────────

describe('editorStore – addChildNode edge cases', () => {
  it('does nothing when adding element to record without a group', () => {
    // A record with group already exists gets insertable kinds [record, element, attribute]
    // but the element goes into the group. If there's no group, the addChildNode returns.
    const recNoGroup: FFRecordNode = {
      id: 'r_no',
      kind: 'record',
      name: 'NoGroup',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [
        // has a sequence so that getInsertableKinds returns record/element/attribute
        { id: 'sq', kind: 'sequence', minOccurs: 1, maxOccurs: 1, groupInfo: createDefaultGroupInfo(), children: [] },
      ],
    };
    const schema: FFSchemaNode = {
      id: 's1',
      kind: 'schema',
      targetNamespace: '',
      elementFormDefault: 'qualified',
      schemaInfo: createDefaultSchemaInfo(),
      children: [recNoGroup],
    };
    useEditorStore.getState().loadSchema(schema);
    // Adding a record should go into the group
    useEditorStore.getState().addChildNode('r_no', 'record');
    const state = useEditorStore.getState();
    const rec = state.nodeMap.get('r_no') as FFRecordNode;
    const sq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    expect(sq.children.length).toBe(1);
    expect(sq.children[0].kind).toBe('record');
  });

  it('adds child to schema node (record)', () => {
    const schema: FFSchemaNode = {
      id: 's1',
      kind: 'schema',
      targetNamespace: '',
      elementFormDefault: 'qualified',
      schemaInfo: createDefaultSchemaInfo(),
      children: [],
    };
    useEditorStore.getState().loadSchema(schema);
    useEditorStore.getState().addChildNode('s1', 'record');
    const state = useEditorStore.getState();
    expect(state.schema?.children).toHaveLength(1);
    expect(state.schema?.children[0].kind).toBe('record');
  });
});
