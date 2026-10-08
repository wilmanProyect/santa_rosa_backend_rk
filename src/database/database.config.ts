import { join } from 'path';
import type { DataSourceOptions } from 'typeorm';

type EnvReader = (key: string) => string | undefined;

// Con ts-node se cargan los .ts de src/; compilado, los .js de dist/ (nunca los .d.ts).
const EXT = __filename.endsWith('.ts') ? 'ts' : 'js';

/**
 * Configuración de PostgreSQL compartida por la aplicación (AppModule) y por
 * el CLI de TypeORM (data-source.ts) que genera y ejecuta las migraciones.
 *
 * El esquema se gestiona SOLO con migraciones: synchronize está siempre apagado.
 */
export function buildDataSourceOptions(env: EnvReader): DataSourceOptions {
  return {
    type: 'postgres',
    host: env('DB_HOST') ?? 'localhost',
    port: Number(env('DB_PORT') ?? 5432),
    username: env('DB_USER') ?? 'postgres',
    password: env('DB_PASSWORD') ?? 'postgres',
    database: env('DB_NAME') ?? 'santa_rosa_db',
    entities: [join(__dirname, '..', '**', `*.orm-entity.${EXT}`)],
    migrations: [join(__dirname, 'migrations', `*.${EXT}`)],
    migrationsTableName: 'migrations',
    synchronize: false,
  };
}
