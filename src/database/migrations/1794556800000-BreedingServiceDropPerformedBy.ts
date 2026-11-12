import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Quién hizo la monta" se escribía a mano. Ahora se muestra quién la
 * registró (created_by), así que la columna sobra.
 */
export class BreedingServiceDropPerformedBy1794556800000 implements MigrationInterface {
  name = 'BreedingServiceDropPerformedBy1794556800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "breeding_services" DROP COLUMN "performed_by"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "breeding_services" ADD "performed_by" character varying(150)`,
    );
  }
}
