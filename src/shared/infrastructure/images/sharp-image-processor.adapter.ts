import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import exifReader from 'exif-reader';
import type {
  IImageProcessor,
  ImageInfo,
  Thumbnail,
} from '@shared/application/ports/image-processor.interface';

const SUPPORTED_FORMATS: Record<
  string,
  { mimeType: string; extension: string }
> = {
  jpeg: { mimeType: 'image/jpeg', extension: 'jpg' },
  png: { mimeType: 'image/png', extension: 'png' },
  webp: { mimeType: 'image/webp', extension: 'webp' },
};

/** Lado mayor de la miniatura, en píxeles. */
export const THUMBNAIL_MAX_SIDE = 480;

/** Límite de píxeles de entrada (≈ 100 MP): evita "bombas" de descompresión. */
const MAX_INPUT_PIXELS = 100_000_000;

@Injectable()
export class SharpImageProcessorAdapter implements IImageProcessor {
  async analyze(content: Buffer): Promise<ImageInfo | null> {
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(content, {
        limitInputPixels: MAX_INPUT_PIXELS,
      }).metadata();
    } catch {
      return null;
    }

    const format = metadata.format && SUPPORTED_FORMATS[metadata.format];
    if (!format || !metadata.width || !metadata.height) return null;

    return {
      ...format,
      width: metadata.autoOrient?.width ?? metadata.width,
      height: metadata.autoOrient?.height ?? metadata.height,
      takenAt: readCaptureDate(metadata.exif),
    };
  }

  async createThumbnail(content: Buffer): Promise<Thumbnail> {
    const thumbnail = await sharp(content, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate() // aplica la orientación EXIF
      .resize(THUMBNAIL_MAX_SIDE, THUMBNAIL_MAX_SIDE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    // sharp no copia los metadatos (EXIF, GPS) a la salida salvo que se pida.
    return { content: thumbnail, mimeType: 'image/webp', extension: 'webp' };
  }

  async toJpeg(content: Buffer, maxSide: number): Promise<Buffer> {
    return sharp(content, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }) // PNG con transparencia → fondo blanco
      .jpeg({ quality: 85 })
      .toBuffer();
  }
}

/**
 * La cámara guarda la fecha y hora local sin zona horaria; exif-reader la
 * interpreta como UTC, así que la parte de fecha es la fecha local de captura.
 */
function readCaptureDate(exif: Buffer | undefined): string | null {
  if (!exif) return null;
  try {
    const tags = exifReader(exif);
    const date = tags.Photo?.DateTimeOriginal ?? tags.Image?.DateTime;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  } catch {
    return null; // EXIF dañado: se ignora, no impide subir la foto
  }
}
