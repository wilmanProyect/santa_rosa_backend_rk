import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FILE_STORAGE } from '@shared/application/ports/file-storage.interface';
import { S3FileStorageAdapter } from './s3-file-storage.adapter';

function required(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value) {
    throw new Error(`${key} no está definido. Configúrelo en el archivo .env`);
  }
  return value;
}

@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const endpoint = required(config, 'S3_ENDPOINT');
        return new S3FileStorageAdapter({
          endpoint,
          publicEndpoint: config.get<string>('S3_PUBLIC_ENDPOINT') || endpoint,
          region: config.get<string>('S3_REGION', 'garage'),
          accessKey: required(config, 'S3_ACCESS_KEY'),
          secretKey: required(config, 'S3_SECRET_KEY'),
          bucket: config.get<string>('S3_BUCKET', 'santa-rosa'),
          temporaryUrlTtlSeconds: Number(
            config.get('S3_PRESIGNED_URL_TTL_SECONDS', 900),
          ),
        });
      },
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
