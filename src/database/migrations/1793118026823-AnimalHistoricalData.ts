import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajustes para cargar el inventario histórico (planilla Excel):
 *  - Estado nuevo EXCHANGED (intercambiado) y origen INITIAL_STOCK (inventario inicial).
 *  - La categoría genética deja de ser obligatoria (se completa después).
 *  - El arete puede faltar en un caso especial (identifier_exception).
 *  - Fecha de ingreso opcional en compras/donaciones/regalos.
 *  - Fecha de salida opcional en la BD (la API la sigue exigiendo en salidas nuevas).
 *  - Arete y ABSID únicos por especie (ovinos y caprinos tienen numeración propia).
 *
 * Escrita a mano: TypeORM no detecta cambios en el contenido de un CHECK que
 * conserva su nombre.
 */
export class AnimalHistoricalData1793118026823 implements MigrationInterface {
  name = 'AnimalHistoricalData1793118026823';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.replaceCheck(
      queryRunner,
      'CHK_animals_status',
      `"status" IN ('ALIVE', 'DEAD', 'SOLD', 'SLAUGHTERED', 'GIFTED', 'EXCHANGED')`,
    );
    await this.replaceCheck(
      queryRunner,
      'CHK_animals_entry_origin',
      `"entry_origin" IN ('BORN_ON_FARM', 'PURCHASE', 'DONATION', 'GIFT', 'INITIAL_STOCK')`,
    );
    await this.replaceCheck(
      queryRunner,
      'CHK_animals_internal_required',
      `"is_external" OR ("entry_origin" IS NOT NULL AND ("ear_tag" IS NOT NULL OR "identifier_exception"))`,
    );
    await this.replaceCheck(
      queryRunner,
      'CHK_animals_entry',
      `"entry_origin" IS NULL OR ("entry_origin" = 'BORN_ON_FARM' AND "birth_date" IS NOT NULL AND "entry_date" IS NULL AND "source_farm" IS NULL) OR "entry_origin" <> 'BORN_ON_FARM'`,
    );
    await this.replaceCheck(
      queryRunner,
      'CHK_animals_status_fields',
      `"status" <> 'ALIVE' OR ("status_date" IS NULL AND "status_reason" IS NULL)`,
    );

    await queryRunner.query(`DROP INDEX "public"."UQ_animals_ear_tag_active"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_animals_absid_registry_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_animals_ear_tag_absid_registry_active"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animals_ear_tag_active" ON "animals" ("species", "ear_tag") WHERE "deleted_at" IS NULL AND NOT "is_external" AND NOT "identifier_exception"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animals_absid_registry_active" ON "animals" ("species", "absid_registry") WHERE "deleted_at" IS NULL AND NOT "identifier_exception"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animals_ear_tag_absid_registry_active" ON "animals" ("species", "ear_tag", "absid_registry") WHERE "deleted_at" IS NULL`,
    );
  }

  /** Falla si ya hay datos que no cumplen las reglas anteriores (p. ej. el histórico importado). */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_animals_ear_tag_absid_registry_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_animals_absid_registry_active"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_animals_ear_tag_active"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animals_ear_tag_absid_registry_active" ON "animals" ("ear_tag", "absid_registry") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animals_absid_registry_active" ON "animals" ("absid_registry") WHERE "deleted_at" IS NULL AND NOT "identifier_exception"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animals_ear_tag_active" ON "animals" ("ear_tag") WHERE "deleted_at" IS NULL AND NOT "is_external" AND NOT "identifier_exception"`,
    );

    await this.replaceCheck(
      queryRunner,
      'CHK_animals_status_fields',
      `("status" = 'ALIVE' AND "status_date" IS NULL AND "status_reason" IS NULL) OR ("status" <> 'ALIVE' AND "status_date" IS NOT NULL)`,
    );
    await this.replaceCheck(
      queryRunner,
      'CHK_animals_entry',
      `"entry_origin" IS NULL OR ("entry_origin" = 'BORN_ON_FARM' AND "birth_date" IS NOT NULL AND "entry_date" IS NULL AND "source_farm" IS NULL) OR ("entry_origin" <> 'BORN_ON_FARM' AND "entry_date" IS NOT NULL)`,
    );
    await this.replaceCheck(
      queryRunner,
      'CHK_animals_internal_required',
      `"is_external" OR ("ear_tag" IS NOT NULL AND "genetic_category" IS NOT NULL AND "entry_origin" IS NOT NULL)`,
    );
    await this.replaceCheck(
      queryRunner,
      'CHK_animals_entry_origin',
      `"entry_origin" IN ('BORN_ON_FARM', 'PURCHASE', 'DONATION', 'GIFT')`,
    );
    await this.replaceCheck(
      queryRunner,
      'CHK_animals_status',
      `"status" IN ('ALIVE', 'DEAD', 'SOLD', 'SLAUGHTERED', 'GIFTED')`,
    );
  }

  private async replaceCheck(
    queryRunner: QueryRunner,
    name: string,
    expression: string,
  ): Promise<void> {
    await queryRunner.query(`ALTER TABLE "animals" DROP CONSTRAINT "${name}"`);
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "${name}" CHECK (${expression})`,
    );
  }
}
