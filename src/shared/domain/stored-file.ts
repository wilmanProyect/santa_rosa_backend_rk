/** Metadatos de un archivo guardado en el almacenamiento de archivos. */
export interface StoredFile {
  /** Ruta interna en el almacenamiento. Nunca se expone al cliente. */
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}
