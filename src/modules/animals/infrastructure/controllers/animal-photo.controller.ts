import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import type { UploadedFileData } from '@shared/infrastructure/storage/uploaded-file';
import { AnimalPhoto } from '../../domain/models/animal-photo.model';
import {
  PHOTO_MAX_BYTES,
  UploadAnimalPhotoUseCase,
} from '../../application/use-cases/photos/upload-animal-photo.use-case';
import { ListAnimalPhotosUseCase } from '../../application/use-cases/photos/list-animal-photos.use-case';
import { GetAnimalPhotoUseCase } from '../../application/use-cases/photos/get-animal-photo.use-case';
import { UpdateAnimalPhotoUseCase } from '../../application/use-cases/photos/update-animal-photo.use-case';
import { SetPrimaryAnimalPhotoUseCase } from '../../application/use-cases/photos/set-primary-animal-photo.use-case';
import { DeleteAnimalPhotoUseCase } from '../../application/use-cases/photos/delete-animal-photo.use-case';
import { AnimalPhotoUrlService } from '../../application/services/animal-photo-url.service';
import { UploadAnimalPhotoDto } from '../../application/dtos/upload-animal-photo.dto';
import { UpdateAnimalPhotoDto } from '../../application/dtos/update-animal-photo.dto';
import { ListAnimalPhotosQueryDto } from '../../application/dtos/list-animal-photos-query.dto';
import { AnimalPhotoPresenter } from '../presenters/animal-photo.presenter';

@ApiTags('Fotos de animales')
@ApiBearerAuth()
@Controller('animals/:animalId/photos')
export class AnimalPhotoController {
  constructor(
    private readonly uploadPhotoUseCase: UploadAnimalPhotoUseCase,
    private readonly listPhotosUseCase: ListAnimalPhotosUseCase,
    private readonly getPhotoUseCase: GetAnimalPhotoUseCase,
    private readonly updatePhotoUseCase: UpdateAnimalPhotoUseCase,
    private readonly setPrimaryPhotoUseCase: SetPrimaryAnimalPhotoUseCase,
    private readonly deletePhotoUseCase: DeleteAnimalPhotoUseCase,
    private readonly photoUrls: AnimalPhotoUrlService,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ANIMAL_PHOTOS_UPLOAD)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PHOTO_MAX_BYTES, files: 1 },
      // Conserva tildes y ñ en el nombre del archivo.
      defParamCharset: 'utf8',
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        description: { type: 'string', maxLength: 500 },
        takenAt: { type: 'string', format: 'date', example: '2026-10-20' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Subir una foto al historial del animal (JPG, PNG o WEBP, máx. 15 MB)',
  })
  @ApiResponse({ status: 201, description: 'Foto agregada al historial.' })
  async upload(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @UploadedFile() file: UploadedFileData | undefined,
    @Body() dto: UploadAnimalPhotoDto,
  ) {
    if (!file) {
      throw new BadRequestException('Adjunte la foto en el campo "file"');
    }
    const photo = await this.uploadPhotoUseCase.execute(
      actor,
      animalId,
      { content: file.buffer, originalName: file.originalname },
      dto,
    );
    return this.present(photo);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ANIMALS_READ)
  @ApiOperation({
    summary:
      'Historial de fotos del animal, de la más reciente a la más antigua',
  })
  async findAll(
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @Query() query: ListAnimalPhotosQueryDto,
  ) {
    const result = await this.listPhotosUseCase.execute(animalId, {
      page: query.page,
      limit: query.limit,
    });
    return {
      ...result,
      items: await Promise.all(result.items.map((p) => this.present(p))),
    };
  }

  @Get(':photoId')
  @RequirePermissions(PERMISSIONS.ANIMALS_READ)
  @ApiOperation({ summary: 'Obtener una foto (con URL temporales nuevas)' })
  async findOne(
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    const photo = await this.getPhotoUseCase.execute(animalId, photoId);
    return this.present(photo);
  }

  @Patch(':photoId')
  @RequirePermissions(PERMISSIONS.ANIMAL_PHOTOS_UPLOAD)
  @ApiOperation({ summary: 'Corregir la descripción o la fecha de una foto' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Body() dto: UpdateAnimalPhotoDto,
  ) {
    const photo = await this.updatePhotoUseCase.execute(
      actor.id,
      animalId,
      photoId,
      dto,
    );
    return this.present(photo);
  }

  @Put(':photoId/primary')
  @RequirePermissions(PERMISSIONS.ANIMAL_PHOTOS_UPLOAD)
  @ApiOperation({ summary: 'Marcar como foto principal del animal' })
  async setPrimary(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    const photo = await this.setPrimaryPhotoUseCase.execute(
      actor.id,
      animalId,
      photoId,
    );
    return this.present(photo);
  }

  @Delete(':photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ANIMAL_PHOTOS_DELETE)
  @ApiOperation({
    summary:
      'Eliminar una foto del historial (borrado lógico; si era la principal, la más reciente pasa a serlo)',
  })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    await this.deletePhotoUseCase.execute(actor.id, animalId, photoId);
  }

  private async present(photo: AnimalPhoto) {
    return AnimalPhotoPresenter.toResponse(
      photo,
      await this.photoUrls.forPhoto(photo),
    );
  }
}
