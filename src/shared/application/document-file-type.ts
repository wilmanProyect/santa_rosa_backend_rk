export interface DocumentFileType {
  mimeType: string;
  extension: string;
}

/**
 * Detecta el tipo real de un documento por su firma binaria, sin confiar en el
 * nombre ni en el Content-Type que envía el cliente.
 * Solo se admiten PDF e imágenes (JPEG, PNG, WEBP).
 */
export function detectDocumentFileType(
  content: Buffer,
): DocumentFileType | null {
  const startsWith = (bytes: number[], offset = 0) =>
    content.length >= offset + bytes.length &&
    bytes.every((byte, i) => content[offset + i] === byte);

  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }
  if (startsWith([0xff, 0xd8, 0xff])) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (
    startsWith([0x52, 0x49, 0x46, 0x46]) &&
    startsWith([0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return null;
}

/** Nombre de archivo seguro para guardar y mostrar: sin rutas ni caracteres de control. */
export function sanitizeFileName(name: string, fallback: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  return clean === '' ? fallback : clean.slice(0, 255);
}
