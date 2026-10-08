import 'reflect-metadata';
import { existsSync } from 'fs';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.config';

// DataSource para el CLI de TypeORM (pnpm migration:*). Las variables ya
// definidas en el entorno tienen prioridad sobre las del archivo .env.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default new DataSource(
  buildDataSourceOptions((key) => process.env[key]),
);
