import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Control de peso, registro sanitario y catálogo de productos veterinarios.
 *
 * El historial de pesajes pasa a ser la única fuente de los pesos: los pesos
 * al nacer y al destete que estaban en `animals` se copian a `animal_weighings`
 * (tipos BIRTH y WEANING) y luego se eliminan esas columnas.
 */
export class WeighingsHealthRecords1793675929086 implements MigrationInterface {
  name = 'WeighingsHealthRecords1793675929086';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------- Pesajes ----------
    await queryRunner.query(
      `CREATE TABLE "animal_weighings" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "weighed_at" date NOT NULL, "weight_kg" numeric(5,2) NOT NULL, "type" character varying(20) NOT NULL, "body_condition_score" numeric(2,1), "is_estimated" boolean NOT NULL DEFAULT false, "next_weighing_at" date, "notes" character varying(1000), "animal_id" uuid NOT NULL, CONSTRAINT "CHK_animal_weighings_next" CHECK ("next_weighing_at" IS NULL OR "next_weighing_at" > "weighed_at"), CONSTRAINT "CHK_animal_weighings_body_condition" CHECK ("body_condition_score" IS NULL OR ("body_condition_score" BETWEEN 1 AND 5 AND ("body_condition_score" * 2) = trunc("body_condition_score" * 2))), CONSTRAINT "CHK_animal_weighings_weight" CHECK ("weight_kg" > 0), CONSTRAINT "CHK_animal_weighings_type" CHECK ("type" IN ('BIRTH', 'WEANING', 'ROUTINE', 'SELECTION', 'ENTRY', 'SALE', 'OTHER')), CONSTRAINT "PK_67e28e076d7d47270840c1d5add" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animal_weighings_weaning" ON "animal_weighings" ("animal_id") WHERE "type" = 'WEANING' AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animal_weighings_birth" ON "animal_weighings" ("animal_id") WHERE "type" = 'BIRTH' AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_animal_weighings_next" ON "animal_weighings" ("next_weighing_at") WHERE "next_weighing_at" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_animal_weighings_animal_date" ON "animal_weighings" ("animal_id", "weighed_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "animal_weighings" ADD CONSTRAINT "FK_c135c35e590ebb3e7a23aa81d8a" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // ---------- Productos veterinarios ----------
    await queryRunner.query(
      `CREATE TABLE "veterinary_products" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "name" character varying(150) NOT NULL, "category" character varying(30) NOT NULL, "active_ingredient" character varying(150), "concentration" character varying(50), "manufacturer" character varying(100), "presentation" character varying(100), "dose_unit" character varying(10), "default_route" character varying(20), "dosage_instructions" character varying(500), "for_sheep" boolean NOT NULL DEFAULT true, "for_goats" boolean NOT NULL DEFAULT true, "meat_withdrawal_days" integer NOT NULL DEFAULT '0', "milk_withdrawal_days" integer, "requires_prescription" boolean NOT NULL DEFAULT false, "requires_refrigeration" boolean NOT NULL DEFAULT false, "notes" character varying(1000), "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "CHK_veterinary_products_withdrawal" CHECK ("meat_withdrawal_days" BETWEEN 0 AND 365 AND ("milk_withdrawal_days" IS NULL OR "milk_withdrawal_days" BETWEEN 0 AND 365)), CONSTRAINT "CHK_veterinary_products_species" CHECK ("for_sheep" OR "for_goats"), CONSTRAINT "CHK_veterinary_products_default_route" CHECK ("default_route" IN ('ORAL', 'SUBCUTANEOUS', 'INTRAMUSCULAR', 'INTRAVENOUS', 'TOPICAL', 'INTRANASAL', 'POUR_ON', 'IMMERSION')), CONSTRAINT "CHK_veterinary_products_dose_unit" CHECK ("dose_unit" IN ('ML', 'G', 'MG', 'TABLET', 'DOSE')), CONSTRAINT "CHK_veterinary_products_category" CHECK ("category" IN ('VACCINE', 'INTERNAL_ANTIPARASITIC', 'EXTERNAL_ANTIPARASITIC', 'ANTIBIOTIC', 'ANTI_INFLAMMATORY', 'VITAMIN_MINERAL', 'DISINFECTANT', 'OTHER')), CONSTRAINT "PK_8ee3675c8b79b76692303475381" PRIMARY KEY ("id"))`,
    );
    // Índice por expresión: TypeORM no lo genera (la entidad lo declara con synchronize: false).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_veterinary_products_name_active" ON "veterinary_products" (lower("name")) WHERE "deleted_at" IS NULL`,
    );

    // ---------- Registro sanitario ----------
    await queryRunner.query(
      `CREATE TABLE "health_records" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "type" character varying(30) NOT NULL, "applied_at" date NOT NULL, "is_date_estimated" boolean NOT NULL DEFAULT false, "meat_withdrawal_days" integer NOT NULL DEFAULT '0', "milk_withdrawal_days" integer, "product_batch" character varying(50), "dose_quantity" numeric(8,2), "dose_unit" character varying(10), "route" character varying(20), "target_condition" character varying(150), "applied_by" character varying(150), "location" character varying(100), "next_dose_at" date, "cost" numeric(10,2), "notes" character varying(1000), "animal_id" uuid, "product_id" uuid, CONSTRAINT "CHK_health_records_cost" CHECK ("cost" IS NULL OR "cost" >= 0), CONSTRAINT "CHK_health_records_next_dose" CHECK ("next_dose_at" IS NULL OR "next_dose_at" > "applied_at"), CONSTRAINT "CHK_health_records_withdrawal" CHECK (("product_id" IS NULL AND "meat_withdrawal_days" = 0 AND "milk_withdrawal_days" IS NULL) OR ("product_id" IS NOT NULL AND "meat_withdrawal_days" >= 0 AND ("milk_withdrawal_days" IS NULL OR "milk_withdrawal_days" >= 0))), CONSTRAINT "CHK_health_records_dose" CHECK (("dose_quantity" IS NULL) = ("dose_unit" IS NULL) AND ("dose_quantity" IS NULL OR "dose_quantity" > 0)), CONSTRAINT "CHK_health_records_animal" CHECK (("type" = 'CORRAL_CLEANING') = ("animal_id" IS NULL)), CONSTRAINT "CHK_health_records_route" CHECK ("route" IN ('ORAL', 'SUBCUTANEOUS', 'INTRAMUSCULAR', 'INTRAVENOUS', 'TOPICAL', 'INTRANASAL', 'POUR_ON', 'IMMERSION')), CONSTRAINT "CHK_health_records_dose_unit" CHECK ("dose_unit" IN ('ML', 'G', 'MG', 'TABLET', 'DOSE')), CONSTRAINT "CHK_health_records_type" CHECK ("type" IN ('VACCINATION', 'INTERNAL_DEWORMING', 'EXTERNAL_DEWORMING', 'VITAMINS_MINERALS', 'TREATMENT', 'DIAGNOSIS', 'SHEARING', 'HOOF_TRIMMING', 'OTHER_PROCEDURE', 'CORRAL_CLEANING')), CONSTRAINT "PK_adbd60dda85d616da89ba3f8270" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_health_records_next_dose" ON "health_records" ("next_dose_at") WHERE "next_dose_at" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_health_records_product" ON "health_records" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_health_records_applied_at" ON "health_records" ("applied_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_health_records_animal_date" ON "health_records" ("animal_id", "applied_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "health_records" ADD CONSTRAINT "FK_dea8e5162db211a087d190ebd72" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "health_records" ADD CONSTRAINT "FK_014d348367f6cf3f3073d220789" FOREIGN KEY ("product_id") REFERENCES "veterinary_products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // ---------- Pesos de la ficha del animal → historial de pesajes ----------
    await queryRunner.query(
      `INSERT INTO "animal_weighings" ("id", "animal_id", "weighed_at", "weight_kg", "type", "created_by", "updated_by")
       SELECT gen_random_uuid(), "id", "birth_date", "birth_weight_kg", 'BIRTH', "created_by", "created_by"
         FROM "animals"
        WHERE "birth_weight_kg" IS NOT NULL AND "birth_date" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "animal_weighings" ("id", "animal_id", "weighed_at", "weight_kg", "type", "created_by", "updated_by")
       SELECT gen_random_uuid(), "id", "weaning_date", "weaning_weight_kg", 'WEANING', "created_by", "created_by"
         FROM "animals"
        WHERE "weaning_weight_kg" IS NOT NULL AND "weaning_date" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    // Un peso al nacer sin fecha de nacimiento no puede ser un pesaje: queda en las observaciones.
    await queryRunner.query(
      `UPDATE "animals"
          SET "notes" = left(concat_ws(E'\\n', "notes", 'Peso al nacer registrado sin fecha de nacimiento: ' || "birth_weight_kg" || ' kg.'), 1000)
        WHERE "birth_weight_kg" IS NOT NULL AND "birth_date" IS NULL AND "deleted_at" IS NULL`,
    );

    // El CHECK de fechas referencia weaning_date: se reemplaza antes de borrar la
    // columna (si no, PostgreSQL lo eliminaría entero junto con ella).
    await queryRunner.query(
      `ALTER TABLE "animals" DROP CONSTRAINT "CHK_animals_dates"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "CHK_animals_dates" CHECK (("entry_date" IS NULL OR "birth_date" IS NULL OR "entry_date" >= "birth_date") AND ("status_date" IS NULL OR "birth_date" IS NULL OR "status_date" >= "birth_date") AND ("status_date" IS NULL OR "entry_date" IS NULL OR "status_date" >= "entry_date"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" DROP CONSTRAINT "CHK_animals_weights"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" DROP COLUMN "birth_weight_kg"`,
    );
    await queryRunner.query(`ALTER TABLE "animals" DROP COLUMN "weaning_date"`);
    await queryRunner.query(
      `ALTER TABLE "animals" DROP COLUMN "weaning_weight_kg"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "animals" ADD "weaning_weight_kg" numeric(5,2)`,
    );
    await queryRunner.query(`ALTER TABLE "animals" ADD "weaning_date" date`);
    await queryRunner.query(
      `ALTER TABLE "animals" ADD "birth_weight_kg" numeric(5,2)`,
    );
    await queryRunner.query(
      `UPDATE "animals" a SET "birth_weight_kg" = w."weight_kg"
         FROM "animal_weighings" w
        WHERE w."animal_id" = a."id" AND w."type" = 'BIRTH' AND w."deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "animals" a SET "weaning_weight_kg" = w."weight_kg", "weaning_date" = w."weighed_at"
         FROM "animal_weighings" w
        WHERE w."animal_id" = a."id" AND w."type" = 'WEANING' AND w."deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "CHK_animals_weights" CHECK (("birth_weight_kg" IS NULL OR "birth_weight_kg" > 0) AND ("weaning_weight_kg" IS NULL OR ("weaning_weight_kg" > 0 AND "weaning_date" IS NOT NULL)))`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" DROP CONSTRAINT "CHK_animals_dates"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "CHK_animals_dates" CHECK (("weaning_date" IS NULL OR "birth_date" IS NULL OR "weaning_date" >= "birth_date") AND ("entry_date" IS NULL OR "birth_date" IS NULL OR "entry_date" >= "birth_date") AND ("status_date" IS NULL OR "birth_date" IS NULL OR "status_date" >= "birth_date") AND ("status_date" IS NULL OR "entry_date" IS NULL OR "status_date" >= "entry_date"))`,
    );

    await queryRunner.query(`DROP TABLE "health_records"`);
    await queryRunner.query(`DROP TABLE "veterinary_products"`);
    await queryRunner.query(`DROP TABLE "animal_weighings"`);
  }
}
