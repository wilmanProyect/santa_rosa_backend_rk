import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Precio (valorización) del animal, en bolivianos. Dato reservado: la API solo
 * lo muestra con animals:read-price y solo lo acepta con animals:set-price.
 * Los cambios quedan en el registro de actividad (trigger de animals).
 */
export class AnimalPrice1794988800000 implements MigrationInterface {
  name = 'AnimalPrice1794988800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "animals" ADD "price" numeric(12,2)`);
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "CHK_animals_price" CHECK ("price" IS NULL OR ("price" >= 0 AND NOT "is_external"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "animals" DROP CONSTRAINT "CHK_animals_price"`,
    );
    await queryRunner.query(`ALTER TABLE "animals" DROP COLUMN "price"`);
  }
}
