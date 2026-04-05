// Ambient type declarations for WebKit FileSystem API
// These extend existing browser interfaces

export interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

export interface FileSystemFileEntry extends FileSystemEntry {
  file: (successCallback: (file: File) => void, errorCallback?: (err: DOMException) => void) => void;
}

export interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader: () => FileSystemDirectoryReader;
}

export interface FileSystemDirectoryReader {
  readEntries: (
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (err: DOMException) => void
  ) => void;
}

// Augment the global DataTransferItem interface
declare global {
  interface DataTransferItem {
    webkitGetAsEntry?: () => FileSystemEntry | null;
  }
}
