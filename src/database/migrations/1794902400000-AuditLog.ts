import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registro de actividad: cada alta, modificación y borrado de los datos del
 * sistema, con el usuario que lo hizo y los valores anteriores y nuevos.
 *
 * Lo llenan triggers de PostgreSQL (audit_capture), en la misma transacción que
 * el cambio. El usuario llega por la sesión de PostgreSQL: la API ejecuta
 * set_config('app.actor_id', ...) al tomar una conexión durante una petición
 * (ver src/modules/audit/infrastructure/audit-db-session.ts).
 *
 * Argumentos del trigger:
 *   0: columnas con ids de animales relacionados (para el historial del animal)
 *   1: columnas que no se registran (técnicas o ruido)
 *   2: columnas secretas: se registra que cambiaron, nunca el valor
 *
 * El registro no se puede modificar ni borrar (trigger audit_log_immutable).
 */
const AUDITED: [
  table: string,
  animalCols: string,
  skip: string,
  secret: string,
][] = [
  ['animals', 'id', '', ''],
  [
    'animal_photos',
    'animal_id',
    'object_key,thumbnail_key,checksum_sha256,uploaded_at,uploaded_by,width,height,size_bytes,mime_type,taken_at_source',
    '',
  ],
  ['animal_weighings', 'animal_id', '', ''],
  ['health_records', 'animal_id', '', ''],
  ['genetic_category_changes', 'animal_id', '', ''],
  ['control_justifications', 'animal_id', '', ''],
  ['breeding_services', 'dam_id,sire_id', '', ''],
  ['pregnancy_checks', '', '', ''],
  ['births', 'dam_id,sire_id', '', ''],
  ['birth_offspring', 'animal_id', '', ''],
  ['areas', '', '', ''],
  ['breeds', '', '', ''],
  ['animal_colors', '', '', ''],
  ['veterinary_products', '', '', ''],
  ['roles', '', '', ''],
  ['role_permissions', '', '', ''],
  [
    'users',
    '',
    'failed_login_attempts,locked_until,last_login_at,password_changed_at',
    'password_hash',
  ],
  ['user_roles', '', '', ''],
  ['user_permissions', '', '', ''],
  ['data_reviews', '', '', ''],
  ['data_review_targets', '', '', ''],
  [
    'notification_settings',
    '',
    'last_run_on,vapid_public_key,vapid_private_key',
    '',
  ],
];

