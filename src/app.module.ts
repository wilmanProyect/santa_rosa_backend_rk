import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AreasModule } from './modules/areas/areas.module';
import { RolesPermissionsModule } from './modules/roles-permissions/roles-permissions.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { AnimalsModule } from './modules/animals/animals.module';
import { VeterinaryModule } from './modules/veterinary/veterinary.module';
import { BackupsModule } from './modules/backups/backups.module';
import { buildDataSourceOptions } from './database/database.config';

@Module({
  imports: [
    AreasModule,
    RolesPermissionsModule,
    UsersModule,
    AuthModule,
    AnimalsModule,
    VeterinaryModule,
    BackupsModule,
    // Carga de variables de entorno globalmente
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // PostgreSQL. El esquema se gestiona con migraciones (src/database/migrations),
    // que se aplican al arrancar salvo que DB_MIGRATIONS_RUN=false.
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...buildDataSourceOptions((key) => configService.get<string>(key)),
        // Las entidades las registra cada módulo con forFeature.
        entities: [],
        autoLoadEntities: true,
        migrationsRun:
          configService.get<string>('DB_MIGRATIONS_RUN', 'true') !== 'false',
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
