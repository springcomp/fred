import {
  buildNodeMap,
  createDefaultFieldInfo,
  createDefaultGroupInfo,
  createDefaultRecordInfo,
  createDefaultSchemaInfo,
  type FFElementNode,
  type FFRecordNode,
  type FFSchemaNode,
  type FFSequenceNode,
} from '@/model/types';

/**
 * Build a schema tree of configurable size for benchmarking.
 *
 * The tree is shaped as a flat list of records under the root schema,
 * each record containing a sequence with the requested number of fields.
 *
 * Total node count ≈ 1 (schema) + records × (1 record + 1 sequence + fieldsPerRecord)
 *
 * @param records          Number of record nodes (default 10).
 * @param fieldsPerRecord  Number of element (field) children per record (default 5).
 * @returns {{ schema, nodeMap, firstFieldId, firstRecordId, midFieldId }}
 *          The schema root, pre-built node map, and a few ids useful for targeting
 *          operations in benchmarks.
 */
export function makeScaledSchema(
  records = 10,
  fieldsPerRecord = 5,
): {
  schema: FFSchemaNode;
  nodeMap: Map<string, import('@/model/types').FFNode>;
  firstFieldId: string;
  firstRecordId: string;
  midFieldId: string;
} {
  let idCounter = 0;
  const nextId = () => `n${++idCounter}`;

  let firstFieldId = '';
  let firstRecordId = '';
  let midFieldId = '';
  const midRecord = Math.floor(records / 2);
  const midField = Math.floor(fieldsPerRecord / 2);

  const recordNodes: FFRecordNode[] = [];

  for (let r = 0; r < records; r++) {
    const fields: FFElementNode[] = [];
    for (let f = 0; f < fieldsPerRecord; f++) {
      const fId = nextId();
      if (r === 0 && f === 0) firstFieldId = fId;
      if (r === midRecord && f === midField) midFieldId = fId;

      fields.push({
        id: fId,
        kind: 'element',
        name: `Field_${r}_${f}`,
        namespace: '',
        dataType: 'xs:string',
        minOccurs: 1,
        maxOccurs: 1,
        fieldInfo: createDefaultFieldInfo(),
        children: [],
      });
    }

    const seqId = nextId();
    const seq: FFSequenceNode = {
      id: seqId,
      kind: 'sequence',
      minOccurs: 1,
      maxOccurs: 1,
      groupInfo: createDefaultGroupInfo(),
      children: fields,
    };

    const rId = nextId();
    if (r === 0) firstRecordId = rId;

    recordNodes.push({
      id: rId,
      kind: 'record',
      name: `Record${r}`,
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [seq],
    });
  }

  const schema: FFSchemaNode = {
    id: nextId(),
    kind: 'schema',
    targetNamespace: 'http://bench.example.com',
    elementFormDefault: 'qualified',
    schemaInfo: { ...createDefaultSchemaInfo(), rootReference: 'Record0' },
    children: recordNodes,
  };

  const nodeMap = buildNodeMap(schema);
  return { schema, nodeMap, firstFieldId, firstRecordId, midFieldId };
}

/** Return the total number of nodes in a scaled schema. */
export function estimateNodeCount(records: number, fieldsPerRecord: number): number {
  // 1 schema + records * (1 record + 1 sequence + fieldsPerRecord fields)
  return 1 + records * (2 + fieldsPerRecord);
}