export class AuditLog1794902400000 implements MigrationInterface {
  name = 'AuditLog1794902400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id" bigserial PRIMARY KEY,
        "occurred_at" timestamptz NOT NULL DEFAULT now(),
        "actor_id" uuid,
        "request_id" uuid,
        "ip" character varying(64),
        "source" character varying(10) NOT NULL,
        "action" character varying(10) NOT NULL,
        "entity" character varying(63) NOT NULL,
        "record_id" character varying(100),
        "animal_ids" uuid[] NOT NULL DEFAULT '{}',
        "changes" jsonb,
        "event" character varying(40),
        "summary" character varying(300),
        CONSTRAINT "CHK_audit_log_source" CHECK ("source" IN ('API', 'SYSTEM')),
        CONSTRAINT "CHK_audit_log_action" CHECK ("action" IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'EVENT')),
        CONSTRAINT "CHK_audit_log_event" CHECK (("action" = 'EVENT') = ("event" IS NOT NULL))
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_occurred" ON "audit_log" ("occurred_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_actor" ON "audit_log" ("actor_id", "occurred_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_record" ON "audit_log" ("entity", "record_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_request" ON "audit_log" ("request_id") WHERE "request_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_animals" ON "audit_log" USING gin ("animal_ids")`,
    );

    await queryRunner.query(`
      CREATE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        RAISE EXCEPTION 'El registro de actividad no se puede modificar ni borrar';
      END $fn$`);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_audit_log_immutable"
        BEFORE UPDATE OR DELETE ON "audit_log"
        FOR EACH ROW EXECUTE FUNCTION audit_log_immutable()`);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_audit_log_no_truncate"
        BEFORE TRUNCATE ON "audit_log"
        FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable()`);

    await queryRunner.query(`
      CREATE FUNCTION audit_capture() RETURNS trigger LANGUAGE plpgsql AS $fn$
      DECLARE
        animal_cols text[] := coalesce(string_to_array(nullif(TG_ARGV[0], ''), ','), '{}');
        skip_cols text[] := ARRAY['created_at', 'created_by', 'updated_at', 'updated_by', 'deleted_at']
          || coalesce(string_to_array(nullif(TG_ARGV[1], ''), ','), '{}');
        secret_cols text[] := coalesce(string_to_array(nullif(TG_ARGV[2], ''), ','), '{}');
        old_row jsonb;
        new_row jsonb;
        row_data jsonb;
        diff jsonb := '{}'::jsonb;
        k text;
        v_old jsonb;
        v_new jsonb;
        act text;
        ids uuid[] := '{}';
        c text;
        rid text;
        actor text := nullif(current_setting('app.actor_id', true), '');
        req text := nullif(current_setting('app.request_id', true), '');
        src text := coalesce(nullif(current_setting('app.source', true), ''), 'SYSTEM');
      BEGIN
        -- Cargas masivas (importación de planillas): se registran como un solo evento.
        IF current_setting('app.audit_skip', true) = 'on' THEN
          RETURN NULL;
        END IF;

        IF TG_OP = 'INSERT' THEN
          new_row := to_jsonb(NEW); row_data := new_row; act := 'CREATE';
        ELSIF TG_OP = 'DELETE' THEN
          old_row := to_jsonb(OLD); row_data := old_row; act := 'DELETE';
        ELSE
          old_row := to_jsonb(OLD); new_row := to_jsonb(NEW); row_data := new_row;
          act := CASE
            WHEN old_row ? 'deleted_at' AND old_row->>'deleted_at' IS NULL
                 AND new_row->>'deleted_at' IS NOT NULL THEN 'DELETE'
            WHEN old_row ? 'deleted_at' AND old_row->>'deleted_at' IS NOT NULL
                 AND new_row->>'deleted_at' IS NULL THEN 'RESTORE'
            ELSE 'UPDATE' END;
        END IF;

        IF TG_OP = 'UPDATE' THEN
          FOR k, v_new IN SELECT * FROM jsonb_each(new_row) LOOP
            v_old := old_row->k;
            CONTINUE WHEN k = ANY(skip_cols) OR v_old IS NOT DISTINCT FROM v_new;
            diff := diff || jsonb_build_object(k,
              CASE WHEN k = ANY(secret_cols) THEN '["[oculto]", "[oculto]"]'::jsonb
                   ELSE jsonb_build_array(v_old, v_new) END);
          END LOOP;
          -- Solo cambió quién/cuándo (por ejemplo, el paso previo de un borrado lógico).
          IF act = 'UPDATE' AND diff = '{}'::jsonb THEN
            RETURN NULL;
          END IF;
        ELSE
          -- Alta: los datos ingresados. Borrado físico: el registro que se borró.
          FOR k, v_new IN SELECT * FROM jsonb_each(row_data) LOOP
            CONTINUE WHEN k = ANY(skip_cols) OR k = 'id' OR v_new = 'null'::jsonb;
            diff := diff || jsonb_build_object(k,
              CASE WHEN k = ANY(secret_cols) THEN '"[oculto]"'::jsonb ELSE v_new END);
          END LOOP;
        END IF;

        -- Animales relacionados, con los valores nuevos y los anteriores.
        FOREACH c IN ARRAY animal_cols LOOP
          IF row_data->>c IS NOT NULL THEN ids := ids || (row_data->>c)::uuid; END IF;
          IF old_row IS NOT NULL AND old_row->>c IS NOT NULL THEN
            ids := ids || (old_row->>c)::uuid;
          END IF;
        END LOOP;
        IF TG_TABLE_NAME = 'pregnancy_checks' THEN
          ids := ids || ARRAY(SELECT x FROM breeding_services s, LATERAL (VALUES (s.dam_id), (s.sire_id)) v(x)
                              WHERE s.id = (row_data->>'service_id')::uuid AND x IS NOT NULL);
        ELSIF TG_TABLE_NAME = 'birth_offspring' THEN
          ids := ids || ARRAY(SELECT x FROM births b, LATERAL (VALUES (b.dam_id), (b.sire_id)) v(x)
                              WHERE b.id = (row_data->>'birth_id')::uuid AND x IS NOT NULL);
        END IF;
        ids := ARRAY(SELECT DISTINCT unnest(ids));

        -- Tablas sin id propio (role_permissions, user_roles...): la clave compuesta.
        rid := coalesce(row_data->>'id',
          (SELECT string_agg(value, ':' ORDER BY key) FROM jsonb_each_text(row_data)
            WHERE key LIKE '%\\_id' AND value IS NOT NULL));

        INSERT INTO audit_log (actor_id, request_id, ip, source, action, entity, record_id, animal_ids, changes)
        VALUES (actor::uuid, req::uuid, nullif(current_setting('app.ip', true), ''), src, act,
                TG_TABLE_NAME, left(rid, 100), ids, diff);
        RETURN NULL;
      END $fn$`);

    for (const [table, animalCols, skip, secret] of AUDITED) {
      await queryRunner.query(
        `CREATE TRIGGER "TRG_audit_${table}"
           AFTER INSERT OR UPDATE OR DELETE ON "${table}"
           FOR EACH ROW EXECUTE FUNCTION audit_capture('${animalCols}', '${skip}', '${secret}')`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table] of AUDITED) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS "TRG_audit_${table}" ON "${table}"`,
      );
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_capture()`);
    await queryRunner.query(`DROP TABLE "audit_log"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_log_immutable()`);
  }
}
