import { EntityManager } from 'typeorm';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AnimalStatus, Sex } from '@modules/animals/domain/enums/animal.enums';
import {
  OPEN_SERVICE_STATUSES,
  ServiceStatus,
} from '../../domain/enums/reproduction.enums';
import { BreedingServiceOrmEntity } from './entities/breeding-service.orm-entity';
import { BreedingServiceMapper } from './mappers/reproduction.mappers';

interface DamRow {
  sex: Sex;
  status: AnimalStatus;
  status_date: string | null;
  status_reason: string | null;
  is_external: boolean;
}

/**
 * Mantiene la monta de una hembra coherente con su estado en el inventario.
 * Se ejecuta en la misma transacción que guarda el cambio de estado:
 *
 *  - Pasa a DEAD: su monta abierta (sin diagnóstico o preñada) se cierra como
 *    DAM_DIED con la fecha y la causa del inventario. Si cambia la fecha o la
 *    causa de una muerte ya registrada, la monta se actualiza.
 *  - Deja de estar DEAD (corrección): la monta DAM_DIED vuelve a su estado
 *    según los diagnósticos, siempre que no haya otra monta abierta.
 *
 * Las reglas son las del modelo (BreedingService.recordDamDeath): si la fecha
 * de muerte es anterior a la monta o a su último diagnóstico, el cambio de
 * estado completo se rechaza.
 */
export async function syncDamDeath(
  manager: EntityManager,
  animalId: string,
  actorId: string,
): Promise<void> {
  const [dam] = await manager.query<DamRow[]>(
    `SELECT sex, status, to_char(status_date, 'YYYY-MM-DD') AS status_date,
            status_reason, is_external
       FROM animals WHERE id = $1`,
    [animalId],
  );
  if (!dam || dam.sex !== Sex.FEMALE || dam.is_external) return;
  const deathDate = dam.status === AnimalStatus.DEAD ? dam.status_date : null;

  const entities = await manager
    .createQueryBuilder(BreedingServiceOrmEntity, 's')
    .innerJoinAndSelect('s.dam', 'dam')
    .innerJoinAndSelect('s.sire', 'sire')
    .leftJoinAndSelect('s.checks', 'checks')
    .where('dam.id = :animalId', { animalId })
    .andWhere('s.status IN (:...statuses)', {
      statuses: deathDate
        ? [...OPEN_SERVICE_STATUSES, ServiceStatus.DAM_DIED]
        : [ServiceStatus.DAM_DIED],
    })
    .getMany();

  const now = new Date();
  for (const entity of entities) {
    const service = BreedingServiceMapper.toDomain(entity);
    if (deathDate) {
      const cause = dam.status_reason;
      const current = service.getDamDeath();
      if (current?.date === deathDate && current.cause === cause) continue;
      if (current) service.cancelDamDeath();
      try {
        service.recordDamDeath({ date: deathDate, cause }, now);
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        throw new DomainError(
          `La hembra tiene una monta abierta del ${service.getServiceDate()}: ${error.message}`,
        );
      }
    } else {
      service.cancelDamDeath();
      if (OPEN_SERVICE_STATUSES.includes(service.getStatus())) {
        const [other] = await manager.query<{ service_date: string }[]>(
          `SELECT to_char(service_date, 'YYYY-MM-DD') AS service_date
             FROM breeding_services
            WHERE dam_id = $1 AND id <> $2 AND deleted_at IS NULL
              AND status IN ('PENDING', 'PREGNANT')
            LIMIT 1`,
          [animalId, service.getId()],
        );
        if (other) {
          throw new DomainError(
            `La monta del ${service.getServiceDate()} quedó cerrada por la muerte de la hembra y no puede reabrirse: la hembra ya tiene otra monta abierta (${other.service_date}).`,
          );
        }
      }
    }
    service.markUpdatedBy(actorId);
    await manager.save(BreedingServiceMapper.toOrm(service));
  }
}
