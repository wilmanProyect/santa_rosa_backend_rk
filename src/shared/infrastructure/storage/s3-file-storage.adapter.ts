import { Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import type {
  IFileStorage,
  StoredObjectInfo,
  StoredObjectStream,
  TemporaryUrlOptions,
} from '@shared/application/ports/file-storage.interface';

export interface S3StorageConfig {
  /** URL con la que la API llega al servidor (p. ej. http://garage:3900 en Docker). */
  endpoint: string;
  /**
   * URL con la que el navegador llega al servidor. Se usa solo para firmar las
   * URL temporales, porque la firma incluye el host.
   */
  publicEndpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  temporaryUrlTtlSeconds: number;
}

const BUCKET_CHECK_ATTEMPTS = 10;
const BUCKET_CHECK_DELAY_MS = 2_000;

/**
 * Almacenamiento en Garage (o cualquier servicio compatible con S3).
 * El bucket es privado: los archivos solo se leen con URL firmadas y temporales.
 */
export class S3FileStorageAdapter implements IFileStorage, OnModuleInit {
  private readonly logger = new Logger(S3FileStorageAdapter.name);
  private readonly client: S3Client;
  private readonly signer: S3Client;
  readonly temporaryUrlTtlSeconds: number;

  constructor(private readonly config: S3StorageConfig) {
    const base = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      // Rutas (http://host/bucket/clave), no subdominios por bucket.
      forcePathStyle: true,
    };
    this.client = new S3Client({ ...base, endpoint: config.endpoint });
    this.signer = new S3Client({ ...base, endpoint: config.publicEndpoint });
    this.temporaryUrlTtlSeconds = config.temporaryUrlTtlSeconds;
  }

  /** Crea el bucket si no existe. Reintenta mientras el almacenamiento termina de arrancar. */
  async onModuleInit(): Promise<void> {
    const { bucket } = this.config;
    for (let attempt = 1; ; attempt++) {
      try {
        await this.ensureBucket(bucket);
        return;
      } catch (error) {
        if (attempt >= BUCKET_CHECK_ATTEMPTS) {
          throw new Error(
            `No se pudo conectar con el almacenamiento de archivos (${this.config.endpoint}, bucket "${bucket}"): ${(error as Error).message}. Verifique que Garage esté levantado y las variables S3_* del archivo .env.`,
          );
        }
        this.logger.warn(
          `Almacenamiento no disponible (intento ${attempt}/${BUCKET_CHECK_ATTEMPTS}), reintentando...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, BUCKET_CHECK_DELAY_MS),
        );
      }
    }
  }

  async save(key: string, content: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
        ContentLength: content.length,
      }),
    );
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      if (!result.Body) return null;
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }

  /** La firma se calcula localmente: no hace ninguna petición al almacenamiento. */
  async getTemporaryUrl(
    key: string,
    options: TemporaryUrlOptions = {},
  ): Promise<string> {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ResponseContentDisposition: options.fileName
          ? contentDisposition(options.fileName, options.download ?? false)
          : undefined,
      }),
      { expiresIn: this.temporaryUrlTtlSeconds },
    );
  }

  async *listAll(): AsyncIterable<StoredObjectInfo> {
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          ContinuationToken: token,
        }),
      );
      for (const object of page.Contents ?? []) {
        if (object.Key) yield { key: object.Key, size: object.Size ?? 0 };
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }

  async openReadStream(key: string): Promise<StoredObjectStream | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      if (!result.Body) return null;
      return {
        stream: result.Body as Readable,
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  private async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
      if ((error as { name?: string }).name !== 'NotFound') throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      this.logger.log(`Bucket creado: ${bucket}`);
    }
  }
}

/** Nombre ASCII de respaldo + nombre UTF-8 (RFC 6266) para tildes y ñ. */
export function contentDisposition(fileName: string, download: boolean) {
  const type = download ? 'attachment' : 'inline';
  const asciiName = fileName
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '');
  return `${type}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
