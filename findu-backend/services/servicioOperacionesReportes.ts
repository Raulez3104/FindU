import type { PoolClient } from 'pg';

import pool = require('../config/database');
import {
  decidirOperacion,
  presentarEstado,
  validarFormaBasicaSolicitud,
  validarVerificacionDevolucion,
} from './reportContract';
import type {
  CandidatoCierreReporte,
  DatosEdicionReporte,
  DetalleEnlaceCierre,
  EstadoPresentado,
  FilaReporte,
  OperacionAdministrativa,
  PerfilAdministrador,
  RespuestaTrazaReporte,
  ResultadoEdicionReporte,
  ResultadoMutacionReporte,
  VerificacionDevolucionA10,
} from '../types/modelos';

interface ParametrosOperacionReporte {
  readonly id: number;
  readonly operacion: OperacionAdministrativa;
  readonly actor: PerfilAdministrador;
  readonly payload?: unknown;
  readonly hoy?: string;
}

function crearErrorConEstado(mensaje: string, status: number): Error & { status: number } {
  const error = new Error(mensaje) as Error & { status: number };
  error.status = status;
  return error;
}

function obtenerA10Valida(detalles: unknown): VerificacionDevolucionA10 | null {
  try {
    return validarVerificacionDevolucion(detalles);
  } catch (error) {
    if (
      error instanceof Error &&
      'status' in error &&
      (error as Error & { status?: number }).status === 400
    ) {
      return null;
    }
    throw error;
  }
}

async function existeUsuarioA10(
  acceso: Pick<PoolClient, 'query'>,
  verificacion: VerificacionDevolucionA10,
): Promise<boolean> {
  if (verificacion.usuario_id === undefined) return true;
  const resultado = await acceso.query('SELECT id FROM usuarios WHERE id = $1', [
    verificacion.usuario_id,
  ]);
  return resultado.rows.length > 0;
}

async function resolverReferenciasContextuales(
  client: PoolClient,
  operacion: OperacionAdministrativa,
  payload: unknown,
  reporte: FilaReporte,
) {
  if (operacion === 'devolucion' && payload && typeof payload === 'object') {
    const uid = (payload as Record<string, unknown>).usuario_id;
    if (typeof uid === 'number') {
      const uRes = await client.query('SELECT id FROM usuarios WHERE id = $1', [uid]);
      if (uRes.rows.length === 0) {
        throw crearErrorConEstado('El usuario especificado no existe', 400);
      }
    }
  }

  if (operacion === 'edicion' && payload && typeof payload === 'object') {
    const datos = payload as Record<string, unknown>;
    const catId = datos.categoria_id;
    if (typeof catId === 'number') {
      const catRes = await client.query('SELECT id, activo FROM categorias WHERE id = $1', [catId]);
      if (catRes.rows.length === 0 || catRes.rows[0].activo !== true) {
        throw crearErrorConEstado('La categoría no existe o está inactiva', 400);
      }
    }

    const campus = typeof datos.campus === 'string' ? datos.campus : reporte.campus;
    const ubiId = datos.ubicacion_id;
    if (typeof ubiId === 'number') {
      const ubiRes = await client.query(
        'SELECT id, activo FROM ubicaciones WHERE id = $1 AND campus = $2',
        [ubiId, campus],
      );
      if (ubiRes.rows.length === 0) {
        throw crearErrorConEstado('La ubicación no existe para el campus indicado', 400);
      }
      if (ubiRes.rows[0].activo !== true) {
        throw crearErrorConEstado('La ubicación está inactiva', 400);
      }
    } else if (typeof datos.campus === 'string' && reporte.ubicacion_id !== null && !datos.ubicacion_otro) {
      const ubiRes = await client.query(
        'SELECT id, activo FROM ubicaciones WHERE id = $1 AND campus = $2',
        [reporte.ubicacion_id, datos.campus],
      );
      if (ubiRes.rows.length === 0) {
        throw crearErrorConEstado('La ubicación actual no corresponde al nuevo campus', 400);
      }
      if (ubiRes.rows[0].activo !== true) {
        throw crearErrorConEstado('La ubicación está inactiva', 400);
      }
    }
  }
}

async function ejecutarOperacionReporte({
  id,
  operacion,
  actor,
  payload,
  hoy,
}: ParametrosOperacionReporte): Promise<
  ResultadoMutacionReporte | ResultadoEdicionReporte
