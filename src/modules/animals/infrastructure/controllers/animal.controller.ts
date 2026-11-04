import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { GenerateAnimalCertificateUseCase } from '../../application/use-cases/animals/generate-animal-certificate.use-case';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import type { UploadedFileData } from '@shared/infrastructure/storage/uploaded-file';
import { contentDisposition } from '@shared/infrastructure/storage/s3-file-storage.adapter';
import { CreateAnimalUseCase } from '../../application/use-cases/animals/create-animal.use-case';
import { UpdateAnimalUseCase } from '../../application/use-cases/animals/update-animal.use-case';
import { GetAnimalUseCase } from '../../application/use-cases/animals/get-animal.use-case';
import { ListAnimalsUseCase } from '../../application/use-cases/animals/list-animals.use-case';
import { ChangeAnimalStatusUseCase } from '../../application/use-cases/animals/change-animal-status.use-case';
import { DeleteAnimalUseCase } from '../../application/use-cases/animals/delete-animal.use-case';
import {
  CERTIFICATE_MAX_BYTES,
  UploadAnimalCertificateUseCase,
} from '../../application/use-cases/animals/upload-animal-certificate.use-case';
import { GetAnimalCertificateUseCase } from '../../application/use-cases/animals/get-animal-certificate.use-case';
import { DeleteAnimalCertificateUseCase } from '../../application/use-cases/animals/delete-animal-certificate.use-case';
import { CreateAnimalDto } from '../../application/dtos/create-animal.dto';
import { UpdateAnimalDto } from '../../application/dtos/update-animal.dto';
import { ListAnimalsQueryDto } from '../../application/dtos/list-animals-query.dto';
import { ChangeAnimalStatusDto } from '../../application/dtos/change-animal-status.dto';
import { AnimalPresenter } from '../presenters/animal.presenter';
import { AnimalPhotoUrlService } from '../../application/services/animal-photo-url.service';
import { HealthRecordService } from '../../application/use-cases/health/health-record.service';
import { ANIMAL_WEIGHING_REPOSITORY } from '../../domain/repositories/animal-weighing.repository.interface';
import type { IAnimalWeighingRepository } from '../../domain/repositories/animal-weighing.repository.interface';
import { Animal } from '../../domain/models/animal.model';

