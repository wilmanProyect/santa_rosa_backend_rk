import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Muerte de la madre durante la gestación: nuevo estado DAM_DIED de la monta,
 * con fecha, causa, si la preñez estaba confirmada y los fetos perdidos.
 *
 * Cierra como DAM_DIED las montas abiertas (sin diagnóstico o preñadas) de
 * hembras que ya figuran como muertas en el inventario, si la fecha de muerte
 * no es anterior a la monta ni a su último diagnóstico. Las demás se dejan
 * como están para revisarlas a mano.
 */
export class BreedingServiceDamDeath1794643200000 implements MigrationInterface {
  name = 'BreedingServiceDamDeath1794643200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "breeding_services"
         ADD "dam_death_date" date,
         ADD "dam_death_cause" character varying(500),
         ADD "dam_death_confirmed_pregnancy" boolean NOT NULL DEFAULT false,
         ADD "dam_death_lost_fetuses" smallint`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeding_services" DROP CONSTRAINT "CHK_breeding_services_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeding_services" ADD CONSTRAINT "CHK_breeding_services_status" CHECK ("status" IN ('PENDING', 'PREGNANT', 'EMPTY', 'BIRTHED', 'ABORTED', 'DAM_DIED'))`,
    );

    // Último diagnóstico vigente de cada monta (mismo orden que el modelo).
    const lastCheck = (column: string) =>
      `(SELECT ${column} FROM "pregnancy_checks" c
         WHERE c."service_id" = s."id" AND c."deleted_at" IS NULL
         ORDER BY c."checked_at" DESC, c."created_at" DESC LIMIT 1)`;
    await queryRunner.query(
      `UPDATE "breeding_services" s
          SET "status" = 'DAM_DIED',
              "dam_death_date" = a."status_date",
              "dam_death_cause" = a."status_reason",
              "dam_death_confirmed_pregnancy" = COALESCE(${lastCheck(`c."result" = 'PREGNANT'`)}, false),
              "dam_death_lost_fetuses" = ${lastCheck(`CASE WHEN c."result" = 'PREGNANT' THEN c."fetus_count" END`)},
              "updated_at" = now()
         FROM "animals" a
        WHERE a."id" = s."dam_id"
          AND s."deleted_at" IS NULL
          AND s."status" IN ('PENDING', 'PREGNANT')
          AND a."status" = 'DEAD'
          AND a."status_date" IS NOT NULL
          AND a."status_date" >= s."service_date"
          AND NOT EXISTS (
                SELECT 1 FROM "pregnancy_checks" c
                 WHERE c."service_id" = s."id" AND c."deleted_at" IS NULL
                   AND c."checked_at" > a."status_date")`,
    );

    await queryRunner.query(
      `ALTER TABLE "breeding_services" ADD CONSTRAINT "CHK_breeding_services_dam_death" CHECK (("status" = 'DAM_DIED') = ("dam_death_date" IS NOT NULL)
   AND ("dam_death_date" IS NULL OR "dam_death_date" >= "service_date")
   AND ("dam_death_lost_fetuses" IS NULL OR ("dam_death_confirmed_pregnancy" AND "dam_death_lost_fetuses" BETWEEN 1 AND 4)))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "breeding_services" DROP CONSTRAINT "CHK_breeding_services_dam_death"`,
    );
    // Las montas cerradas por la muerte vuelven al estado de su último diagnóstico.
    await queryRunner.query(
      `UPDATE "breeding_services" s
          SET "status" = COALESCE(
                (SELECT c."result" FROM "pregnancy_checks" c
                  WHERE c."service_id" = s."id" AND c."deleted_at" IS NULL
                  ORDER BY c."checked_at" DESC, c."created_at" DESC LIMIT 1),
                'PENDING')
        WHERE s."status" = 'DAM_DIED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeding_services" DROP CONSTRAINT "CHK_breeding_services_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeding_services" ADD CONSTRAINT "CHK_breeding_services_status" CHECK ("status" IN ('PENDING', 'PREGNANT', 'EMPTY', 'BIRTHED', 'ABORTED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeding_services"
         DROP COLUMN "dam_death_lost_fetuses",
         DROP COLUMN "dam_death_confirmed_pregnancy",
         DROP COLUMN "dam_death_cause",
         DROP COLUMN "dam_death_date"`,
    );
  }
}
