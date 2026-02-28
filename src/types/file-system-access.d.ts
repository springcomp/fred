/** File System Access API type declarations for browsers that support it. */

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

export {};
