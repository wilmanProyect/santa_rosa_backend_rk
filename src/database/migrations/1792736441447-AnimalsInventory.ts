import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnimalsInventory1792736441447 implements MigrationInterface {
  name = 'AnimalsInventory1792736441447';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "animal_colors" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "name" character varying(50) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_0a4075f2a1637ddf89dc386fcae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "breeds" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "species" character varying(10) NOT NULL, "name" character varying(100) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_breeds_id_species" UNIQUE ("id", "species"), CONSTRAINT "CHK_breeds_species" CHECK ("species" IN ('SHEEP', 'GOAT')), CONSTRAINT "PK_e89f6e1fbb29d28623b4feb2b3e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "animals" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "is_external" boolean NOT NULL DEFAULT false, "ear_tag" character varying(30), "name" character varying(100), "species" character varying(10) NOT NULL, "sex" character varying(10) NOT NULL, "genetic_category" character varying(20), "absid_registry" character varying(50), "absid_certificate_code" character varying(50), "external_registry" character varying(100), "certificate_file_key" character varying(255), "certificate_file_name" character varying(255), "certificate_file_mime_type" character varying(100), "certificate_file_size" integer, "certificate_file_uploaded_at" TIMESTAMP WITH TIME ZONE, "birth_date" date, "birth_weight_kg" numeric(5,2), "weaning_date" date, "weaning_weight_kg" numeric(5,2), "entry_origin" character varying(20), "entry_date" date, "source_farm" character varying(150), "status" character varying(20) NOT NULL DEFAULT 'ALIVE', "status_date" date, "status_reason" character varying(500), "notes" character varying(1000), "breed_id" uuid NOT NULL, "color_id" uuid, "dam_id" uuid, "sire_id" uuid, CONSTRAINT "CHK_animals_certificate_file" CHECK (num_nonnulls("certificate_file_key", "certificate_file_name", "certificate_file_mime_type", "certificate_file_size", "certificate_file_uploaded_at") IN (0, 5)), CONSTRAINT "CHK_animals_parents" CHECK ("dam_id" <> "id" AND "sire_id" <> "id"), CONSTRAINT "CHK_animals_weights" CHECK (("birth_weight_kg" IS NULL OR "birth_weight_kg" > 0) AND ("weaning_weight_kg" IS NULL OR ("weaning_weight_kg" > 0 AND "weaning_date" IS NOT NULL))), CONSTRAINT "CHK_animals_dates" CHECK (("weaning_date" IS NULL OR "birth_date" IS NULL OR "weaning_date" >= "birth_date") AND ("entry_date" IS NULL OR "birth_date" IS NULL OR "entry_date" >= "birth_date") AND ("status_date" IS NULL OR "birth_date" IS NULL OR "status_date" >= "birth_date") AND ("status_date" IS NULL OR "entry_date" IS NULL OR "status_date" >= "entry_date")), CONSTRAINT "CHK_animals_status_fields" CHECK (("status" = 'ALIVE' AND "status_date" IS NULL AND "status_reason" IS NULL) OR ("status" <> 'ALIVE' AND "status_date" IS NOT NULL)), CONSTRAINT "CHK_animals_entry" CHECK ("entry_origin" IS NULL OR ("entry_origin" = 'BORN_ON_FARM' AND "birth_date" IS NOT NULL AND "entry_date" IS NULL AND "source_farm" IS NULL) OR ("entry_origin" <> 'BORN_ON_FARM' AND "entry_date" IS NOT NULL)), CONSTRAINT "CHK_animals_external" CHECK (NOT "is_external" OR ("entry_origin" IS NULL AND "entry_date" IS NULL AND "status" = 'ALIVE' AND COALESCE("ear_tag", "name", "absid_registry", "external_registry") IS NOT NULL)), CONSTRAINT "CHK_animals_internal_required" CHECK ("is_external" OR ("ear_tag" IS NOT NULL AND "genetic_category" IS NOT NULL AND "entry_origin" IS NOT NULL)), CONSTRAINT "CHK_animals_genetic_category" CHECK ("genetic_category" IN ('COMMERCIAL', 'BASE', 'G1', 'G2', 'G3', 'G4', 'PO')), CONSTRAINT "CHK_animals_entry_origin" CHECK ("entry_origin" IN ('BORN_ON_FARM', 'PURCHASE', 'DONATION', 'GIFT')), CONSTRAINT "CHK_animals_status" CHECK ("status" IN ('ALIVE', 'DEAD', 'SOLD', 'SLAUGHTERED', 'GIFTED')), CONSTRAINT "CHK_animals_sex" CHECK ("sex" IN ('MALE', 'FEMALE')), CONSTRAINT "CHK_animals_species" CHECK ("species" IN ('SHEEP', 'GOAT')), CONSTRAINT "PK_6154c334bbb19186788468bce5c" PRIMARY KEY ("id"))`,
    );
    // Índices por expresión (nombre único sin distinguir mayúsculas). Escritos a
    // mano: TypeORM no los genera (las entidades los declaran con synchronize: false).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_breeds_species_name_active" ON "breeds" ("species", lower("name")) WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animal_colors_name_active" ON "animal_colors" (lower("name")) WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_animals_inventory" ON "animals"  ("is_external", "status", "species") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_animals_color_id" ON "animals"  ("color_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_animals_breed" ON "animals"  ("breed_id", "species") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_animals_sire_id" ON "animals"  ("sire_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_animals_dam_id" ON "animals"  ("dam_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_animals_absid_registry" ON "animals"  ("absid_registry") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_animals_ear_tag" ON "animals"  ("ear_tag") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animals_ear_tag_absid_registry_active" ON "animals"  ("ear_tag", "absid_registry") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "FK_e7424db727e7846af2a3c784d5e" FOREIGN KEY ("breed_id", "species") REFERENCES "breeds"("id","species") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "FK_d5d86662655ec05e1a5703753a0" FOREIGN KEY ("color_id") REFERENCES "animal_colors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "FK_cfbf8587918a064a57d0a4a4998" FOREIGN KEY ("dam_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" ADD CONSTRAINT "FK_777de5e2413bc5cc1ab8a300cd8" FOREIGN KEY ("sire_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "animals" DROP CONSTRAINT "FK_777de5e2413bc5cc1ab8a300cd8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" DROP CONSTRAINT "FK_cfbf8587918a064a57d0a4a4998"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" DROP CONSTRAINT "FK_d5d86662655ec05e1a5703753a0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animals" DROP CONSTRAINT "FK_e7424db727e7846af2a3c784d5e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_animals_ear_tag_absid_registry_active"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_animals_ear_tag"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_animals_absid_registry"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_animals_dam_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_animals_sire_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_animals_breed"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_animals_color_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_animals_inventory"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_animal_colors_name_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_breeds_species_name_active"`,
    );
    await queryRunner.query(`DROP TABLE "animals"`);
    await queryRunner.query(`DROP TABLE "breeds"`);
    await queryRunner.query(`DROP TABLE "animal_colors"`);
  }
}
