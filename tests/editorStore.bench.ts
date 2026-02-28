import { bench, describe } from 'vitest';
import { buildNodeMap } from '@/model/types';
import { useEditorStore } from '@/store/editorStore';
import { estimateNodeCount, makeScaledSchema } from './helpers';

// ─── Configuration ──────────────────────────────────────────────────────────
// Each entry: [records, fieldsPerRecord]
const SIZES: [number, number][] = [
  [2, 3], // ~11 nodes   (small)
  [15, 5], // ~106 nodes  (medium)
  [70, 6], // ~561 nodes  (large)
  [250, 7], // ~2251 nodes (xlarge)
];

// ─── Isolated component benchmarks ─────────────────────────────────────────

describe('structuredClone – isolated', () => {
  for (const [records, fields] of SIZES) {
    const n = estimateNodeCount(records, fields);
    const { schema } = makeScaledSchema(records, fields);

    bench(`structuredClone (${n} nodes)`, () => {
      structuredClone(schema);
    });
  }
});

describe('buildNodeMap – isolated', () => {
  for (const [records, fields] of SIZES) {
    const n = estimateNodeCount(records, fields);
    const { schema } = makeScaledSchema(records, fields);

    bench(`buildNodeMap (${n} nodes)`, () => {
      buildNodeMap(schema);
    });
  }
});

// ─── Full store action benchmarks ───────────────────────────────────────────

for (const [records, fields] of SIZES) {
  const n = estimateNodeCount(records, fields);

  describe(`updateNodeProperty (${n} nodes)`, () => {
    const { schema, firstFieldId } = makeScaledSchema(records, fields);

    bench('single call', () => {
      useEditorStore.getState().loadSchema(structuredClone(schema));
      useEditorStore.getState().updateNodeProperty(firstFieldId, 'fieldInfo', 'positionalLength', 42);
    });
  });

  describe(`updateNodeDirect (${n} nodes)`, () => {
    const { schema, firstFieldId } = makeScaledSchema(records, fields);

    bench('single call', () => {
      useEditorStore.getState().loadSchema(structuredClone(schema));
      useEditorStore.getState().updateNodeDirect(firstFieldId, 'dataType', 'xs:int');
    });
  });

  describe(`addChildNode (${n} nodes)`, () => {
    const { schema, firstRecordId } = makeScaledSchema(records, fields);

    bench('single call', () => {
      useEditorStore.getState().loadSchema(structuredClone(schema));
      useEditorStore.getState().addChildNode(firstRecordId, 'element');
    });
  });

  describe(`addSiblingAfter (${n} nodes)`, () => {
    const { schema, midFieldId } = makeScaledSchema(records, fields);

    bench('single call', () => {
      useEditorStore.getState().loadSchema(structuredClone(schema));
      useEditorStore.getState().addSiblingAfter(midFieldId, 'element');
    });
  });

  describe(`deleteNode (${n} nodes)`, () => {
    const { schema, midFieldId } = makeScaledSchema(records, fields);

    bench('single call', () => {
      useEditorStore.getState().loadSchema(structuredClone(schema));
      useEditorStore.getState().deleteNode(midFieldId);
    });
  });

  describe(`moveNodeUp (${n} nodes)`, () => {
    const { schema, midFieldId } = makeScaledSchema(records, fields);

    bench('single call', () => {
      useEditorStore.getState().loadSchema(structuredClone(schema));
      useEditorStore.getState().moveNodeUp(midFieldId);
    });
  });

  describe(`moveNodeDown (${n} nodes)`, () => {
    const { schema, midFieldId } = makeScaledSchema(records, fields);

    bench('single call', () => {
      useEditorStore.getState().loadSchema(structuredClone(schema));
      useEditorStore.getState().moveNodeDown(midFieldId);
    });
  });
}

// ─── Rapid-fire keystroke simulation ────────────────────────────────────────

describe('rapid-fire updateNodeProperty (typing simulation)', () => {
  for (const [records, fields] of SIZES) {
    const n = estimateNodeCount(records, fields);
    const { schema, firstFieldId } = makeScaledSchema(records, fields);

    bench(`50 keystrokes (${n} nodes)`, () => {
      useEditorStore.getState().loadSchema(structuredClone(schema));
      for (let i = 0; i < 50; i++) {
        useEditorStore.getState().updateNodeProperty(firstFieldId, 'fieldInfo', 'dateTimeFormat', 'x'.repeat(i));
      }
    });
  }
});
