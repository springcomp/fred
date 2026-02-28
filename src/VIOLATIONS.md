# Code Violations & Best Practice Issues

## 1. Duplicated Code ✅

### 1a. `parseSequenceChildren` / `parseChoiceChildren` (parser.ts, lines 239–310) ✅

> **Resolved** — Unified into a single `parseGroupChildren` function accepting a `FFRecordNode | FFSequenceNode | FFChoiceNode` parent.

These two functions are nearly identical ~35-line blocks. Both iterate over XS child elements and handle `element`, `sequence`, and `choice` in exactly the same way. The only semantic difference is the parent type signature.

**Current code** (`parseSequenceChildren`):

```ts
function parseSequenceChildren(seqEl: Element, parent: FFRecordNode | FFSequenceNode, schemaInfo: SchemaInfo) {
  for (const child of xsChildren(seqEl)) {
    if (child.localName === 'element' && child.namespaceURI === XS) {
      const parsed = parseElement(child, schemaInfo);
      if (parsed) { parent.children.push(parsed); }
    } else if (child.localName === 'sequence' && child.namespaceURI === XS) {
      const groupInfo = parseGroupInfo(child) ?? createDefaultGroupInfo();
      const seqNode: FFSequenceNode = { id: uid(), kind: 'sequence', ... };
      parseSequenceChildren(child, seqNode, schemaInfo);
      parent.children.push(seqNode);
    } else if (child.localName === 'choice' && child.namespaceURI === XS) {
      const groupInfo = parseGroupInfo(child) ?? createDefaultGroupInfo();
      const choiceNode: FFChoiceNode = { id: uid(), kind: 'choice', ... };
      parseChoiceChildren(child, choiceNode, schemaInfo);
      parent.children.push(choiceNode);
    }
  }
}
```

`parseChoiceChildren` is identical except its parent parameter type is `FFRecordNode | FFChoiceNode`.

**Suggested fix**: Unify into a single function:

```ts
function parseGroupChildren(
  groupEl: Element,
  parent: FFRecordNode | FFSequenceNode | FFChoiceNode,
  schemaInfo: SchemaInfo,
) {
  for (const child of xsChildren(groupEl)) {
    if (child.localName === 'element' && child.namespaceURI === XS) {
      const parsed = parseElement(child, schemaInfo);
      if (parsed) parent.children.push(parsed);
    } else if (child.localName === 'sequence' && child.namespaceURI === XS) {
      const groupInfo = parseGroupInfo(child) ?? createDefaultGroupInfo();
      const seqNode: FFSequenceNode = {
        id: uid(), kind: 'sequence',
        minOccurs: intAttr(child, 'minOccurs', 1),
        maxOccurs: maxOccursAttr(child),
        groupInfo, children: [],
      };
      parseGroupChildren(child, seqNode, schemaInfo);
      parent.children.push(seqNode);
    } else if (child.localName === 'choice' && child.namespaceURI === XS) {
      const groupInfo = parseGroupInfo(child) ?? createDefaultGroupInfo();
      const choiceNode: FFChoiceNode = {
        id: uid(), kind: 'choice',
        minOccurs: intAttr(child, 'minOccurs', 1),
        maxOccurs: maxOccursAttr(child),
        groupInfo, children: [],
      };
      parseGroupChildren(child, choiceNode, schemaInfo);
      parent.children.push(choiceNode);
    }
  }
}
```

---

### 1b. `serializeSequence` / `serializeChoice` (serializer.ts, lines 223–256) ✅

> **Resolved** — Unified into `serializeGroup(tagName, node, lines, depth)` parameterised by tag name.

Both functions follow the same pattern — open tag, annotation, children, close tag — differing only in the XML tag name (`xs:sequence` vs `xs:choice`).

**Current code** (`serializeSequence`):

```ts
function serializeSequence(node: FFSequenceNode, lines: string[], depth: number) {
  const ind = '  '.repeat(depth);
  const occAttrs = occurrenceAttrs(node.minOccurs, node.maxOccurs);
  const groupAttrs = serializeGroupInfoAttrs(node.groupInfo);
  lines.push(`${ind}<xs:sequence${occAttrs}>`);
  if (groupAttrs) {
    lines.push(`${ind}  <xs:annotation>`);
    lines.push(`${ind}    <xs:appinfo>`);
    lines.push(`${ind}      <b:groupInfo ${groupAttrs} />`);
    lines.push(`${ind}    </xs:appinfo>`);
    lines.push(`${ind}  </xs:annotation>`);
  }
  for (const child of node.children) { serializeNode(child, lines, depth + 1); }
  lines.push(`${ind}</xs:sequence>`);
}
```

