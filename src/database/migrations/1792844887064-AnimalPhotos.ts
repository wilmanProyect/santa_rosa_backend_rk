import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnimalPhotos1792844887064 implements MigrationInterface {
  name = 'AnimalPhotos1792844887064';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "animal_photos" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "object_key" character varying(255) NOT NULL, "thumbnail_key" character varying(255) NOT NULL, "original_file_name" character varying(255) NOT NULL, "mime_type" character varying(50) NOT NULL, "size_bytes" integer NOT NULL, "width" integer NOT NULL, "height" integer NOT NULL, "checksum_sha256" character(64) NOT NULL, "taken_at" date, "taken_at_source" character varying(10), "description" character varying(500), "is_primary" boolean NOT NULL DEFAULT false, "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL, "animal_id" uuid NOT NULL, "uploaded_by" uuid NOT NULL, CONSTRAINT "UQ_820fe9cd8dbfc554e266922b9f7" UNIQUE ("object_key"), CONSTRAINT "UQ_9505c2997f901596a0612e50484" UNIQUE ("thumbnail_key"), CONSTRAINT "CHK_animal_photos_file" CHECK ("size_bytes" > 0 AND "width" > 0 AND "height" > 0 AND "checksum_sha256" ~ '^[0-9a-f]{64}$'), CONSTRAINT "CHK_animal_photos_taken_at" CHECK (("taken_at" IS NULL) = ("taken_at_source" IS NULL)), CONSTRAINT "CHK_animal_photos_taken_at_source" CHECK ("taken_at_source" IN ('USER', 'EXIF')), CONSTRAINT "CHK_animal_photos_mime_type" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')), CONSTRAINT "PK_8295d79ee15bddbf47fba05eed2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animal_photos_animal_checksum" ON "animal_photos"  ("animal_id", "checksum_sha256") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_animal_photos_primary" ON "animal_photos"  ("animal_id") WHERE "is_primary" AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_animal_photos_uploaded_by" ON "animal_photos"  ("uploaded_by") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_animal_photos_animal_id" ON "animal_photos"  ("animal_id", "uploaded_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "animal_photos" ADD CONSTRAINT "FK_eddb917b8cb00a77c574021d41c" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "animal_photos" ADD CONSTRAINT "FK_b46751b2b763203e11cd6108218" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "animal_photos" DROP CONSTRAINT "FK_b46751b2b763203e11cd6108218"`,
    );
    await queryRunner.query(
      `ALTER TABLE "animal_photos" DROP CONSTRAINT "FK_eddb917b8cb00a77c574021d41c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_animal_photos_animal_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_animal_photos_uploaded_by"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_animal_photos_primary"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_animal_photos_animal_checksum"`,
    );
    await queryRunner.query(`DROP TABLE "animal_photos"`);
  }
}
