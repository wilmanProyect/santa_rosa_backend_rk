import type { Readable } from 'stream';

/**
 * Almacenamiento de archivos binarios (fotos, certificados escaneados, etc.).
 * Las claves son rutas lógicas, p. ej. "animals/<id>/photos/<id>/original.jpg".
 */
export interface IFileStorage {
  save(key: string, content: Buffer, contentType: string): Promise<void>;
  /** Devuelve null si el archivo no existe. */
  read(key: string): Promise<Buffer | null>;
  /** No falla si el archivo ya no existe. */
  delete(key: string): Promise<void>;
  /**
   * URL temporal para que el navegador lea el archivo directamente del
   * almacenamiento, sin pasar por la API.
   */
  getTemporaryUrl(key: string, options?: TemporaryUrlOptions): Promise<string>;
  /** Segundos de validez de las URL temporales. */
  readonly temporaryUrlTtlSeconds: number;

  /** Recorre todos los archivos guardados (para copias de seguridad). */
  listAll(): AsyncIterable<StoredObjectInfo>;
  /** Lee un archivo como stream, sin cargarlo entero en memoria. Null si no existe. */
  openReadStream(key: string): Promise<StoredObjectStream | null>;
}

export interface StoredObjectInfo {
  key: string;
  size: number;
}

export interface StoredObjectStream {
  stream: Readable;
  size: number;
  contentType: string;
}

export interface TemporaryUrlOptions {
  /** Nombre con el que se mostrará o descargará el archivo. */
  fileName?: string;
  /** true: forzar la descarga. false (por defecto): mostrarlo en el navegador. */
  download?: boolean;
}

export const FILE_STORAGE = Symbol('IFileStorage');
