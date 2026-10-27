/** Archivo recibido por multer (almacenamiento en memoria). */
export interface UploadedFileData {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