> {
  const payloadNormalizado = validarFormaBasicaSolicitud(operacion, payload, { hoy });

  const client = await pool.connect();
  let transaccionAbierta = false;
  let commitEnviado = false;
  let rollbackIntentado = false;
  try {
    await client.query('BEGIN');
    transaccionAbierta = true;

    let reporte: FilaReporte;
    let contraparteValida: { reporte: FilaReporte; entregaA10Id: number } | null = null;
    let enlaceExistente: { reporte_encontrado_id: number; registro_devolucion_id?: number | null } | null = null;
    let esCierreHistoricoSinEnlace = false;

    if (operacion === 'cierre') {
      const contraparteId = (payloadNormalizado as { reporte_encontrado_id: number }).reporte_encontrado_id;
      const idsABloquear = id === contraparteId ? [id] : [id, contraparteId].sort((a, b) => a - b);

      const resultadoBloqueo = await client.query<FilaReporte>(
        `SELECT id, tipo_reporte, estado, activo, titulo, descripcion, contacto,
                categoria_id, TO_CHAR(fecha_incidente, 'YYYY-MM-DD') AS fecha_incidente,
                campus, ubicacion_id, ubicacion_otro, fecha_creacion
         FROM reportes
         WHERE id = ANY($1::int[])
         ORDER BY id ASC
         FOR UPDATE`,
        [idsABloquear],
      );

      const filaPerdido = resultadoBloqueo.rows.find((r) => r.id === id);
      if (!filaPerdido) {
        throw crearErrorConEstado('Reporte no encontrado', 404);
      }
      reporte = filaPerdido;

      if (reporte.activo === false) {
        throw crearErrorConEstado('No se puede operar sobre un reporte archivado', 409);
      }
      if (reporte.tipo_reporte !== 'perdido') {
        throw crearErrorConEstado('Esta operación solo aplica a reportes perdidos', 400);
      }

      // Consultar si ya tiene enlace de cierre registrado
      const regEnlace = await client.query(`
        SELECT detalles
        FROM registro_administradores
        WHERE tabla_destino = 'reportes'
          AND id_destino = $1
          AND accion = 'cierre_reporte'
        ORDER BY fecha_creacion DESC, id DESC
        LIMIT 1
      `, [id]);

      if (regEnlace.rows.length > 0 && regEnlace.rows[0].detalles) {
        const det = typeof regEnlace.rows[0].detalles === 'string'
          ? JSON.parse(regEnlace.rows[0].detalles)
          : regEnlace.rows[0].detalles;
        enlaceExistente = {
          reporte_encontrado_id: Number(det.reporte_encontrado_id),
          registro_devolucion_id: det.registro_devolucion_id != null ? Number(det.registro_devolucion_id) : null,
        };
      } else if (reporte.estado === 'devuelto') {
        esCierreHistoricoSinEnlace = true;
      }

      // Si el perdido ya está devuelto, resolver según enlace existente o A15
      if (reporte.estado === 'devuelto') {
        if (esCierreHistoricoSinEnlace) {
          rollbackIntentado = true;
          await client.query('ROLLBACK');
          transaccionAbierta = false;
          return {
            cambiado: false,
            id: reporte.id,
            estado: 'Devuelto',
            nota: 'Cierre anterior sin contraparte registrada',
          };
        }
        if (enlaceExistente && enlaceExistente.reporte_encontrado_id === contraparteId) {
          rollbackIntentado = true;
          await client.query('ROLLBACK');
          transaccionAbierta = false;
          return {
            cambiado: false,
            id: reporte.id,
            estado: 'Devuelto',
          };
        }
        if (enlaceExistente && enlaceExistente.reporte_encontrado_id !== contraparteId) {
          throw crearErrorConEstado('El reporte ya se encuentra vinculado a otra contraparte', 409);
        }
      }

      if (reporte.estado !== 'perdido' && reporte.estado !== 'devuelto') {
        throw crearErrorConEstado('Transición de estado inválida', 400);
      }

      // Solo si el perdido sigue en 'perdido', validar contextualmente la contraparte
      if (reporte.estado === 'perdido') {
        const filaContraparte = resultadoBloqueo.rows.find((r) => r.id === contraparteId);
        if (!filaContraparte) {
          throw crearErrorConEstado('La contraparte no existe o no es válida', 400);
        }
        if (filaContraparte.tipo_reporte !== 'encontrado') {
          throw crearErrorConEstado('La contraparte debe ser un reporte de tipo encontrado', 400);
        }
        if (filaContraparte.estado !== 'devuelto') {
          throw crearErrorConEstado('La contraparte debe estar en estado devuelto', 400);
        }

        const regA10 = await client.query(`
          SELECT id, detalles
          FROM registro_administradores
          WHERE tabla_destino = 'reportes'
            AND id_destino = $1
            AND accion = 'devolucion_reporte'
          ORDER BY id ASC
          LIMIT 1
        `, [contraparteId]);

        const entregaOriginal = regA10.rows[0];
        const verificacionA10 = entregaOriginal
          ? obtenerA10Valida(entregaOriginal.detalles)
          : null;
        if (
          !verificacionA10 ||
          !(await existeUsuarioA10(client, verificacionA10))
        ) {
          throw crearErrorConEstado(
            'La contraparte no cuenta con una entrega A10 válida registrada',
            400,
          );
        }

        const regUsoPrevio = await client.query(`
          SELECT id_destino
          FROM registro_administradores
          WHERE tabla_destino = 'reportes'
            AND accion = 'cierre_reporte'
            AND (detalles->>'reporte_encontrado_id')::int = $1
          LIMIT 1
        `, [contraparteId]);

        if (regUsoPrevio.rows.length > 0) {
          throw crearErrorConEstado('La contraparte seleccionada ya fue utilizada para cerrar otro reporte', 409);
        }

        contraparteValida = {
          reporte: filaContraparte,
          entregaA10Id: Number(entregaOriginal.id),
        };
      }
    } else {
      const resultadoBloqueo = await client.query<FilaReporte>(
        `SELECT id, tipo_reporte, estado, activo, titulo, descripcion, contacto,
                categoria_id, TO_CHAR(fecha_incidente, 'YYYY-MM-DD') AS fecha_incidente,
                campus, ubicacion_id, ubicacion_otro, fecha_creacion
         FROM reportes
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );

      if (resultadoBloqueo.rows.length === 0) {
        throw crearErrorConEstado('Reporte no encontrado', 404);
      }
      reporte = resultadoBloqueo.rows[0];

      if (
        reporte.activo === false &&
        ['recepcion', 'devolucion', 'donacion', 'edicion'].includes(operacion)
      ) {
        throw crearErrorConEstado('No se puede operar sobre un reporte archivado', 409);
      }

      await resolverReferenciasContextuales(client, operacion, payloadNormalizado, reporte);
    }

    const decision = decidirOperacion({
      operacion,
      reporte,
      actor,
      payload: payloadNormalizado,
      hoy,
      enlaceExistente,
      esCierreHistoricoSinEnlace,
      contraparteValida,
    });

    if (decision.tipo === 'error') {
      throw crearErrorConEstado(decision.message, decision.status);
    }

    if (decision.tipo === 'sin_efecto') {
      rollbackIntentado = true;
      await client.query('ROLLBACK');
      transaccionAbierta = false;
      return decision.respuesta;
    }

    // Aplicar mutación
    const clavesCambios = Object.keys(decision.cambios) as (keyof FilaReporte)[];
    if (clavesCambios.length > 0) {
      const fragmentosSet: string[] = [];
      const valores: unknown[] = [];
      let indice = 1;

      for (const clave of clavesCambios) {
        fragmentosSet.push(`${clave} = $${indice++}`);
        valores.push(decision.cambios[clave]);
      }
      valores.push(id);

      const queryUpdate = `UPDATE reportes SET ${fragmentosSet.join(', ')} WHERE id = $${indice}`;
      const resUpdate = await client.query(queryUpdate, valores);
      if (resUpdate.rowCount === 0) {
        throw crearErrorConEstado('Error al actualizar el reporte', 500);
      }
    }

    // Insertar filas en historial
    for (const item of decision.historial) {
      await client.query(
        `INSERT INTO historial (reporte_id, accion, valor_anterior, valor_nuevo, realizado_por, tipo_realizado_por)
         VALUES ($1, $2, $3, $4, $5, 'admin')`,
        [id, item.accion, item.valor_anterior, item.valor_nuevo, actor.id],
      );
    }

    // Insertar en registro_administradores
    await client.query(
      `INSERT INTO registro_administradores (administrador_id, accion, tabla_destino, id_destino, detalles)
       VALUES ($1, $2, 'reportes', $3, $4)`,
      [
        actor.id,
        decision.auditoria.accion,
        id,
        decision.auditoria.detalles ? JSON.stringify(decision.auditoria.detalles) : null,
      ],
    );

    commitEnviado = true;
    await client.query('COMMIT');
    transaccionAbierta = false;

    if (operacion === 'edicion') {
      return { actualizado: true, id };
    }

    if (operacion === 'archivo' || operacion === 'reactivacion') {
      return {
        cambiado: true,
        id,
        activo: decision.cambios.activo!,
      };
    }

    return {
      cambiado: true,
      id,
      estado: presentarEstado(decision.cambios.estado)! as EstadoPresentado,
    };
  } catch (error) {
    if (transaccionAbierta && !commitEnviado && !rollbackIntentado) {
      rollbackIntentado = true;
      try {
        await client.query('ROLLBACK');
        transaccionAbierta = false;
      } catch (_errorRollback: unknown) {
        // Ignorar fallo de rollback si la conexión cayó
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

function proyectarVerificacionA10(detalles: unknown): VerificacionDevolucionA10 | null {
  if (!detalles || typeof detalles !== 'object') return null;
  const d = detalles as Record<string, unknown>;
  if (typeof d.nombre_receptor !== 'string' || typeof d.referencia_comprobante !== 'string') {
    return null;
  }
  const resultado: {
    nombre_receptor: string;
    referencia_comprobante: string;
    observacion?: string;
    usuario_id?: number;
  } = {
    nombre_receptor: d.nombre_receptor,
    referencia_comprobante: d.referencia_comprobante,
  };
  if (typeof d.observacion === 'string' && d.observacion.trim() !== '') {
    resultado.observacion = d.observacion.trim();
  }
  if (typeof d.usuario_id === 'number' && Number.isInteger(d.usuario_id)) {
    resultado.usuario_id = d.usuario_id;
  }
  return resultado;
}

async function consultarTrazaReporte(id: number): Promise<RespuestaTrazaReporte> {
  const client = await pool.connect();
  try {
    const reporteRes = await client.query(
      'SELECT id, tipo_reporte, estado FROM reportes WHERE id = $1',
      [id],
    );
    if (reporteRes.rows.length === 0) {
      throw crearErrorConEstado('Reporte no encontrado', 404);
    }
    const reporte = reporteRes.rows[0];

    const histRes = await client.query(`
      SELECT h.id, h.accion, h.valor_anterior, h.valor_nuevo, h.realizado_por,
             h.tipo_realizado_por,
             COALESCE(a.nombre, u.nombre, 'Sistema') AS realizado_por_nombre,
             TO_CHAR(h.fecha_creacion AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD HH24:MI') AS fecha
      FROM historial h
      LEFT JOIN administradores a ON h.tipo_realizado_por = 'admin' AND h.realizado_por = a.id
      LEFT JOIN usuarios u ON h.tipo_realizado_por = 'usuario' AND h.realizado_por = u.id
      WHERE h.reporte_id = $1
      ORDER BY h.fecha_creacion ASC, h.id ASC
    `, [id]);

    const regRes = await client.query(`
      SELECT detalles
      FROM registro_administradores
      WHERE tabla_destino = 'reportes' AND id_destino = $1 AND accion = 'devolucion_reporte'
      ORDER BY fecha_creacion DESC, id DESC
      LIMIT 1
    `, [id]);

    const verificacionDevolucion = regRes.rows.length > 0 && regRes.rows[0].detalles
      ? proyectarVerificacionA10(
          typeof regRes.rows[0].detalles === 'string'
            ? JSON.parse(regRes.rows[0].detalles)
            : regRes.rows[0].detalles,
        )
      : null;

    let enlaceCierre: DetalleEnlaceCierre | null = null;
    let notaCierreHistorico: string | null = null;

    if (reporte.tipo_reporte === 'perdido') {
      const regCierre = await client.query(`
        SELECT detalles
        FROM registro_administradores
        WHERE tabla_destino = 'reportes' AND id_destino = $1 AND accion = 'cierre_reporte'
        ORDER BY fecha_creacion DESC, id DESC
        LIMIT 1
      `, [id]);

      if (regCierre.rows.length > 0 && regCierre.rows[0].detalles) {
        const detCierre = typeof regCierre.rows[0].detalles === 'string'
          ? JSON.parse(regCierre.rows[0].detalles)
          : regCierre.rows[0].detalles;
        const encontradoId = Number(detCierre.reporte_encontrado_id);
        const registroDevId = detCierre.registro_devolucion_id != null ? Number(detCierre.registro_devolucion_id) : null;

        let entregaOriginal: VerificacionDevolucionA10 | null = null;
        if (registroDevId) {
          const regEntrega = await client.query(
            `SELECT detalles
             FROM registro_administradores
             WHERE id = $1
               AND tabla_destino = 'reportes'
               AND id_destino = $2
               AND accion = 'devolucion_reporte'`,
            [registroDevId, encontradoId],
          );
          if (regEntrega.rows.length > 0 && regEntrega.rows[0].detalles) {
            entregaOriginal = proyectarVerificacionA10(
              typeof regEntrega.rows[0].detalles === 'string'
                ? JSON.parse(regEntrega.rows[0].detalles)
                : regEntrega.rows[0].detalles,
            );
          }
        }

        enlaceCierre = {
          reporte_encontrado_id: encontradoId,
          entrega_original: entregaOriginal,
        };
      } else if (reporte.estado === 'devuelto') {
        notaCierreHistorico = 'Cierre anterior sin contraparte registrada';
      }
    }

    return {
      historial: histRes.rows,
      verificacion_devolucion: verificacionDevolucion,
      enlace_cierre: enlaceCierre,
      nota_cierre_historico: notaCierreHistorico,
    };
  } finally {
    client.release();
  }
}

async function consultarCandidatosCierre(
  id: number,
  busqueda?: string,
): Promise<readonly CandidatoCierreReporte[]> {
  const reporteRes = await pool.query('SELECT id FROM reportes WHERE id = $1', [id]);
  if (reporteRes.rows.length === 0) {
    throw crearErrorConEstado('Reporte no encontrado', 404);
  }

  const valoresParams: unknown[] = [];
  let condicionBusqueda = '';

  if (typeof busqueda === 'string' && busqueda.trim() !== '') {
    const texto = busqueda.trim();
    if (/^\d+$/.test(texto) && Number(texto) <= 2147483647) {
      valoresParams.push(Number(texto));
      valoresParams.push(`%${texto}%`);
      condicionBusqueda = `AND (r.id = $1 OR r.titulo ILIKE $2)`;
    } else {
      valoresParams.push(`%${texto}%`);
      condicionBusqueda = `AND r.titulo ILIKE $1`;
    }
  }

  const sql = `
    SELECT r.id,
           r.titulo,
           r.estado,
           TO_CHAR(r.fecha_creacion, 'YYYY-MM-DD HH24:MI') AS fecha,
           r.campus,
           COALESCE(u.nombre, r.ubicacion_otro) AS ubicacion,
           entrega_original.id AS registro_devolucion_id,
           entrega_original.detalles AS detalles_entrega,
           (r.activo = false) AS archivado,
           EXISTS (
             SELECT 1
             FROM registro_administradores ra2
             WHERE ra2.tabla_destino = 'reportes'
               AND ra2.accion = 'cierre_reporte'
               AND (ra2.detalles->>'reporte_encontrado_id')::int = r.id
           ) AS usado
    FROM reportes r
    LEFT JOIN ubicaciones u ON r.ubicacion_id = u.id
    JOIN LATERAL (
      SELECT ra.id, ra.detalles
      FROM registro_administradores ra
      WHERE ra.tabla_destino = 'reportes'
        AND ra.id_destino = r.id
        AND ra.accion = 'devolucion_reporte'
      ORDER BY ra.id ASC
      LIMIT 1
    ) entrega_original ON TRUE
    WHERE r.tipo_reporte = 'encontrado'
      AND r.estado = 'devuelto'
      ${condicionBusqueda}
    ORDER BY r.id DESC
  `;

  const resultado = await pool.query(sql, valoresParams);

  const filasConA10Valida = resultado.rows.flatMap((fila: Record<string, unknown>) => {
    const verificacion = obtenerA10Valida(fila.detalles_entrega);
    return verificacion ? [{ fila, verificacion }] : [];
  });
  const usuariosReferenciados = [
    ...new Set(
      filasConA10Valida.flatMap(({ verificacion }) =>
        verificacion.usuario_id === undefined ? [] : [verificacion.usuario_id],
      ),
    ),
  ];
  const usuariosExistentes = new Set<number>();
  if (usuariosReferenciados.length > 0) {
    const resultadoUsuarios = await pool.query(
      'SELECT id FROM usuarios WHERE id = ANY($1::int[])',
      [usuariosReferenciados],
    );
    for (const fila of resultadoUsuarios.rows) {
      usuariosExistentes.add(Number(fila.id));
    }
  }

  return filasConA10Valida
    .filter(({ verificacion }) =>
      verificacion.usuario_id === undefined || usuariosExistentes.has(verificacion.usuario_id),
    )
    .map(({ fila }) => ({
      id: Number(fila.id),
      titulo: String(fila.titulo),
      estado: 'Devuelto' as const,
      fecha: String(fila.fecha),
      campus: String(fila.campus),
      ubicacion: fila.ubicacion ? String(fila.ubicacion) : null,
      archivado: Boolean(fila.archivado),
      usado: Boolean(fila.usado),
    }));
}

export { ejecutarOperacionReporte, consultarTrazaReporte, consultarCandidatosCierre };
