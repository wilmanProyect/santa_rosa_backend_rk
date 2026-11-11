import { MigrationInterface, QueryRunner } from 'typeorm';

export class DataReviews1794422956697 implements MigrationInterface {
  name = 'DataReviews1794422956697';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "data_reviews" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL, "category" character varying(20) NOT NULL, "message" character varying(1000) NOT NULL, "source" character varying(150), "status" character varying(20) NOT NULL, "resolution" character varying(1000), "resolved_at" TIMESTAMP WITH TIME ZONE, "resolved_by" uuid, CONSTRAINT "CHK_data_reviews_resolution" CHECK (("status" = 'RESOLVED') = ("resolved_at" IS NOT NULL AND "resolution" IS NOT NULL)), CONSTRAINT "CHK_data_reviews_category" CHECK ("category" IN ('PARENTAGE', 'MISSING_RECORD', 'DATES', 'IDENTIFIER', 'OTHER')), CONSTRAINT "CHK_data_reviews_status" CHECK ("status" IN ('OPEN', 'RESOLVED')), CONSTRAINT "PK_3bb4feb05e40185dad1e71737b1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_data_reviews_status" ON "data_reviews"  ("status", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "data_review_targets" ("id" uuid NOT NULL, "entity_type" character varying(20) NOT NULL, "entity_id" uuid NOT NULL, "role" character varying(60), "position" smallint NOT NULL, "review_id" uuid NOT NULL, CONSTRAINT "CHK_data_review_targets_type" CHECK ("entity_type" IN ('ANIMAL', 'BIRTH', 'BREEDING_SERVICE')), CONSTRAINT "PK_eccea31d216cd4e5ad567252a7c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_data_review_targets" ON "data_review_targets"  ("review_id", "entity_type", "entity_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_data_review_targets_entity" ON "data_review_targets"  ("entity_type", "entity_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "data_review_targets" ADD CONSTRAINT "FK_1100e1f4d66a496d30dc3c988f3" FOREIGN KEY ("review_id") REFERENCES "data_reviews"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "data_review_targets" DROP CONSTRAINT "FK_1100e1f4d66a496d30dc3c988f3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_data_review_targets_entity"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_data_review_targets"`);
    await queryRunner.query(`DROP TABLE "data_review_targets"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_data_reviews_status"`);
    await queryRunner.query(`DROP TABLE "data_reviews"`);
  }
}