`serializeChoice` is identical but uses `xs:choice`.

**Suggested fix**:

```ts
function serializeGroup(
  tagName: 'sequence' | 'choice',
  node: FFSequenceNode | FFChoiceNode,
  lines: string[],
  depth: number,
) {
  const ind = '  '.repeat(depth);
  const occAttrs = occurrenceAttrs(node.minOccurs, node.maxOccurs);
  const groupAttrs = serializeGroupInfoAttrs(node.groupInfo);
  lines.push(`${ind}<xs:${tagName}${occAttrs}>`);
  if (groupAttrs) {
    lines.push(`${ind}  <xs:annotation>`);
    lines.push(`${ind}    <xs:appinfo>`);
    lines.push(`${ind}      <b:groupInfo ${groupAttrs} />`);
    lines.push(`${ind}    </xs:appinfo>`);
    lines.push(`${ind}  </xs:annotation>`);
  }
  for (const child of node.children) { serializeNode(child, lines, depth + 1); }
  lines.push(`${ind}</xs:${tagName}>`);
}
```

---

### 1c. Duplicated `findParent` Tree Walk ✅

> **Resolved** — Exported a single `findParent()` from `model/types.ts`; removed duplicates from `editorStore.ts` and `ContextMenu.tsx`.

**File 1** — `editorStore.ts` (lines 420–434):

```ts
function findParent(root: FFNode, childId: string): { parent: FFNode; index: number } | null {
  function walk(node: FFNode): { parent: FFNode; index: number } | null {
    for (let i = 0; i < node.children.length; i++) {
      if (node.children[i].id === childId) return { parent: node, index: i };
      const found = walk(node.children[i]);
      if (found) return found;
    }
    return null;
  }
  return walk(root);
}
```

**File 2** — `ContextMenu.tsx` (lines 258–271):

```ts
function findParentNode(root: FFNode, childId: string): FFNode | null {
  function walk(node: FFNode): FFNode | null {
    for (const child of node.children) {
      if (child.id === childId) return node;
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }
  return walk(root);
}
```

Functionally identical — the store version also returns the index.

**Suggested fix**: Export a single `findParent()` from `model/types.ts`. The `ContextMenu` version can simply discard the index.

---

### 1d. `UNBOUNDED` Constant Defined 4 Times ✅

> **Resolved** — Exported `UNBOUNDED` from `model/types.ts`; all four local definitions removed.

| Location | Code |
|----------|------|
| `SchemaTree.tsx:13` | `const UNBOUNDED = Number.MAX_SAFE_INTEGER;` |
| `PropertyFields.tsx:163` | `const UNBOUNDED = Number.MAX_SAFE_INTEGER;` |
| `InfoPanels.tsx:305` (inside `RecordInfoPanel`) | `const UNBOUNDED = Number.MAX_SAFE_INTEGER;` |
| `InfoPanels.tsx:530` (inside `GroupInfoPanel`) | `const UNBOUNDED = Number.MAX_SAFE_INTEGER;` |

**Suggested fix**: Export `UNBOUNDED` from `model/types.ts`:

```ts
export const UNBOUNDED = Number.MAX_SAFE_INTEGER;
```

Import everywhere else.

---

### 1e. Icon Maps and Kind-Label Helpers Duplicated ✅

> **Resolved** — Exported `insertKindIcon` and `insertKindLabel` from `NodeIcon.tsx`; removed copies from `Toolbar.tsx` and `ContextMenu.tsx`.

**Toolbar.tsx** (lines 225–235):

```ts
const insertKindIcon: Record<InsertableKind, React.ReactNode> = {
  record: <FolderOpen size={14} className="text-node-record" />,
  element: <Diamond size={14} className="text-node-element" />,
  sequence: <ListOrdered size={14} className="text-node-sequence" />,
  choice: <GitBranch size={14} className="text-node-choice" />,
  attribute: <AtSign size={14} className="text-node-attribute" />,
};
function insertKindLabel(kind: InsertableKind): string {
  return kind === 'element' ? 'Field' : nodeKindLabel(kind);
}
```

**ContextMenu.tsx** (lines 30–40):

