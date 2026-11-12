import {
  REPORTE_H6A_ID,
  validarLecturaAptaH6a,
  validarOperadorH6a,
  validarPrimeraVerificacionH6a,
  validarRespuestaRecepcionH6a,
  validarVerificacionFinalH6a,
} from './helpers/h6aSecuencial';
import {
  ejecutarArnesH6aSecuencial,
  resolverModoH6aSecuencial,
  type DependenciasH6aSecuencial,
} from './manual/h6aSecuencial';

const lineaBase = {
  id: REPORTE_H6A_ID,
  tipo_reporte: 'encontrado' as const,
  estado: 'encontrado' as const,
  activo: true as const,
  historial_recepcion: 3,
  auditoria_recepcion: 2,
};

const primeraLectura = {
  ...lineaBase,
  estado: 'en_servicios' as const,
  historial_recepcion: 4,
  auditoria_recepcion: 3,
  historial_nuevo: [
    {
      id: 31,
      reporte_id: REPORTE_H6A_ID,
      accion: 'recepcion' as const,
      valor_anterior: 'encontrado' as const,
      valor_nuevo: 'en_servicios' as const,
    },
  ],
  auditoria_nueva: [
    {
      id: 41,
      administrador_id: 7,
      accion: 'recepcion_reporte' as const,
      tabla_destino: 'reportes' as const,
      id_destino: REPORTE_H6A_ID,
    },
  ],
};

const respuesta = (cambiado: boolean) => ({
  tipo: 'confirmada' as const,
  status: 200,
  cuerpo: {
    cambiado,
    id: REPORTE_H6A_ID,
    estado: 'En servicios',
  },
});

describe('T10-1: validadores puros del verificador secuencial H6a', () => {
  test('acepta la lectura mínima apta de #12752 y conserva baselines no nulos', () => {
    expect(validarLecturaAptaH6a(lineaBase)).toEqual(lineaBase);
  });

  test.each([
    ['otro ID', { ...lineaBase, id: 11994 }],
    ['tipo distinto', { ...lineaBase, tipo_reporte: 'perdido' }],
    ['estado distinto', { ...lineaBase, estado: 'en_servicios' }],
    ['activo no booleano verdadero', { ...lineaBase, activo: null }],
    ['conteo negativo', { ...lineaBase, historial_recepcion: -1 }],
    ['dato adicional', { ...lineaBase, contacto: 'dato no permitido' }],
  ])('rechaza una lectura inválida: %s', (_caso, lectura) => {
    expect(() => validarLecturaAptaH6a(lectura)).toThrow();
  });

  test('acepta solo un operador mutante con ID positivo', () => {
    expect(validarOperadorH6a({ actor_id: 7, rol: 'admin' })).toEqual({
      actor_id: 7,
      rol: 'admin',
    });
    expect(() => validarOperadorH6a({ actor_id: 7, rol: 'superadmin' })).toThrow(
      'rol mutante',
    );
  });

  test('exige respuestas confirmadas y ordenadas true→false con forma exacta', () => {
    expect(validarRespuestaRecepcionH6a(respuesta(true), true).cambiado).toBe(true);
    expect(validarRespuestaRecepcionH6a(respuesta(false), false).cambiado).toBe(false);
    expect(() =>
      validarRespuestaRecepcionH6a({ tipo: 'incierta' }, true),
    ).toThrow('incierta');
    expect(() => validarRespuestaRecepcionH6a(respuesta(false), true)).toThrow();
    expect(() =>
      validarRespuestaRecepcionH6a(
        {
          ...respuesta(true),
          cuerpo: { ...respuesta(true).cuerpo, token: 'no permitido' },
        },
        true,
      ),
    ).toThrow('forma inválida');
  });

  test('acredita estado final, deltas +1/+1 y actor de la fila nueva', () => {
    const primera = validarPrimeraVerificacionH6a(lineaBase, primeraLectura, 7);
    expect(primera.historial_recepcion).toBe(4);
    expect(primera.auditoria_nueva[0].administrador_id).toBe(7);
  });

  test('rechaza deltas contra cero, filas ajenas y actor distinto', () => {
    expect(() =>
      validarPrimeraVerificacionH6a(
        lineaBase,
        { ...primeraLectura, historial_recepcion: 1 },
        7,
      ),
    ).toThrow('deltas exactos');
    expect(() =>
      validarPrimeraVerificacionH6a(
        lineaBase,
        {
          ...primeraLectura,
          auditoria_nueva: [
            { ...primeraLectura.auditoria_nueva[0], administrador_id: 8 },
          ],
        },
        7,
      ),
    ).toThrow('actor y destino');
  });

  test('el segundo POST conserva conteos y las mismas filas nuevas', () => {
    const primera = validarPrimeraVerificacionH6a(lineaBase, primeraLectura, 7);
    expect(validarVerificacionFinalH6a(primera, primeraLectura, 7)).toEqual(primera);
    expect(() =>
      validarVerificacionFinalH6a(
        primera,
        { ...primeraLectura, auditoria_recepcion: 4 },
        7,
      ),
    ).toThrow('produjo escrituras');
  });
});

