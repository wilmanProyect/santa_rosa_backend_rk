import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notificaciones y controles:
 *  - notification_settings: una sola fila con los intervalos de los controles,
 *    la hora de la revisión diaria y las claves VAPID de Web Push.
 *  - notifications: avisos de cada usuario (campana).
 *  - push_subscriptions: navegadores que aceptaron recibir notificaciones.
 *  - control_justifications: por qué un destete, control de peso o control
 *    sanitario no se hizo en su fecha, y para cuándo se reprograma.
 *
 * El destete se sigue desde 6 meses antes de esta migración: así no aparecen
 * como atrasados los adultos que se destetaron antes de usar el sistema.
 */
export class Notifications1794729600000 implements MigrationInterface {
  name = 'Notifications1794729600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notification_settings" (
        "id" smallint NOT NULL DEFAULT 1,
        "weighing_interval_months" smallint NOT NULL DEFAULT 3,
        "health_interval_months" smallint NOT NULL DEFAULT 3,
        "weaning_age_months" smallint NOT NULL DEFAULT 3,
        "weaning_tracking_from" date NOT NULL,
        "upcoming_days" smallint NOT NULL DEFAULT 7,
        "run_hour" smallint NOT NULL DEFAULT 6,
        "last_run_on" date,
        "vapid_public_key" character varying(100),
        "vapid_private_key" character varying(100),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by" uuid,
        CONSTRAINT "PK_notification_settings" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_notification_settings_single" CHECK ("id" = 1),
        CONSTRAINT "CHK_notification_settings_values" CHECK (
          "weighing_interval_months" BETWEEN 1 AND 24
          AND "health_interval_months" BETWEEN 1 AND 24
          AND "weaning_age_months" BETWEEN 1 AND 12
          AND "upcoming_days" BETWEEN 1 AND 30
          AND "run_hour" BETWEEN 0 AND 23),
        CONSTRAINT "CHK_notification_settings_vapid" CHECK (
          num_nonnulls("vapid_public_key", "vapid_private_key") IN (0, 2))
      )`);
    await queryRunner.query(
      `INSERT INTO "notification_settings" ("id", "weaning_tracking_from")
       VALUES (1, (now() AT TIME ZONE 'America/La_Paz')::date - interval '6 months')`,
    );

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "type" character varying(30) NOT NULL,
        "title" character varying(150) NOT NULL,
        "body" character varying(500) NOT NULL,
        "target_type" character varying(30),
        "target_id" uuid,
        "target_filter" character varying(30),
        "dedup_key" character varying(200) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "read_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notifications_user_dedup" UNIQUE ("user_id", "dedup_key"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_notifications_type" CHECK ("type" IN ('BIRTH_UPCOMING', 'WEANING_DUE', 'WEIGHING_DUE', 'HEALTH_DUE')),
        CONSTRAINT "CHK_notifications_target" CHECK ("target_type" IS NULL OR "target_type" IN ('BREEDING_SERVICE', 'CONTROLS'))
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("user_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_unread" ON "notifications" ("user_id") WHERE "read_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "push_subscriptions" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "endpoint" character varying(1000) NOT NULL,
        "p256dh" character varying(100) NOT NULL,
        "auth" character varying(50) NOT NULL,
        "user_agent" character varying(300),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_success_at" TIMESTAMP WITH TIME ZONE,
        "failure_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_push_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_push_subscriptions_endpoint" UNIQUE ("endpoint"),
        CONSTRAINT "FK_push_subscriptions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_push_subscriptions_user" ON "push_subscriptions" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "control_justifications" (
        "id" uuid NOT NULL,
        "animal_id" uuid NOT NULL,
        "control_type" character varying(20) NOT NULL,
        "resolved_due_date" date NOT NULL,
        "next_due_date" date,
        "reason" character varying(500) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_control_justifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_control_justifications_animal" FOREIGN KEY ("animal_id")
          REFERENCES "animals"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_control_justifications_type" CHECK ("control_type" IN ('WEANING', 'WEIGHING', 'HEALTH')),
        CONSTRAINT "CHK_control_justifications_next" CHECK (
          ("control_type" = 'WEANING' OR "next_due_date" IS NOT NULL)
          AND ("next_due_date" IS NULL OR "next_due_date" > "resolved_due_date"))
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_control_justifications_lookup" ON "control_justifications" ("animal_id", "control_type", "resolved_due_date", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "control_justifications"`);
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "notification_settings"`);
  }
}
