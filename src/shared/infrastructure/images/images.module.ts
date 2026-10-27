import { Module } from '@nestjs/common';
import { IMAGE_PROCESSOR } from '@shared/application/ports/image-processor.interface';
import { SharpImageProcessorAdapter } from './sharp-image-processor.adapter';

@Module({
  providers: [
    { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessorAdapter },
  ],
  exports: [IMAGE_PROCESSOR],
})
export class ImagesModule {}
