# FRED — Flat File Editor (Source Architecture)

## Overview

FRED is a browser-based visual editor for **BizTalk Flat File XSD schemas**. It allows users to open, inspect, modify, and save `.xsd` files that describe delimited or positional flat-file formats using Microsoft BizTalk Server's annotation conventions (`b:schemaInfo`, `b:recordInfo`, `b:fieldInfo`, `b:groupInfo`).

The application is built with:

| Concern | Technology |
|---------|-----------|
| UI framework | React 19 |
| Build tool | Vite 7 |
| Styling | Tailwind CSS 4 |
| State management | Zustand 5 |
| Tree widget | react-arborist 3 |
| Icons | lucide-react |
| Package manager | PNPM 10 |
| Linter / formatter | Biome 2 |
| Language | TypeScript 5 (strict mode) |

Path aliases: `@/*` resolves to `./src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

---

## Directory Structure

```
src/
├── main.tsx                  # React entry point (renders <App />)
├── App.tsx                   # Root component: loads default schema, wires layout
├── index.css                 # Tailwind v4 theme (CSS custom properties)
├── vite-env.d.ts             # Vite client type reference
│
├── model/                    # Pure data layer (no React)
│   ├── types.ts              # Enums, interfaces, discriminated union (FFNode), defaults, helpers
│   ├── parser.ts             # XSD text → FFSchemaNode tree (DOMParser-based)
│   ├── serializer.ts         # FFSchemaNode tree → XSD text
│   └── samples.ts            # Embedded default XSD loaded on first launch
│
├── store/
│   └── editorStore.ts        # Zustand store: schema tree, selection, dirty tracking, CRUD actions
│
└── components/
    ├── SplitPane.tsx          # Resizable two-panel layout (tree | property sheet)
    ├── Toolbar.tsx            # Top toolbar: file ops (open/save), insert, delete, move
    │
    ├── tree/
    │   ├── SchemaTree.tsx     # Tree view using react-arborist, inline rename, context menu host
    │   ├── NodeIcon.tsx       # Icon + color per node kind
    │   └── ContextMenu.tsx    # Right-click menu (insert child/sibling, move, delete)
    │
    ├── properties/
    │   ├── PropertySheet.tsx  # Sidebar: renders the appropriate info panel for the selected node
    │   ├── InfoPanels.tsx     # SchemaInfoPanel, RecordInfoPanel, FieldInfoPanel, GroupInfoPanel
    │   └── PropertyFields.tsx # Reusable field components (BoolField, TextField, NumberField, etc.)
    │
    └── ui/                    # Primitive UI components (no business logic)
        ├── Badge.tsx
        ├── Input.tsx
        ├── Label.tsx
        ├── Select.tsx
        └── Switch.tsx
```

---

## Architecture & Data Flow

### 1. Data Model (`model/types.ts`)

The schema tree is represented as a **discriminated union** (`FFNode`) tagged by a `kind` field:

| Kind | Interface | Annotation | Description |
|------|-----------|------------|-------------|
| `schema` | `FFSchemaNode` | `SchemaInfo` | Root node; global defaults (delimiters, pad chars, etc.) |
| `record` | `FFRecordNode` | `RecordInfo` | Complex-type element (delimited or positional structure) |
| `element` | `FFElementNode` | `FieldInfo` | Simple-type element (a data field) |
| `attribute` | `FFAttributeNode` | `FieldInfo` | XSD attribute on a record |
| `sequence` | `FFSequenceNode` | `GroupInfo` | `xs:sequence` particle |
| `choice` | `FFChoiceNode` | `GroupInfo` | `xs:choice` particle |

Every node has a unique `id` (string like `"n1"`, `"n2"`) and a `children: FFNode[]` array, forming a general tree.

Helper functions:

- `createDefault*Info()` — factory functions for each annotation type
- `buildNodeMap(root)` — flattens the tree into a `Map<string, FFNode>` for O(1) lookups
- `createNewNode(kind, nodeMap)` — generates a new node with defaults and a unique name
- `getInsertableKinds(node)` / `getSiblingInsertableKinds(parent, child)` — business rules for valid child/sibling types

### 2. XSD Parser (`model/parser.ts`)

Converts raw XSD text into an `FFSchemaNode` tree:

1. Uses `DOMParser` to parse XML.
2. Walks `xs:element`, `xs:complexType`, `xs:sequence`, `xs:choice`, `xs:attribute`.
3. Reads BizTalk annotations from `xs:appinfo` elements under the `http://schemas.microsoft.com/BizTalk/2003` namespace.
4. Applies **default inheritance** — records inherit schema-level delimiter defaults; fields inherit pad/wrap defaults.

