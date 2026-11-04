import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Estado nuevo LOST (perdido o extraviado).
 *
 * Escrita a mano: TypeORM no detecta cambios en el contenido de un CHECK que
 * conserva su nombre.
 */
export class AnimalStatusLost1793750400000 implements MigrationInterface {
  name = 'AnimalStatusLost1793750400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.replaceStatusCheck(
      queryRunner,
      `'ALIVE', 'DEAD', 'SOLD', 'SLAUGHTERED', 'GIFTED', 'EXCHANGED', 'LOST'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.replaceStatusCheck(
      queryRunner,
      `'ALIVE', 'DEAD', 'SOLD', 'SLAUGHTERED', 'GIFTED', 'EXCHANGED'`,
    );
  }

  private async replaceStatusCheck(
    queryRunner: QueryRunner,
    values: string,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "animals" DROP CONSTRAINT "CHK_animals_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "CHK_animals_status" CHECK ("status" IN (${values}))`,
    );
  }
}
