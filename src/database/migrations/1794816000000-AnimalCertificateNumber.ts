import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Número fijo del certificado del animal (PDF generado). Antes se generaba uno
 * nuevo en cada emisión; ahora se asigna en la primera y se repite siempre.
 * Los animales ya certificados reciben su número fijo en la próxima emisión.
 */
export class AnimalCertificateNumber1794816000000 implements MigrationInterface {
  name = 'AnimalCertificateNumber1794816000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "animals" ADD "certificate_number" character varying(30)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animals_certificate_number" ON "animals" ("certificate_number") WHERE "certificate_number" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_animals_certificate_number"`);
    await queryRunner.query(
      `ALTER TABLE "animals" DROP COLUMN "certificate_number"`,
    );
  }
}
