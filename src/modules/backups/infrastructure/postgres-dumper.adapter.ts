import { spawn } from 'child_process';
import type { IDatabaseDumper } from '../application/ports/database-dumper.interface';

export interface PostgresConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Usa las herramientas oficiales de PostgreSQL (pg_dump, pg_restore, psql).
 * La imagen Docker de la API las trae de postgres:17-alpine, la misma versión
 * que el servidor.
 */
export class PostgresDumperAdapter implements IDatabaseDumper {
  constructor(private readonly connection: PostgresConnection) {}

  async dump(filePath: string): Promise<void> {
    await this.run('pg_dump', [
      ...this.connectionArgs(),
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      `--file=${filePath}`,
    ]);
  }

  async restore(filePath: string): Promise<void> {
    // 1) pg_restore convierte el volcado en un script SQL completo. Si el
    //    volcado está dañado, falla acá, antes de tocar la base.
    const sqlPath = `${filePath}.sql`;
    await this.run('pg_restore', [
      '--no-owner',
      '--no-privileges',
      `--file=${sqlPath}`,
      filePath,
    ]);
    // 2) psql borra el esquema y ejecuta el script en UNA transacción: si
    //    cualquier sentencia falla, se deshace todo y la base queda como estaba.
    await this.run('psql', [
      ...this.connectionArgs(),
      '--no-psqlrc',
      '--quiet',
      '--single-transaction',
      '--set=ON_ERROR_STOP=1',
      '--command=DROP SCHEMA public CASCADE',
      '--command=CREATE SCHEMA public',
      `--file=${sqlPath}`,
    ]);
  }

  async describe(): Promise<{
    serverVersion: string;
    lastMigration: string | null;
  }> {
    const output = await this.run('psql', [
      ...this.connectionArgs(),
      '--no-psqlrc',
      '--tuples-only',
      '--no-align',
      '--command=SHOW server_version',
      `--command=SELECT name FROM migrations ORDER BY id DESC LIMIT 1`,
    ]);
    const [serverVersion = '', lastMigration = ''] = output
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return { serverVersion, lastMigration: lastMigration || null };
  }

  private connectionArgs(): string[] {
    const c = this.connection;
    return [
      `--host=${c.host}`,
      `--port=${c.port}`,
      `--username=${c.user}`,
      `--dbname=${c.database}`,
      '--no-password',
    ];
  }

  private async run(command: string, args: string[]): Promise<string> {
    const { child, done } = this.start(command, args);
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    await done;
    return stdout;
  }

  /** Lanza el proceso; `done` se resuelve si termina bien y falla con su stderr si no. */
  private start(command: string, args: string[]) {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        PGPASSWORD: this.connection.password,
        // Sin Kerberos: evita que libpq lo intente en cada conexión.
        PGGSSENCMODE: 'disable',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    const done = new Promise<void>((resolve, reject) => {
      child.on('error', (error: NodeJS.ErrnoException) =>
        reject(
          error.code === 'ENOENT'
            ? new Error(
                `No se encontró "${command}". Las copias de seguridad necesitan las herramientas de PostgreSQL 17; la imagen Docker de la API ya las incluye.`,
              )
            : error,
        ),
      );
      child.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(
                `${command} terminó con código ${code}: ${stderr.trim().slice(-2000)}`,
              ),
            ),
      );
    });
    return { child, done };
  }
}
