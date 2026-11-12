import { MigrationInterface, QueryRunner } from 'typeorm';

/** Fecha de salida de la monta (la de ingreso sigue en service_date). */
export class BreedingServiceExitDate1794470400000 implements MigrationInterface {
  name = 'BreedingServiceExitDate1794470400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "breeding_services" ADD "exit_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeding_services" ADD CONSTRAINT "CHK_breeding_services_exit" CHECK ("exit_date" IS NULL OR "exit_date" >= "service_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "breeding_services" DROP CONSTRAINT "CHK_breeding_services_exit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeding_services" DROP COLUMN "exit_date"`,
    );
  }
}