@ApiTags('Animales')
@ApiBearerAuth()
@Controller('animals')
export class AnimalController {
  constructor(
    private readonly createAnimalUseCase: CreateAnimalUseCase,
    private readonly updateAnimalUseCase: UpdateAnimalUseCase,
    private readonly getAnimalUseCase: GetAnimalUseCase,
    private readonly listAnimalsUseCase: ListAnimalsUseCase,
    private readonly changeAnimalStatusUseCase: ChangeAnimalStatusUseCase,
    private readonly deleteAnimalUseCase: DeleteAnimalUseCase,
    private readonly uploadCertificateUseCase: UploadAnimalCertificateUseCase,
    private readonly getCertificateUseCase: GetAnimalCertificateUseCase,
    private readonly deleteCertificateUseCase: DeleteAnimalCertificateUseCase,
    private readonly generateCertificateUseCase: GenerateAnimalCertificateUseCase,
    private readonly photoUrls: AnimalPhotoUrlService,
    private readonly health: HealthRecordService,
    @Inject(ANIMAL_WEIGHING_REPOSITORY)
    private readonly weighingRepository: IAnimalWeighingRepository,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ANIMALS_CREATE)
  @ApiOperation({
    summary: 'Registrar un animal de la cabaña o un animal externo',
  })
  @ApiResponse({ status: 201, description: 'Animal registrado.' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAnimalDto,
  ) {
    const animal = await this.createAnimalUseCase.execute(actor.id, dto);
    return this.present(animal);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ANIMALS_READ)
  @ApiOperation({
    summary: 'Listar animales (paginado, con búsqueda y filtros)',
  })
  async findAll(@Query() query: ListAnimalsQueryDto) {
    const result = await this.listAnimalsUseCase.execute(
      {
        search: query.search,
        isExternal: query.isExternal ?? false,
        species: query.species,
        sex: query.sex,
        status: query.status,
        geneticCategory: query.geneticCategory,
        breedId: query.breedId,
        colorId: query.colorId,
        parentId: query.parentId,
        identifierException: query.identifierException,
      },
      { page: query.page, limit: query.limit },
    );
    const primaryPhotos = await this.photoUrls.primaryPhotos(
      result.items.map((animal) => animal.getId()),
    );
    return {
      ...result,
      items: result.items.map((animal) =>
        AnimalPresenter.toSummary(
          animal,
          primaryPhotos.get(animal.getId()) ?? null,
        ),
      ),
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ANIMALS_READ)
  @ApiOperation({ summary: 'Obtener un animal' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const animal = await this.getAnimalUseCase.execute(id);
    return this.present(animal);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ANIMALS_UPDATE)
  @ApiOperation({ summary: 'Actualizar los datos de un animal' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnimalDto,
  ) {
    const animal = await this.updateAnimalUseCase.execute(actor.id, id, dto);
    return this.present(animal);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.ANIMALS_CHANGE_STATUS)
  @ApiOperation({
    summary:
      'Registrar la salida del animal (muerte, venta, faena, regalo, intercambio). La faena se bloquea en período de retiro.',
  })
  async changeStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeAnimalStatusDto,
  ) {
    const { animal, warnings } = await this.changeAnimalStatusUseCase.execute(
      actor,
      id,
      dto,
    );
    return { ...(await this.present(animal)), warnings };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ANIMALS_DELETE)
  @ApiOperation({
    summary: 'Eliminar un animal registrado por error (borrado lógico)',
  })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.deleteAnimalUseCase.execute(actor.id, id);
  }

  // ---------- Certificado ABSID escaneado ----------

  @Put(':id/certificate-file')
  @RequirePermissions(PERMISSIONS.ANIMALS_UPDATE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CERTIFICATE_MAX_BYTES, files: 1 },
      // Conserva tildes y ñ en el nombre del archivo.
      defParamCharset: 'utf8',
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Adjuntar o reemplazar el certificado ABSID escaneado (PDF, JPG, PNG o WEBP, máx. 10 MB)',
  })
  async uploadCertificate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFileData | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Adjunte el archivo en el campo "file"');
    }
    const animal = await this.uploadCertificateUseCase.execute(actor.id, id, {
      content: file.buffer,
      originalName: file.originalname,
    });
    return this.present(animal);
  }

  @Get(':id/certificate-file')
  @RequirePermissions(PERMISSIONS.ANIMALS_READ)
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  @ApiOperation({ summary: 'Descargar el certificado ABSID escaneado' })
  async downloadCertificate(@Param('id', ParseUUIDPipe) id: string) {
    const { file, content } = await this.getCertificateUseCase.execute(id);
    return new StreamableFile(content, {
      type: file.mimeType,
      length: content.length,
      disposition: contentDisposition(file.originalName, false),
    });
  }

  @Delete(':id/certificate-file')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ANIMALS_UPDATE)
  @ApiOperation({ summary: 'Quitar el certificado ABSID escaneado' })
  async removeCertificate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.deleteCertificateUseCase.execute(actor.id, id);
  }

  // ---------- Certificado del animal (generado) ----------

  @Get(':id/certificate')
  @RequirePermissions(PERMISSIONS.ANIMALS_ISSUE_CERTIFICATE)
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary:
      'Generar el certificado del animal en PDF (identificación, ABSID, origen, estado, genealogía, pesos y registro sanitario)',
  })
  async generateCertificate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('download', new ParseBoolPipe({ optional: true }))
    download: boolean | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const certificate = await this.generateCertificateUseCase.execute(
      actor.id,
      id,
    );
    res.setHeader('X-Certificate-Number', certificate.number);
    return new StreamableFile(certificate.content, {
      type: 'application/pdf',
      length: certificate.content.length,
      disposition: contentDisposition(certificate.fileName, download === true),
    });
  }

  /** Ficha completa, con la miniatura de su foto principal. */
  private async present(animal: Animal) {
    const [primaryPhotos, weights, withdrawal] = await Promise.all([
      this.photoUrls.primaryPhotos([animal.getId()]),
      this.weighingRepository.findSummary(animal.getId()),
      this.health.withdrawal(animal),
    ]);
    return AnimalPresenter.toResponse(animal, {
      primaryPhoto: primaryPhotos.get(animal.getId()) ?? null,
      weights,
      withdrawal,
    });
  }
}