describe('T10-1: arnés manual opt-in sin I/O propio', () => {
  test('la importación y ejecución sin flags no invocan dependencias', async () => {
    const preparar = jest.fn();
    const enviarRecepcion = jest.fn();
    const leerVerificacion = jest.fn();

    await expect(
      ejecutarArnesH6aSecuencial([], {
        preparar,
        enviarRecepcion,
        leerVerificacion,
      }),
    ).resolves.toEqual({ estado: 'inactivo' });
    expect(preparar).not.toHaveBeenCalled();
    expect(enviarRecepcion).not.toHaveBeenCalled();
    expect(leerVerificacion).not.toHaveBeenCalled();
  });

  test('solo los flags exactos habilitan ensayo o ejecución secuencial', () => {
    expect(resolverModoH6aSecuencial(['--ensayo'])).toBe('ensayo');
    expect(resolverModoH6aSecuencial(['--ensayo', '--ejecutar'])).toBe('ejecucion');
    expect(() => resolverModoH6aSecuencial(['--ejecutar'])).toThrow('doble opt-in');
    expect(() => resolverModoH6aSecuencial(['--reporte=11994'])).toThrow(
      'Argumento no admitido',
    );
  });

  test('ejecuta await true→lectura→false→lectura sin concurrencia ni reintentos', async () => {
    const orden: string[] = [];
    const dependencias: DependenciasH6aSecuencial = {
      preparar: async () => {
        orden.push('preparar');
        return { operador: { actor_id: 7, rol: 'admin' }, lineaBase };
      },
      enviarRecepcion: async () => {
        orden.push('post');
        return respuesta(orden.filter((paso) => paso === 'post').length === 1);
      },
      leerVerificacion: async () => {
        orden.push('lectura');
        return primeraLectura;
      },
    };

    await expect(
      ejecutarArnesH6aSecuencial(['--ensayo', '--ejecutar'], dependencias),
    ).resolves.toMatchObject({ estado: 'secuencia_acreditada' });
    expect(orden).toEqual(['preparar', 'post', 'lectura', 'post', 'lectura']);
  });

  test('una respuesta incierta detiene sin lectura ni segundo POST', async () => {
    const enviarRecepcion = jest.fn().mockResolvedValue({ tipo: 'incierta' });
    const leerVerificacion = jest.fn();
    const dependencias: DependenciasH6aSecuencial = {
      preparar: async () => ({
        operador: { actor_id: 7, rol: 'personal_servicios' },
        lineaBase,
      }),
      enviarRecepcion,
      leerVerificacion,
    };

    await expect(
      ejecutarArnesH6aSecuencial(['--ensayo', '--ejecutar'], dependencias),
    ).resolves.toEqual({ estado: 'stop_respuesta_incierta' });
    expect(enviarRecepcion).toHaveBeenCalledTimes(1);
    expect(leerVerificacion).not.toHaveBeenCalled();
  });

  test('un fallo de lectura tras true informa mutación confirmada sin repetir POST', async () => {
    const enviarRecepcion = jest.fn().mockResolvedValue(respuesta(true));
    const dependencias: DependenciasH6aSecuencial = {
      preparar: async () => ({
        operador: { actor_id: 7, rol: 'admin' },
        lineaBase,
      }),
      enviarRecepcion,
      leerVerificacion: async () => {
        throw new Error('lectura fallida');
      },
    };

    await expect(
      ejecutarArnesH6aSecuencial(['--ensayo', '--ejecutar'], dependencias),
    ).resolves.toEqual({
      estado: 'mutacion_confirmada_actualizacion_no_acreditada',
    });
    expect(enviarRecepcion).toHaveBeenCalledTimes(1);
  });
});
