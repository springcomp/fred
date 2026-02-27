import { useRef } from "react";
import { useEditorStore } from "@/store/editorStore";
import { parseXsd } from "@/model/parser";
import { serializeXsd, downloadAsFile } from "@/model/serializer";
import { FolderOpen, Save, FilePlus } from "lucide-react";

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

const supportsFilePicker = typeof window !== "undefined" && typeof window.showOpenFilePicker === "function";

/** Read an XSD file from text and load it into the store. */
function loadFromText(text: string, handle?: FileSystemFileHandle) {
  const schema = parseXsd(text);
  useEditorStore.getState().loadSchema(schema, handle);
}

/** Open via modern File System Access API (Chromium). */
async function openFileNative() {
  const [handle] = await window.showOpenFilePicker!({
    types: [{ description: "XSD Schema files", accept: { "application/xml": [".xsd", ".xml"] } }],
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
  file.text().then((text) => loadFromText(text));
  input.value = ""; // reset so same file can be re-selected
}

async function openFile(inputRef: React.RefObject<HTMLInputElement | null>) {
  try {
    if (supportsFilePicker) {
      await openFileNative();
    } else {
      inputRef.current?.click();
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      console.error("Failed to open file:", e);
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
      if ((e as Error).name !== "AbortError") {
        console.error("Failed to save file:", e);
      }
    }
  } else {
    // Fallback: trigger download
    downloadAsFile(xsd, "schema.xsd");
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
      const handle = await window.showSaveFilePicker!({
        suggestedName: "schema.xsd",
        types: [{ description: "XSD Schema files", accept: { "application/xml": [".xsd"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(xsd);
      await writable.close();
      useEditorStore.getState().setFileHandle(handle);
      useEditorStore.getState().markClean();
    } else {
      // Fallback: trigger download
      downloadAsFile(xsd, "schema.xsd");
      useEditorStore.getState().markClean();
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      console.error("Failed to save file:", e);
    }
  }
}

export function Toolbar() {
  const dirty = useEditorStore((s) => s.dirty);
  const hasSchema = useEditorStore((s) => s.schema !== null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/50">
      <span className="font-semibold text-sm mr-3">FRED</span>

      {/* Hidden file input for browsers without File System Access API */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xsd,.xml"
        className="hidden"
        onChange={(e) => openFileFallback(e.target as HTMLInputElement)}
      />

      <ToolbarButton icon={<FolderOpen size={16} />} label="Open" onClick={() => openFile(fileInputRef)} />
      <ToolbarButton icon={<Save size={16} />} label="Save" onClick={saveFile} disabled={!hasSchema} />
      <ToolbarButton icon={<FilePlus size={16} />} label="Save As" onClick={saveFileAs} disabled={!hasSchema} />

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