```ts
const kindIcon: Record<InsertableKind, React.ReactNode> = {
  record: <FolderOpen size={14} className="text-node-record" />,
  element: <Diamond size={14} className="text-node-element" />,
  sequence: <ListOrdered size={14} className="text-node-sequence" />,
  choice: <GitBranch size={14} className="text-node-choice" />,
  attribute: <AtSign size={14} className="text-node-attribute" />,
};
function kindLabel(kind: InsertableKind): string {
  return kind === 'element' ? 'Field' : nodeKindLabel(kind);
}
```

These are identical copies.

**Suggested fix**: Export both from `NodeIcon.tsx`:

```ts
export const insertKindIcon: Record<InsertableKind, React.ReactNode> = { ... };
export function insertKindLabel(kind: InsertableKind): string { ... }
```

---

### 1f. `handleMinOccursChange` Duplicated in Two Panels ✅

> **Resolved** — Extracted `createMinOccursHandler(maxOccurs, onDirectChange)` factory used by both panels.

**InfoPanels.tsx** — inside `RecordInfoPanel` (line ~305):

```ts
const UNBOUNDED = Number.MAX_SAFE_INTEGER;
const handleMinOccursChange = (v: number) => {
  onDirectChange('minOccurs', v);
  if (maxOccurs !== UNBOUNDED && v > maxOccurs) {
    onDirectChange('maxOccurs', v);
  }
};
```

**InfoPanels.tsx** — inside `GroupInfoPanel` (line ~530):

```ts
const UNBOUNDED = Number.MAX_SAFE_INTEGER;
const handleMinOccursChange = (v: number) => {
  onDirectChange('minOccurs', v);
  if (maxOccurs !== UNBOUNDED && v > maxOccurs) {
    onDirectChange('maxOccurs', v);
  }
};
```

**Suggested fix**: Extract into a shared helper:

```ts
function createMinOccursHandler(
  maxOccurs: number,
  onDirectChange: (prop: string, value: unknown) => void,
) {
  return (v: number) => {
    onDirectChange('minOccurs', v);
    if (maxOccurs !== UNBOUNDED && v > maxOccurs) {
      onDirectChange('maxOccurs', v);
    }
  };
}
```

---

## 2. Performance: `structuredClone` on Every Keystroke ✅

> **Resolved** — Replaced `structuredClone` with Immer `produce()` in all 7 store actions for surgical immutable updates with structural sharing.

**File**: `editorStore.ts`, line 158 (and 6 other store actions).

Every call to `updateNodeProperty` or `updateNodeDirect` performs:

```ts
const newSchema = structuredClone(schema);
const newMap = buildNodeMap(newSchema);
```

This is a **full deep-clone of the entire tree + a full tree walk** on every single property change, including each keystroke in a text input. For schemas with hundreds of nodes, this will introduce visible lag.

The same clone+rebuild pattern is repeated in 7 actions: `updateNodeProperty`, `updateNodeDirect`, `addChildNode`, `addSiblingAfter`, `deleteNode`, `moveNodeUp`, `moveNodeDown`.

**Suggested fix**:

1. Use **Immer** (`produce()`) for surgical immutable updates instead of `structuredClone`.
2. At minimum, extract the common pattern into a helper:

   ```ts
   function mutateTree(schema: FFSchemaNode, mutator: (newSchema: FFSchemaNode, newMap: Map<string, FFNode>) => void) {
     const newSchema = structuredClone(schema);
     const newMap = buildNodeMap(newSchema);
     mutator(newSchema, newMap);
     return { schema: newSchema, nodeMap: buildNodeMap(newSchema) };
   }
   ```

3. Consider **debouncing** text input updates to reduce clone frequency.

---

## 3. Dirty-Tracking Logic Duplicated in Store ✅

> **Resolved** — Extracted `applyDirtyTracking(pathKey, value, get)` helper shared by `updateNodeProperty` and `updateNodeDirect`.

**File**: `editorStore.ts`, lines 168–195 and 210–235.

`updateNodeProperty` and `updateNodeDirect` share ~15 identical lines:

```ts
const pathKey = `${nodeId}|${infoKey}|${property}`;  // or `${nodeId}|.|${property}`
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
```

**Suggested fix**: Extract:

```ts
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
```

---

## 4. Dead/Redundant Code in Serializer ✅

> **Resolved** — Removed the no-op `if/else`; `structure` is now always serialized unconditionally.

**File**: `serializer.ts`, lines 347–350.

```ts
if (info.structure !== defaults.structure) {
    attrs.push(attr('structure', info.structure));
} else {
    attrs.push(attr('structure', info.structure));
}
```

