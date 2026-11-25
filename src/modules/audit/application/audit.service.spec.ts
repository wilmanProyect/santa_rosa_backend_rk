import { collectIds } from './audit.service';
import { AuditAction, AuditEntry, AuditSource } from '../domain/audit.types';

const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: '1',
  occurredAt: new Date(),
  actorId: null,
  actorUsername: null,
  actorFullName: null,
  requestId: null,
  ip: null,
  source: AuditSource.API,
  action: AuditAction.UPDATE,
  entity: 'animals',
  recordId: null,
  animalIds: [],
  changes: null,
  event: null,
  summary: null,
  ...over,
});

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('collectIds', () => {
  it('junta los ids de animales, del registro y de los valores cambiados', () => {
    const ids = collectIds([
      entry({
        recordId: A,
        animalIds: [A],
        changes: { breed_id: [B, C], notes: ['a', 'b'], weight_kg: [1, 2] },
      }),
      entry({ recordId: 'role:perm', changes: { dam_id: B.toUpperCase() } }),
    ]);
    expect(ids.sort()).toEqual([A, B, C]);
  });

  it('sin cambios ni ids devuelve una lista vacía', () => {
    expect(collectIds([entry({})])).toEqual([]);
  });
});
