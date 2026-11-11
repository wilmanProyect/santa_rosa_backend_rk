import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '@shared/infrastructure/storage/storage.module';
import { ImagesModule } from '@shared/infrastructure/images/images.module';
import { VeterinaryModule } from '@modules/veterinary/veterinary.module';
import { UsersModule } from '@modules/users/users.module';
import { GenerateAnimalCertificateUseCase } from './application/use-cases/animals/generate-animal-certificate.use-case';
import { ANIMAL_CERTIFICATE_RENDERER } from './application/ports/animal-certificate-renderer.interface';
import { PdfkitAnimalCertificateRenderer } from './infrastructure/certificates/pdfkit-animal-certificate.renderer';
import { AnimalWeighingOrmEntity } from './infrastructure/persistence/entities/animal-weighing.orm-entity';
import { HealthRecordOrmEntity } from './infrastructure/persistence/entities/health-record.orm-entity';
import { ANIMAL_WEIGHING_REPOSITORY } from './domain/repositories/animal-weighing.repository.interface';
import { HEALTH_RECORD_REPOSITORY } from './domain/repositories/health-record.repository.interface';
import { AnimalWeighingTypeormRepository } from './infrastructure/persistence/repositories/animal-weighing.typeorm.repository';
import { HealthRecordTypeormRepository } from './infrastructure/persistence/repositories/health-record.typeorm.repository';
import { WeighingService } from './application/use-cases/weighings/weighing.use-cases';
import { HealthRecordService } from './application/use-cases/health/health-record.service';
import { WeighingController } from './infrastructure/controllers/weighing.controller';
import { HealthRecordController } from './infrastructure/controllers/health-record.controller';
import { GeneticCategoryChangeOrmEntity } from './infrastructure/persistence/entities/genetic-category-change.orm-entity';
import { GeneticCategoryService } from './application/use-cases/animals/genetic-category.service';
import { GeneticCategoryController } from './infrastructure/controllers/genetic-category.controller';
import { BreedOrmEntity } from './infrastructure/persistence/entities/breed.orm-entity';
import { AnimalColorOrmEntity } from './infrastructure/persistence/entities/animal-color.orm-entity';
import { AnimalOrmEntity } from './infrastructure/persistence/entities/animal.orm-entity';
import { AnimalPhotoOrmEntity } from './infrastructure/persistence/entities/animal-photo.orm-entity';
import { ANIMAL_PHOTO_REPOSITORY } from './domain/repositories/animal-photo.repository.interface';
import { AnimalPhotoTypeormRepository } from './infrastructure/persistence/repositories/animal-photo.typeorm.repository';
import { AnimalPhotoUrlService } from './application/services/animal-photo-url.service';
import { UploadAnimalPhotoUseCase } from './application/use-cases/photos/upload-animal-photo.use-case';
import { ListAnimalPhotosUseCase } from './application/use-cases/photos/list-animal-photos.use-case';
import { GetAnimalPhotoUseCase } from './application/use-cases/photos/get-animal-photo.use-case';
import { UpdateAnimalPhotoUseCase } from './application/use-cases/photos/update-animal-photo.use-case';
import { SetPrimaryAnimalPhotoUseCase } from './application/use-cases/photos/set-primary-animal-photo.use-case';
import { DeleteAnimalPhotoUseCase } from './application/use-cases/photos/delete-animal-photo.use-case';
import { AnimalPhotoController } from './infrastructure/controllers/animal-photo.controller';
import { BREED_REPOSITORY } from './domain/repositories/breed.repository.interface';
import { ANIMAL_COLOR_REPOSITORY } from './domain/repositories/animal-color.repository.interface';
import { ANIMAL_REPOSITORY } from './domain/repositories/animal.repository.interface';
import { BreedTypeormRepository } from './infrastructure/persistence/repositories/breed.typeorm.repository';
import { AnimalColorTypeormRepository } from './infrastructure/persistence/repositories/animal-color.typeorm.repository';
import { AnimalTypeormRepository } from './infrastructure/persistence/repositories/animal.typeorm.repository';
import { CreateBreedUseCase } from './application/use-cases/breeds/create-breed.use-case';
import { UpdateBreedUseCase } from './application/use-cases/breeds/update-breed.use-case';
import { GetBreedUseCase } from './application/use-cases/breeds/get-breed.use-case';
import { ListBreedsUseCase } from './application/use-cases/breeds/list-breeds.use-case';
import { DeleteBreedUseCase } from './application/use-cases/breeds/delete-breed.use-case';
import { CreateAnimalColorUseCase } from './application/use-cases/colors/create-animal-color.use-case';
import { UpdateAnimalColorUseCase } from './application/use-cases/colors/update-animal-color.use-case';
import { GetAnimalColorUseCase } from './application/use-cases/colors/get-animal-color.use-case';
import { ListAnimalColorsUseCase } from './application/use-cases/colors/list-animal-colors.use-case';
import { DeleteAnimalColorUseCase } from './application/use-cases/colors/delete-animal-color.use-case';
import { AnimalGenealogyService } from './application/services/animal-genealogy.service';
import { AnimalIdentifierService } from './application/services/animal-identifier.service';
import { CreateAnimalUseCase } from './application/use-cases/animals/create-animal.use-case';
import { UpdateAnimalUseCase } from './application/use-cases/animals/update-animal.use-case';
import { GetAnimalUseCase } from './application/use-cases/animals/get-animal.use-case';
import { ListAnimalsUseCase } from './application/use-cases/animals/list-animals.use-case';
import { ChangeAnimalStatusUseCase } from './application/use-cases/animals/change-animal-status.use-case';
import { DeleteAnimalUseCase } from './application/use-cases/animals/delete-animal.use-case';
import { UploadAnimalCertificateUseCase } from './application/use-cases/animals/upload-animal-certificate.use-case';
import { GetAnimalCertificateUseCase } from './application/use-cases/animals/get-animal-certificate.use-case';
import { DeleteAnimalCertificateUseCase } from './application/use-cases/animals/delete-animal-certificate.use-case';
import { BreedController } from './infrastructure/controllers/breed.controller';
import { AnimalColorController } from './infrastructure/controllers/animal-color.controller';
import { AnimalController } from './infrastructure/controllers/animal.controller';

