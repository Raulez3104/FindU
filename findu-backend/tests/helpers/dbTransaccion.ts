import type { PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';
import pool = require('../../config/database');

type AccesoTransaccional = Pick<PoolClient, 'query' | 'release'>;
type Comprobacion<T> = (acceso: AccesoTransaccional) => T | Promise<T>;

// Solo pruebas secuenciales (--runInBand). Nunca permite que un COMMIT del
// servicio confirme la transacción exterior: sus transacciones son savepoints.
async function conTransaccionPrueba<T>(comprobar: Comprobacion<T>): Promise<T> {
  const queryOriginal = pool.query;
  const connectOriginal = pool.connect;
  const client = await pool.connect();
  let iniciada = false;
  let siguiente = 0;
  try {
    await client.query('BEGIN');
    iniciada = true;
    const envoltorio = (): AccesoTransaccional => {
      const savepoints: string[] = [];
      const ejecutarConsulta = async (
        sql: string | QueryConfig<unknown[]>,
        valores?: unknown[],
      ): Promise<QueryResult<QueryResultRow> | undefined> => {
        const comando = typeof sql === 'string' ? sql.trim().replace(/;$/, '').toUpperCase() : '';
        if (comando === 'BEGIN') {
          const nombre = `prueba_${++siguiente}`;
          await client.query(`SAVEPOINT ${nombre}`);
          savepoints.push(nombre);
          return undefined;
        }
        if (comando === 'COMMIT' || comando === 'ROLLBACK') {
          const nombre = savepoints.pop();
          if (!nombre) throw new Error('Transacción interna sin BEGIN');
          if (comando === 'ROLLBACK') await client.query(`ROLLBACK TO SAVEPOINT ${nombre}`);
          return client.query(`RELEASE SAVEPOINT ${nombre}`);
        }
        return client.query(sql, valores);
      };

      // Mock deliberado: el backend solo usa la variante Promise de query; el cast
      // conserva las sobrecargas de pg sin introducir un tipo inseguro.
      const query = ejecutarConsulta as unknown as PoolClient['query'];
      return {
        query,
        release() {},
      };
    };
    const accesoPool = envoltorio();
    Reflect.set(pool, 'query', accesoPool.query);
    Reflect.set(pool, 'connect', async () => envoltorio());
    // El callback recibe el mismo acceso protegido que las consultas del pool.
    return await comprobar(accesoPool);
  } finally {
    Reflect.set(pool, 'query', queryOriginal);
    Reflect.set(pool, 'connect', connectOriginal);
    try {
      if (iniciada) await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
}

export { conTransaccionPrueba };