Both branches execute the same statement. The `if/else` is a no-op.

**Suggested fix**: Remove the conditional:

```ts
attrs.push(attr('structure', info.structure));
```

---

## 5. Module-Level Mutable State (Two Separate ID Counters) ✅

> **Resolved** — Editor-generated IDs now use an `e` prefix (`e1`, `e2`, …) instead of the fragile 1000-gap, with a `resetEditorIds()` helper for tests.

**File 1**: `parser.ts`, line 39:

```ts
let nextId = 1;
```

Reset by `resetIds()` before each parse.

**File 2**: `types.ts`, line 276:

```ts
let _nextId = 1000;
```

Never reset. Used by `generateNodeId()` for new nodes added interactively.

The magic gap of 1000 is intended to avoid collisions between parser-generated IDs (`n1`, `n2`, ...) and editor-generated IDs (`n1000`, `n1001`, ...). This is **fragile** — a schema with 1000+ nodes would collide.

**Suggested fix**: Use `crypto.randomUUID()` or a `nanoid`-style generator. Alternatively, use separate prefixes (e.g. `p1`, `p2` for parsed nodes and `e1`, `e2` for editor-created nodes).

---

## 6. `window.CustomEvent` Bypasses React Data Flow

**File**: `SchemaTree.tsx`, lines 100–107.

Node rows dispatch a `window.CustomEvent('tree-context-menu', ...)`:

```ts
window.dispatchEvent(
  new CustomEvent('tree-context-menu', {
    detail: { x: e.clientX, y: e.clientY, nodeId: data.id },
  }),
);
```

The `SchemaTree` component listens for this event via `window.addEventListener`. This pattern:

- Bypasses React's unidirectional data flow.
- Is harder to test and debug.
- Couples components through a global event bus.

**Suggested fix**: Use a Zustand store slice, a React Context, or pass callback props through react-arborist's render mechanism.

---

## 7. Misplaced `downloadAsFile` Utility ✅

> **Resolved** — Moved to `src/utils/download.ts`.

**File**: `serializer.ts`, lines 468–477.

