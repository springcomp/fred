import {
  ArrowDown,
  ArrowUp,
  AtSign,
  ChevronDown,
  Diamond,
  FilePlus,
  FolderOpen,
  GitBranch,
  ListOrdered,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { nodeKindLabel } from '@/components/tree/NodeIcon';
import { parseXsd } from '@/model/parser';
import { downloadAsFile, serializeXsd } from '@/model/serializer';
import { type FFNode, getInsertableKinds, type InsertableKind } from '@/model/types';
import { useEditorStore } from '@/store/editorStore';

declare global {
  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
  interface OpenFilePickerOptions {
    types?: FilePickerAcceptType[];
    multiple?: boolean;
  }
  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
  }
  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }
}

const supportsFilePicker = typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';

/** Read an XSD file from text and load it into the store. */
function loadFromText(text: string, handle?: FileSystemFileHandle) {
  const schema = parseXsd(text);
  useEditorStore.getState().loadSchema(schema, handle);
}

/** Open via modern File System Access API (Chromium). */
async function openFileNative() {
  const [handle] = await window.showOpenFilePicker?.({
    types: [{ description: 'XSD Schema files', accept: { 'application/xml': ['.xsd', '.xml'] } }],
  });
  const file = await handle.getFile();
  const text = await file.text();
  loadFromText(text, handle);
}

/** Open via classic <input type="file"> fallback. */
function openFileFallback(input: HTMLInputElement) {
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  file.text().then(text => loadFromText(text));
  input.value = ''; // reset so same file can be re-selected
}

async function openFile(inputRef: React.RefObject<HTMLInputElement | null>) {
  try {
    if (supportsFilePicker) {
      await openFileNative();
    } else {
      inputRef.current?.click();
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      console.error('Failed to open file:', e);
    }
  }
}

async function saveFile() {
  const { schema, fileHandle } = useEditorStore.getState();
  if (!schema) {
    return;
  }

  const xsd = serializeXsd(schema);

  if (supportsFilePicker && fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(xsd);
      await writable.close();
      useEditorStore.getState().markClean();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error('Failed to save file:', e);
      }
    }
  } else {
    // Fallback: trigger download
    downloadAsFile(xsd, 'schema.xsd');
    useEditorStore.getState().markClean();
  }
}

async function saveFileAs() {
  const { schema } = useEditorStore.getState();
  if (!schema) {
    return;
  }

  const xsd = serializeXsd(schema);

  try {
    if (supportsFilePicker) {
      const handle = await window.showSaveFilePicker?.({
        suggestedName: 'schema.xsd',
        types: [{ description: 'XSD Schema files', accept: { 'application/xml': ['.xsd'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(xsd);
      await writable.close();
      useEditorStore.getState().setFileHandle(handle);
      useEditorStore.getState().markClean();
    } else {
      // Fallback: trigger download
      downloadAsFile(xsd, 'schema.xsd');
      useEditorStore.getState().markClean();
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      console.error('Failed to save file:', e);
    }
  }
}

export function Toolbar() {
  const dirty = useEditorStore(s => s.dirty);
  const hasSchema = useEditorStore(s => s.schema !== null);
  const selectedNodeId = useEditorStore(s => s.selectedNodeId);
  const nodeMap = useEditorStore(s => s.nodeMap);
  const schema = useEditorStore(s => s.schema);
  const deleteNode = useEditorStore(s => s.deleteNode);
  const moveNodeUp = useEditorStore(s => s.moveNodeUp);
  const moveNodeDown = useEditorStore(s => s.moveNodeDown);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNode = selectedNodeId ? (nodeMap.get(selectedNodeId) ?? null) : null;
  const isRoot = selectedNode?.id === schema?.id;
  const canDelete = selectedNode != null && !isRoot;
  const canMove = selectedNode != null && !isRoot;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/50">
      <span className="font-semibold text-sm mr-3">FRED</span>

      {/* Hidden file input for browsers without File System Access API */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xsd,.xml"
        className="hidden"
        onChange={e => openFileFallback(e.target as HTMLInputElement)}
      />

      <ToolbarButton icon={<FolderOpen size={16} />} label="Open" onClick={() => openFile(fileInputRef)} />
      <ToolbarButton icon={<Save size={16} />} label="Save" onClick={saveFile} disabled={!hasSchema} />
      <ToolbarButton icon={<FilePlus size={16} />} label="Save As" onClick={saveFileAs} disabled={!hasSchema} />

      <ToolbarSeparator />

      {/* Insert dropdown */}
      <InsertDropdown node={selectedNode} />

      <ToolbarButton
        icon={<Trash2 size={16} />}
        label="Delete"
        onClick={() => selectedNodeId && deleteNode(selectedNodeId)}
        disabled={!canDelete}
      />

      <ToolbarSeparator />

      <ToolbarButton
        icon={<ArrowUp size={16} />}
        label="Move Up"
        onClick={() => selectedNodeId && moveNodeUp(selectedNodeId)}
        disabled={!canMove}
      />
      <ToolbarButton
        icon={<ArrowDown size={16} />}
        label="Move Down"
        onClick={() => selectedNodeId && moveNodeDown(selectedNodeId)}
        disabled={!canMove}
      />

      {dirty && <span className="ml-2 text-xs text-muted-foreground italic">• unsaved changes</span>}

      <div className="flex-1" />
      <span className="text-xs text-muted-foreground">Flat File Editor</span>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="w-px h-5 mx-1 bg-border" />;
}

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

/** Dropdown button for inserting child nodes. */
function InsertDropdown({ node }: { node: FFNode | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const addChildNode = useEditorStore(s => s.addChildNode);

  const validChildren = node ? getInsertableKinds(node) : [];
  const disabled = validChildren.length === 0;

  // Close on outside click
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex items-center gap-1 px-2 py-1 rounded-md text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        title="Insert child node"
      >
        <Plus size={16} />
        <span>Insert</span>
        <ChevronDown size={12} />
      </button>

      {open && node && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[150px] py-1 bg-background border border-border rounded-md shadow-lg text-sm">
          {validChildren.map(kind => (
            <div
              key={kind}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent"
              onClick={() => {
                addChildNode(node.id, kind);
                setOpen(false);
              }}
            >
              {insertKindIcon[kind]}
              <span>{insertKindLabel(kind)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
