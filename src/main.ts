import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/infrastructure/filters/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // El frontend corre en otro contenedor/dominio: se permiten solo los orígenes
  // listados en CORS_ORIGINS (separados por coma).
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins });

  // Necesario detrás de un proxy inverso para registrar la IP real en el historial de login.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', true);
  }

  // Validaciones Globales
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Errores de dominio → 400, duplicados en BD → 409
  app.useGlobalFilters(new DomainExceptionFilter());

  // Configuración de Documentación Swagger
  const config = new DocumentBuilder()
    .setTitle('Santa Rosa Backend API')
    .setDescription(
      'API para el sistema Santa Rosa, con soporte de Roles, Permisos y Gestión de Usuarios.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Al recibir SIGTERM (docker stop) cierra las conexiones a la BD ordenadamente.
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(
    `📚 Swagger documentation available at: http://localhost:${port}/docs`,
  );
}
void bootstrap();