### 3. XSD Serializer (`model/serializer.ts`)

Converts an `FFSchemaNode` tree back to well-formed XSD text:

1. Auto-assigns depth-first `sequenceNumber` values to all nodes.
2. Walks the tree, emitting `xs:element`, `xs:complexType`, annotation blocks, etc.
3. Only serializes non-default annotation attributes (compares against `createDefault*Info()`).

### 4. Zustand Store (`store/editorStore.ts`)

Central state container. Key concepts:

| State | Purpose |
|-------|---------|
| `schema` | The live `FFSchemaNode` tree (single source of truth) |
| `nodeMap` | Flat `Map<string, FFNode>` rebuilt on every tree mutation |
| `selectedNodeId` | Currently selected node for the property sheet |
| `dirty` / `dirtyPaths` / `dirtyNodeIds` | Fine-grained dirty tracking per property |
| `originalValues` | Snapshot at load/save for revert detection |
| `fileHandle` | File System Access API handle for `Save` (Chromium only) |

**Mutation pattern**: every tree mutation (property edit, insert, delete, move) performs a `structuredClone(schema)`, modifies the clone, rebuilds the node map, and calls `set(...)`.

Actions: `loadSchema`, `selectNode`, `updateNodeProperty`, `updateNodeDirect`, `addChildNode`, `addSiblingAfter`, `deleteNode`, `moveNodeUp`, `moveNodeDown`.

### 5. Component Architecture

```
App
├── Toolbar               # File I/O, Insert dropdown, Delete, Move Up/Down
└── SplitPane
    ├── SchemaTree         # react-arborist tree with inline rename
    │   ├── Node           # Individual tree row (icon, label, badge, edit mode)
    │   └── ContextMenu    # Right-click menu with insert/move/delete submenus
    └── PropertySheet      # Reads selected node, renders matching InfoPanel
        ├── SchemaInfoPanel
        ├── RecordInfoPanel
        ├── FieldInfoPanel
        └── GroupInfoPanel
```

- **Selection**: clicking a tree node calls `selectNode(id)` in the store. `PropertySheet` reacts via `useSelectedNode()`.
- **Editing**: property panels call `updateNodeProperty(nodeId, infoKey, property, value)` which deep-clones the tree.
- **Dirty tracking**: labels turn bold when modified; the toolbar shows "unsaved changes".
- **Inline rename**: double-clicking a named node opens an `<input>` overlay; pressing Enter commits.
- **Context menu**: dispatched via `window.CustomEvent` from `Node` to `SchemaTree` where `ContextMenu` is rendered.

### 6. Styling

Tailwind CSS v4 with a custom `@theme` block in `index.css` defining:

- Standard design tokens (`--color-background`, `--color-border`, etc.)
- Node-kind colors (`--color-node-record`, `--color-node-element`, etc.)
- Border radii tokens

No external component library — all UI primitives (`Input`, `Select`, `Switch`, `Badge`, `Label`) are hand-rolled in `components/ui/`.

---

## Key Workflows

### Opening a File

1. `Toolbar` → `openFile()` → File System Access API or `<input type="file">` fallback.
2. Raw text → `parseXsd(text)` → `FFSchemaNode`.
3. `useEditorStore.getState().loadSchema(schema, fileHandle)`.

### Saving a File

1. `Toolbar` → `saveFile()` or `saveFileAs()`.
2. `serializeXsd(schema)` → XSD string.
3. Write via `FileSystemFileHandle.createWritable()` or trigger browser download via `downloadAsFile()`.

### Editing a Property

1. User changes a value in `PropertySheet`.
2. Panel calls `onChange(property, value)` → `updateNodeProperty(nodeId, infoKey, property, value)`.
3. Store deep-clones the tree, applies the change, recomputes dirty state.
4. React re-renders the tree (bold label for dirty nodes) and property sheet.

### Inserting / Deleting Nodes

1. Via Toolbar's "Insert" dropdown or the context menu.
2. `addChildNode(parentId, kind)` or `addSiblingAfter(siblingId, kind)`.
3. A new node with defaults is created and spliced into the cloned tree.
4. Named nodes (`record`, `element`, `attribute`) auto-enter inline-rename mode.

---

## Conventions

- **Discriminated unions** over class hierarchies — `node.kind` is the tag.
- **Zustand selectors** — components subscribe to minimal slices (e.g. `s => s.dirty`).
- **No prop drilling for store state** — components import `useEditorStore` directly.
- **Path alias** — `@/model/types` instead of relative `../../model/types`.
- **Biome** for linting and formatting (see `biome.json`).
