import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Módulo de reproducción: montas, diagnósticos de preñez, partos y sus crías,
 * más el historial de categoría genética.
 *
 * Datos existentes:
 *  - Las categorías ya cargadas quedan como confirmadas (vienen de ABSID) y
 *    abren el historial de cada animal.
 *  - Los partos anteriores se reconstruyen (is_historical): las crías nacidas
 *    en la cabaña con la misma madre y la misma fecha de nacimiento forman un
 *    parto. Si las crías tienen padres distintos, el parto queda sin padre y
 *    con una observación. Todas las crías históricas se registran como vivas.
 */
export class Reproduction1794409623224 implements MigrationInterface {
  name = 'Reproduction1794409623224';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "genetic_category_changes" ("id" uuid NOT NULL, "from_category" character varying(20), "to_category" character varying(20), "kind" character varying(20) NOT NULL, "changed_on" date NOT NULL, "absid_certificate_code" character varying(50), "notes" character varying(500), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "animal_id" uuid NOT NULL, CONSTRAINT "CHK_genetic_category_changes_to" CHECK ("to_category" IN ('COMMERCIAL', 'BASE', 'G1', 'G2', 'G3', 'G4', 'PO')), CONSTRAINT "CHK_genetic_category_changes_from" CHECK ("from_category" IN ('COMMERCIAL', 'BASE', 'G1', 'G2', 'G3', 'G4', 'PO')), CONSTRAINT "CHK_genetic_category_changes_kind" CHECK ("kind" IN ('EXPECTED_AT_BIRTH', 'CONFIRMED', 'MANUAL')), CONSTRAINT "PK_304a8a98ee2b77797c72daf98b1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_genetic_category_changes_animal" ON "genetic_category_changes"  ("animal_id", "changed_on") `,
    );
    await queryRunner.query(
      `CREATE TABLE "pregnancy_checks" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "checked_at" date NOT NULL, "method" character varying(20) NOT NULL, "result" character varying(20) NOT NULL, "fetus_count" smallint, "notes" character varying(500), "service_id" uuid NOT NULL, CONSTRAINT "CHK_pregnancy_checks_fetus_count" CHECK ("fetus_count" IS NULL OR ("result" = 'PREGNANT' AND "fetus_count" BETWEEN 1 AND 4)), CONSTRAINT "CHK_pregnancy_checks_result" CHECK ("result" IN ('PREGNANT', 'EMPTY')), CONSTRAINT "CHK_pregnancy_checks_method" CHECK ("method" IN ('ULTRASOUND', 'OBSERVATION')), CONSTRAINT "PK_453460a54103b115e4f1a65bfef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pregnancy_checks_service" ON "pregnancy_checks"  ("service_id", "checked_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "breeding_services" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "species" character varying(10) NOT NULL, "type" character varying(30) NOT NULL, "service_date" date NOT NULL, "straw_code" character varying(50), "performed_by" character varying(150), "expected_birth_date" date NOT NULL, "status" character varying(20) NOT NULL, "inbreeding_coefficient" numeric(6,5) NOT NULL DEFAULT '0', "kinship_override_reason" character varying(500), "kinship_override_by" uuid, "kinship_override_at" TIMESTAMP WITH TIME ZONE, "expected_offspring_category" character varying(20), "abortion_date" date, "abortion_cause" character varying(500), "notes" character varying(1000), "dam_id" uuid NOT NULL, "sire_id" uuid NOT NULL, CONSTRAINT "CHK_breeding_services_inbreeding" CHECK ("inbreeding_coefficient" BETWEEN 0 AND 1), CONSTRAINT "CHK_breeding_services_straw" CHECK ("straw_code" IS NULL OR "type" = 'ARTIFICIAL_INSEMINATION'), CONSTRAINT "CHK_breeding_services_override" CHECK (num_nonnulls("kinship_override_reason", "kinship_override_by", "kinship_override_at") IN (0, 3)), CONSTRAINT "CHK_breeding_services_abortion" CHECK (("status" = 'ABORTED') = ("abortion_date" IS NOT NULL)), CONSTRAINT "CHK_breeding_services_dates" CHECK ("expected_birth_date" > "service_date" AND ("abortion_date" IS NULL OR "abortion_date" >= "service_date")), CONSTRAINT "CHK_breeding_services_pair" CHECK ("dam_id" <> "sire_id"), CONSTRAINT "CHK_breeding_services_category" CHECK ("expected_offspring_category" IN ('COMMERCIAL', 'BASE', 'G1', 'G2', 'G3', 'G4', 'PO')), CONSTRAINT "CHK_breeding_services_species" CHECK ("species" IN ('SHEEP', 'GOAT')), CONSTRAINT "CHK_breeding_services_status" CHECK ("status" IN ('PENDING', 'PREGNANT', 'EMPTY', 'BIRTHED', 'ABORTED')), CONSTRAINT "CHK_breeding_services_type" CHECK ("type" IN ('DIRECTED', 'ARTIFICIAL_INSEMINATION')), CONSTRAINT "PK_31c44021f5e72bff0f33d1ca017" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_breeding_services_open_dam" ON "breeding_services"  ("dam_id") WHERE "status" IN ('PENDING', 'PREGNANT') AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_breeding_services_status" ON "breeding_services"  ("status", "expected_birth_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_breeding_services_sire" ON "breeding_services"  ("sire_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_breeding_services_dam_date" ON "breeding_services"  ("dam_id", "service_date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "births" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "species" character varying(10) NOT NULL, "birth_date" date NOT NULL, "assistance" character varying(20), "is_historical" boolean NOT NULL DEFAULT false, "notes" character varying(1000), "service_id" uuid, "dam_id" uuid NOT NULL, "sire_id" uuid, CONSTRAINT "CHK_births_parents" CHECK ("sire_id" IS NULL OR "dam_id" <> "sire_id"), CONSTRAINT "CHK_births_assistance" CHECK ("assistance" IN ('NORMAL', 'ASSISTED', 'CESAREAN')), CONSTRAINT "CHK_births_species" CHECK ("species" IN ('SHEEP', 'GOAT')), CONSTRAINT "PK_cd30730b5b33e9c1271ec909b42" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_births_service" ON "births"  ("service_id") WHERE "service_id" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_births_date" ON "births"  ("birth_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_births_sire" ON "births"  ("sire_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_births_dam_date" ON "births"  ("dam_id", "birth_date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "birth_offspring" ("id" uuid NOT NULL, "position" smallint NOT NULL, "sex" character varying(10), "born_alive" boolean NOT NULL, "birth_weight_kg" numeric(5,2), "birth_id" uuid NOT NULL, "animal_id" uuid, CONSTRAINT "CHK_birth_offspring_position" CHECK ("position" >= 1), CONSTRAINT "CHK_birth_offspring_weight" CHECK ("birth_weight_kg" IS NULL OR "birth_weight_kg" > 0), CONSTRAINT "CHK_birth_offspring_alive" CHECK ("born_alive" = ("animal_id" IS NOT NULL)), CONSTRAINT "CHK_birth_offspring_sex" CHECK ("sex" IN ('MALE', 'FEMALE')), CONSTRAINT "PK_3dd07efa44ecb6e238bb352248d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_birth_offspring_animal" ON "birth_offspring"  ("animal_id") WHERE "animal_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_birth_offspring_position" ON "birth_offspring"  ("birth_id", "position") `,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD "genetic_category_confirmed" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "CHK_animals_genetic_category_confirmed" CHECK (NOT "genetic_category_confirmed" OR "genetic_category" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE "genetic_category_changes" ADD CONSTRAINT "FK_c776162d6897c422eac00504f9a" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pregnancy_checks" ADD CONSTRAINT "FK_e18d84cc81468d9c11779983a8c" FOREIGN KEY ("service_id") REFERENCES "breeding_services"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeding_services" ADD CONSTRAINT "FK_bc264595d4f4f20ab65415613ea" FOREIGN KEY ("dam_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeding_services" ADD CONSTRAINT "FK_11883ce1ce048f3d8cffbdc0944" FOREIGN KEY ("sire_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "births" ADD CONSTRAINT "FK_d31b5e5c85d452cf34dea636ea1" FOREIGN KEY ("service_id") REFERENCES "breeding_services"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "births" ADD CONSTRAINT "FK_951c464deafed8b14a5d32c2537" FOREIGN KEY ("dam_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "births" ADD CONSTRAINT "FK_2fa0fdb08c663d0b7f0b477433f" FOREIGN KEY ("sire_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "birth_offspring" ADD CONSTRAINT "FK_5c12c681c3e5e37ee4a751b7a84" FOREIGN KEY ("birth_id") REFERENCES "births"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "birth_offspring" ADD CONSTRAINT "FK_ceec2be4645998478a2cfaebac8" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // ---------- Datos existentes ----------
    await queryRunner.query(
      `UPDATE "animals" SET "genetic_category_confirmed" = true WHERE "genetic_category" IS NOT NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "genetic_category_changes" ("id", "animal_id", "from_category", "to_category", "kind", "changed_on", "notes", "created_by")
             SELECT gen_random_uuid(), "id", NULL, "genetic_category", 'MANUAL', "created_at"::date,
                    'Categoría registrada antes del historial', "created_by"
               FROM "animals"
              WHERE "genetic_category" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "births" ("id", "species", "birth_date", "is_historical", "notes", "dam_id", "sire_id")
             SELECT gen_random_uuid(), d."species", g."birth_date", true,
                    NULLIF(concat_ws(' ',
                      CASE WHEN g."mixed" THEN 'Histórico: las crías tienen padres distintos o alguna sin padre registrado.' END,
                      CASE WHEN d."is_external" THEN 'Histórico: la madre está registrada como animal externo.' END), ''),
                    g."dam_id",
                    CASE WHEN NOT g."mixed" THEN g."sire_id" END
               FROM (SELECT c."dam_id", c."birth_date",
                            MAX(c."sire_id"::text)::uuid AS "sire_id",
                            (COUNT(DISTINCT c."sire_id") > 1
                              OR (COUNT(c."sire_id") > 0 AND COUNT(c."sire_id") < COUNT(*))) AS "mixed"
                       FROM "animals" c
                      WHERE c."deleted_at" IS NULL AND c."entry_origin" = 'BORN_ON_FARM'
                        AND c."dam_id" IS NOT NULL AND c."birth_date" IS NOT NULL
                      GROUP BY c."dam_id", c."birth_date") g
               JOIN "animals" d ON d."id" = g."dam_id" AND d."deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "birth_offspring" ("id", "position", "sex", "born_alive", "birth_weight_kg", "birth_id", "animal_id")
             SELECT gen_random_uuid(),
                    ROW_NUMBER() OVER (PARTITION BY b."id" ORDER BY c."ear_tag" NULLS LAST, c."created_at", c."id"),
                    c."sex", true, w."weight_kg", b."id", c."id"
               FROM "births" b
               JOIN "animals" c ON c."dam_id" = b."dam_id" AND c."birth_date" = b."birth_date"
                AND c."deleted_at" IS NULL AND c."entry_origin" = 'BORN_ON_FARM'
               LEFT JOIN "animal_weighings" w ON w."animal_id" = c."id" AND w."type" = 'BIRTH' AND w."deleted_at" IS NULL
              WHERE b."is_historical"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "birth_offspring" DROP CONSTRAINT "FK_ceec2be4645998478a2cfaebac8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "birth_offspring" DROP CONSTRAINT "FK_5c12c681c3e5e37ee4a751b7a84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "births" DROP CONSTRAINT "FK_2fa0fdb08c663d0b7f0b477433f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "births" DROP CONSTRAINT "FK_951c464deafed8b14a5d32c2537"`,
    );
    await queryRunner.query(
      `ALTER TABLE "births" DROP CONSTRAINT "FK_d31b5e5c85d452cf34dea636ea1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeding_services" DROP CONSTRAINT "FK_11883ce1ce048f3d8cffbdc0944"`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeding_services" DROP CONSTRAINT "FK_bc264595d4f4f20ab65415613ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pregnancy_checks" DROP CONSTRAINT "FK_e18d84cc81468d9c11779983a8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "genetic_category_changes" DROP CONSTRAINT "FK_c776162d6897c422eac00504f9a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" DROP CONSTRAINT "CHK_animals_genetic_category_confirmed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" DROP COLUMN "genetic_category_confirmed"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_birth_offspring_position"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_birth_offspring_animal"`);
    await queryRunner.query(`DROP TABLE "birth_offspring"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_births_dam_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_births_sire"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_births_date"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_births_service"`);
    await queryRunner.query(`DROP TABLE "births"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_breeding_services_dam_date"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_breeding_services_sire"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_breeding_services_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_breeding_services_open_dam"`,
    );
    await queryRunner.query(`DROP TABLE "breeding_services"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pregnancy_checks_service"`,
    );
    await queryRunner.query(`DROP TABLE "pregnancy_checks"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_genetic_category_changes_animal"`,
    );
    await queryRunner.query(`DROP TABLE "genetic_category_changes"`);
  }
}
