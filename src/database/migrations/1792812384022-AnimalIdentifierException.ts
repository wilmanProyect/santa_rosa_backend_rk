import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnimalIdentifierException1792812384022 implements MigrationInterface {
  name = 'AnimalIdentifierException1792812384022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "animals" ADD "identifier_exception" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD "identifier_exception_reason" character varying(500)`,
    );
    // La versión anterior permitía repetir arete o ABSID por separado. Los
    // duplicados existentes se marcan como caso especial (salvo el registrado
    // primero) para que los índices únicos se puedan crear.
    await queryRunner.query(`
            UPDATE "animals" SET "identifier_exception" = true,
                   "identifier_exception_reason" = 'Marcado automáticamente al activar la validación de duplicados'
             WHERE "id" IN (
                SELECT "id" FROM (
                    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "ear_tag" ORDER BY "created_at", "id") AS n
                      FROM "animals"
                     WHERE "deleted_at" IS NULL AND NOT "is_external" AND "ear_tag" IS NOT NULL
                ) t WHERE n > 1
                UNION
                SELECT "id" FROM (
                    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "absid_registry" ORDER BY "created_at", "id") AS n
                      FROM "animals"
                     WHERE "deleted_at" IS NULL AND "absid_registry" IS NOT NULL
                ) t WHERE n > 1
             )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animals_absid_registry_active" ON "animals"  ("absid_registry") WHERE "deleted_at" IS NULL AND NOT "identifier_exception"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animals_ear_tag_active" ON "animals"  ("ear_tag") WHERE "deleted_at" IS NULL AND NOT "is_external" AND NOT "identifier_exception"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "CHK_animals_identifier_exception" CHECK (("identifier_exception" AND "identifier_exception_reason" IS NOT NULL) OR (NOT "identifier_exception" AND "identifier_exception_reason" IS NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "animals" DROP CONSTRAINT "CHK_animals_identifier_exception"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_animals_ear_tag_active"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_animals_absid_registry_active"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" DROP COLUMN "identifier_exception_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" DROP COLUMN "identifier_exception"`,
    );
  }
}
