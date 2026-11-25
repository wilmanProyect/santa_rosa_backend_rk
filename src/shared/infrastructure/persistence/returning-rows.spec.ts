import { returningRows } from './returning-rows';

describe('returningRows', () => {
  it('UPDATE/DELETE: TypeORM devuelve [filas, cantidad]', () => {
    expect(returningRows([[{ id: 'a' }, { id: 'b' }], 2])).toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
    expect(returningRows([[], 0])).toEqual([]);
  });

  it('INSERT/SELECT: devuelve las filas tal cual', () => {
    expect(returningRows([{ id: 'a' }])).toEqual([{ id: 'a' }]);
    expect(returningRows([])).toEqual([]);
    // Dos filas que no son [array, número] no se confunden.
    expect(returningRows([{ id: 'a' }, { id: 'b' }])).toHaveLength(2);
  });
});