```ts
export function downloadAsFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

This is a DOM side-effect utility that creates an anchor element and triggers a download. It has nothing to do with XSD serialization logic.

**Suggested fix**: Move to `utils/download.ts` or inline within `Toolbar.tsx`.

---

## 8. Global Type Declarations in a Component File ✅

> **Resolved** — Moved to `src/types/file-system-access.d.ts`.

**File**: `Toolbar.tsx`, lines 23–39.

```ts
declare global {
  interface Window {
    showOpenFilePicker?: ...;
    showSaveFilePicker?: ...;
  }
  interface OpenFilePickerOptions { ... }
  interface SaveFilePickerOptions { ... }
  interface FilePickerAcceptType { ... }
}
```

Global `declare` blocks should not live inside a React component file.

**Suggested fix**: Move to `src/types/file-system-access.d.ts` (a standalone `.d.ts` file that TypeScript automatically includes).

---

## 9. Unsafe Type Casts in Store ✅

> **Resolved** — Added typed `getNodeInfo(node, infoKey)` and `getNodeDirect(node, property)` accessors replacing the double-cast.

**File**: `editorStore.ts`, lines 39, 166–167.

```ts
const info = (node as unknown as Record<string, unknown>)[infoKey];
```

This double cast (`as unknown as Record<string, unknown>`) completely bypasses TypeScript's type system. If `infoKey` is wrong, this silently fails at runtime.

**Suggested fix**: Use a typed accessor:

```ts
function getNodeInfo(node: FFNode, infoKey: string): Record<string, unknown> | null {
  switch (node.kind) {
    case 'schema': return infoKey === 'schemaInfo' ? node.schemaInfo : null;
    case 'record': return infoKey === 'recordInfo' ? node.recordInfo : null;
    case 'element':
    case 'attribute': return infoKey === 'fieldInfo' ? node.fieldInfo : null;
    case 'sequence':
    case 'choice': return infoKey === 'groupInfo' ? node.groupInfo : null;
  }
}
```

---

## 10. Label Component Default Class Bug ✅

> **Resolved** — `font-medium` is now always included as a base class; `className` is additive.

**File**: `Label.tsx`, line 5.

```tsx
className={`text-xs leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className ?? 'font-medium'}`}
```

When a `className` is passed (e.g. `"font-bold"` for dirty labels), `font-medium` is silently dropped. But when no `className` is passed, `font-medium` is applied. This means:

- Clean label: `font-medium` (correct)
- Dirty label: `font-bold` but **no** `font-medium` fallback (which happens to work by accident since bold overrides medium)
- If any other className is passed (e.g. `"text-red-500"`), `font-medium` disappears.

**Suggested fix**: Always include the base class and use `clsx` / additive merging:

```tsx
className={`text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className ?? ''}`}
```

---

## 11. Unused Props in GroupInfoPanel ✅

> **Resolved** — Removed the unused `info`, `onChange`, and `isDirty` props from `GroupInfoPanel` and its interface.

**File**: `InfoPanels.tsx`, lines 522–525.

```ts
export function GroupInfoPanel({
  info: _info,
  ...
  onChange: _onChange,
  ...
  isDirty: _isDirty,
  ...
}: GroupInfoPanelProps) {
```

Three props (`info`, `onChange`, `isDirty`) are destructured with underscore prefixes because they're unused. With `noUnusedParameters: true` in `tsconfig.json`, the underscore is required. But the real fix is to **remove them from the interface** if they're not needed, or implement them.

---

## 12. No Error Boundaries ✅

> **Resolved** — Added `<ErrorBoundary>` component wrapping the app, and try/catch guards in `loadFromText` and the initial `parseXsd` call in `App.tsx`.

`parseXsd()` throws on invalid XML (`throw new Error('Not a valid XSD schema')`), but:

- `App.tsx` has no try/catch around the initial load.
- `Toolbar.tsx` `openFile` → `loadFromText` has no error handling for parse failures.
- There is no React error boundary component anywhere in the tree.

A malformed XSD file will crash the entire application.

**Suggested fix**:

1. Wrap `loadFromText` in a try/catch with user-facing error toast/alert.
2. Add a React `ErrorBoundary` component near the root.

---

## 13. No Tests ✅

> **Resolved** — Added 153 Vitest tests across `tests/types.test.ts`, `tests/parser.test.ts`, `tests/serializer.test.ts`, and `tests/editorStore.test.ts`, including round-trip parse→serialize→parse coverage.

There are zero test files in the project. The following are highly testable pure-logic modules:

- `model/parser.ts` — parse XSD → tree
- `model/serializer.ts` — tree → XSD
- `model/types.ts` — `buildNodeMap`, `createNewNode`, `getInsertableKinds`, `getSiblingInsertableKinds`
- `store/editorStore.ts` — all actions

Round-trip tests (`parse → serialize → parse` yielding an identical tree) would be especially valuable.

**Suggested fix**: Set up Vitest (already uses Vite) and add unit tests for the model and store layers.

---

## 14. Minor / Organizational Issues

### 14a. Toolbar Mixes I/O Logic and UI

**File**: `Toolbar.tsx`, lines 44–120.

~80 lines of file I/O logic (`openFileNative`, `openFileFallback`, `openFile`, `saveFile`, `saveFileAs`) live as module-level functions in a UI component file.

**Suggested fix**: Extract to `utils/fileOps.ts` or a `useFileOperations()` hook.

### 14b. `serializeElement` / `serializeAttribute` Share Annotation Pattern ✅

> **Resolved** — Extracted `emitFieldAnnotation(ind, fieldAttrs, lines)` helper used by both functions.

Both produce the same annotation block (annotation → appinfo → `b:fieldInfo`). Could be extracted:

```ts
function emitFieldAnnotation(ind: string, fieldAttrs: string, lines: string[]) {
  lines.push(`${ind}  <xs:annotation>`);
  lines.push(`${ind}    <xs:appinfo>`);
  lines.push(`${ind}      <b:fieldInfo ${fieldAttrs} />`);
  lines.push(`${ind}    </xs:appinfo>`);
  lines.push(`${ind}  </xs:annotation>`);
}
```

### 14c. `InfoPanels.tsx` Is 583 Lines ✅

> **Resolved** — Split into `SchemaInfoPanel.tsx`, `RecordInfoPanel.tsx`, `FieldInfoPanel.tsx`, `GroupInfoPanel.tsx`, and `enumMaps.ts`. `InfoPanels.tsx` is now a barrel re-export file.

This is the largest source file. It contains four distinct panel components plus all enum display maps.

**Suggested fix**: Split into:

- `SchemaInfoPanel.tsx`
- `RecordInfoPanel.tsx`
- `FieldInfoPanel.tsx`
- `GroupInfoPanel.tsx`
- `enumMaps.ts` (or co-locate each map with its panel)