/**
 * Inventario de animales (ovinos y caprinos), su historial (fotos, pesajes,
 * registro sanitario y de manejo), los eventos generales de instalaciones y los
 * catálogos de razas y colores.
 * La reproducción (montas, partos) está en su propio módulo y depende de los
 * servicios que este exporta.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BreedOrmEntity,
      AnimalColorOrmEntity,
      AnimalOrmEntity,
      AnimalPhotoOrmEntity,
      AnimalWeighingOrmEntity,
      HealthRecordOrmEntity,
      GeneticCategoryChangeOrmEntity,
    ]),
    StorageModule,
    ImagesModule,
    VeterinaryModule,
    UsersModule,
  ],
  controllers: [
    BreedController,
    AnimalColorController,
    AnimalController,
    AnimalPhotoController,
    WeighingController,
    HealthRecordController,
    GeneticCategoryController,
  ],
  providers: [
    { provide: BREED_REPOSITORY, useClass: BreedTypeormRepository },
    {
      provide: ANIMAL_COLOR_REPOSITORY,
      useClass: AnimalColorTypeormRepository,
    },
    { provide: ANIMAL_REPOSITORY, useClass: AnimalTypeormRepository },
    {
      provide: ANIMAL_WEIGHING_REPOSITORY,
      useClass: AnimalWeighingTypeormRepository,
    },
    {
      provide: HEALTH_RECORD_REPOSITORY,
      useClass: HealthRecordTypeormRepository,
    },
    WeighingService,
    HealthRecordService,
    {
      provide: ANIMAL_PHOTO_REPOSITORY,
      useClass: AnimalPhotoTypeormRepository,
    },
    CreateBreedUseCase,
    UpdateBreedUseCase,
    GetBreedUseCase,
    ListBreedsUseCase,
    DeleteBreedUseCase,
    CreateAnimalColorUseCase,
    UpdateAnimalColorUseCase,
    GetAnimalColorUseCase,
    ListAnimalColorsUseCase,
    DeleteAnimalColorUseCase,
    AnimalGenealogyService,
    AnimalIdentifierService,
    CreateAnimalUseCase,
    UpdateAnimalUseCase,
    GetAnimalUseCase,
    ListAnimalsUseCase,
    ChangeAnimalStatusUseCase,
    DeleteAnimalUseCase,
    UploadAnimalCertificateUseCase,
    GetAnimalCertificateUseCase,
    DeleteAnimalCertificateUseCase,
    GenerateAnimalCertificateUseCase,
    {
      provide: ANIMAL_CERTIFICATE_RENDERER,
      useClass: PdfkitAnimalCertificateRenderer,
    },
    AnimalPhotoUrlService,
    UploadAnimalPhotoUseCase,
    ListAnimalPhotosUseCase,
    GetAnimalPhotoUseCase,
    UpdateAnimalPhotoUseCase,
    SetPrimaryAnimalPhotoUseCase,
    DeleteAnimalPhotoUseCase,
    GeneticCategoryService,
  ],
  // El módulo de reproducción crea las crías al registrar un parto y arma los
  // recordatorios (/reminders) junto con los pesajes y las dosis.
  exports: [
    ANIMAL_REPOSITORY,
    ANIMAL_WEIGHING_REPOSITORY,
    GetAnimalUseCase,
    GetBreedUseCase,
    GetAnimalColorUseCase,
    AnimalIdentifierService,
    WeighingService,
    HealthRecordService,
  ],
})
export class AnimalsModule {}
