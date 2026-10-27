export interface ImageInfo {
  mimeType: string;
  extension: string;
  /** Dimensiones ya corregidas según la orientación EXIF (como se ve la foto). */
  width: number;
  height: number;
  /** Fecha de captura según el EXIF de la cámara (YYYY-MM-DD), si la tiene. */
  takenAt: string | null;
}

export interface Thumbnail {
  content: Buffer;
  mimeType: string;
  extension: string;
}

/** Análisis y transformación de imágenes. */
export interface IImageProcessor {
  /**
   * Lee el contenido real del archivo. Devuelve null si no es una imagen en
   * un formato admitido (JPEG, PNG o WEBP).
   */
  analyze(content: Buffer): Promise<ImageInfo | null>;
  /** Versión reducida para galerías y listados, orientada correctamente. */
  createThumbnail(content: Buffer): Promise<Thumbnail>;
}

export const IMAGE_PROCESSOR = Symbol('IImageProcessor');
