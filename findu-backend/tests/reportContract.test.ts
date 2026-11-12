import * as reportContract from '../services/reportContract';
import * as roleMiddleware from '../middleware/roleMiddleware';
import type {
  AutorReporte,
  EstadoReporte,
  FilaReporte,
  OperacionAdministrativa,
  PerfilAdministrador,
  RolAdministrativo,
  TipoAutor,
  TipoReporte,
} from '../types/modelos';

const {
  validarIdAlta,
  textoObligatorio,
  normalizarEntrada,
  resolverTipoEstado,
  validarFechaIncidente,
  presentarEstado,
  resolverFormaUbicacion,
  resolverUbicacionPorNombre,
  esTransicionValida,
  formatearEstadisticas,
  validarVerificacionDevolucion,
  validarFormaEdicion,
  obtenerDiferenciasEdicion,
  validarFormaBasicaSolicitud,
  decidirOperacion,
} = reportContract as any;

const {
  ROLES_POR_OPERACION,
  esRolAutorizadoParaOperacion,
  crearAutorizadorPorOperacion,
  autorizarAltaReporte,
  autorizarRecepcionReporte,
  autorizarDevolucionReporte,
  autorizarCierreReporte,
  autorizarDonacionReporte,
  autorizarEdicionReporte,
  autorizarArchivoReporte,
  autorizarReactivacionReporte,
} = roleMiddleware as any;

const esperar400 = (ejecutar: () => unknown) => {
  expect(ejecutar).toThrow();
  try {
    ejecutar();
  } catch (error) {
    const errorRecibido = error as Error;
    expect(errorRecibido.status).toBe(400);
    expect(errorRecibido.message).toEqual(expect.any(String));
    expect(errorRecibido.message.length).toBeGreaterThan(0);
  }
};

describe('T3 correctiva: límites PostgreSQL del contrato', () => {
  test.each(['usuario_id', 'autor.id', 'categoria_id', 'ubicacion_id'])('%s usa extremos INTEGER sin limitar a safeInteger', (campo) => {
    for (const valor of [1, '1', 2147483647, '2147483647']) expect(validarIdAlta(valor, campo)).toBe(Number(valor));
    for (const valor of [0, -1, 2147483648, '2147483648', Number.MAX_SAFE_INTEGER]) esperar400(() => validarIdAlta(valor, campo));
  });
  test('no cuenta grafemas: los caracteres combinantes cuentan por separado como en PostgreSQL', () => {
    const texto = 'e\u0301'.repeat(127) + 'e';
    expect(textoObligatorio(texto, 'titulo', 255)).toBe(texto);
    esperar400(() => textoObligatorio(texto + '\u0301', 'titulo', 255));
  });
  test.each([2147483648, '2147483648', Number.MAX_SAFE_INTEGER])('rechaza ID fuera de INTEGER: %p', (valor) => {
    esperar400(() => resolverFormaUbicacion({ campus: 'principal', ubicacion_id: valor }));
  });
  test.each([1, '2147483647'])('ubicacion_id admite extremo %p', (valor) => {
    expect((resolverFormaUbicacion({ campus: 'principal', ubicacion_id: valor }) as { ubicacion_id: number }).ubicacion_id).toBe(Number(valor));
  });
  test.each(['á', '😀'])('longitudes por caracteres, no bytes ni UTF-16: %s', (caracter) => {
    expect(resolverFormaUbicacion({ campus: caracter.repeat(50), ubicacion_otro: caracter.repeat(255) }))
      .toMatchObject({ campus: caracter.repeat(50), ubicacion_otro: caracter.repeat(255) });
    esperar400(() => resolverFormaUbicacion({ campus: caracter.repeat(51), ubicacion_otro: 'Patio' }));
    esperar400(() => resolverFormaUbicacion({ campus: 'principal', ubicacion_otro: caracter.repeat(256) }));
    esperar400(() => resolverUbicacionPorNombre(caracter.repeat(256), []));
    expect(resolverUbicacionPorNombre(caracter.repeat(255), []).ubicacion_otro).toBe(caracter.repeat(255));
  });
});

describe('Contrato canónico del alta autenticada (RF-9, RF-10)', () => {
  test('conserva las claves españolas autorizadas sin modificar la entrada', () => {
    const datos = Object.freeze({
      tipo_reporte: 'perdido', titulo: 'Carnet',
      descripcion: 'Azul', contacto: 'Contacto de prueba', categoria_id: '2',
      fecha_incidente: '2026-10-22', campus: 'principal', ubicacion_id: '3',
      ubicacion_otro: 'Patio', estado: 'perdido',
    });
    // T1 solo valida las claves; la exclusividad de ubicación corresponde a T2.
    expect(normalizarEntrada(datos)).toEqual({ ...datos });
    expect(datos.titulo).toBe('Carnet');
  });

  test.each(['usuario_id', 'user_id', 'administrador_id', 'ubicacion'])(
    'rechaza la clave retirada %s con un mensaje específico',
    (clave) => {
      expect(() => normalizarEntrada({ [clave]: '7' })).toThrow(`Campo retirado del alta: ${clave}`);
      esperar400(() => normalizarEntrada({ [clave]: '7' }));
    },
  );

  test('no acepta ubicación por nombre ni siquiera junto con una forma vigente', () => {
    esperar400(() => normalizarEntrada({ ubicacion_id: '3', ubicacion: 'Biblioteca' }));
  });

  test.each([
    'title', 'description', 'location', 'contact', 'status', 'category_id',
    'incident_date', 'report_type', 'is_active', 'desconocido',
    'image', 'constructor',
  ])('rechaza la clave no autorizada %s incluso acompañada de la canónica', (clave) => {
    esperar400(() => normalizarEntrada({ titulo: 'Carnet', [clave]: 'valor' }));
  });

  test.each([null, [], 'texto', 7])('rechaza un cuerpo no objeto: %p', (datos) => {
    esperar400(() => normalizarEntrada(datos));
  });

});

describe('Ubicación exclusiva y decisión sin consultas (RF-5)', () => {
  test.each([
    [{ ubicacion_id: '3' }, { forma: 'id', ubicacion_id: 3 }],
    [{ ubicacion_otro: ' Patio ' }, { forma: 'otro', ubicacion_otro: 'Patio' }],
  ])('resuelve la estrategia y conserva el campus: %p', (ubicacion, esperado) => {
    const datos = Object.freeze({ campus: ' principal ', ...ubicacion });
    expect(resolverFormaUbicacion(datos)).toEqual({ campus: 'principal', ...esperado });
    expect(datos.campus).toBe(' principal ');
  });

  test('otro admite campus desconocido sin consultar un catálogo cerrado', () => {
    expect(resolverFormaUbicacion({ campus: 'nuevo', ubicacion_otro: 'Patio' }))
      .toEqual({ campus: 'nuevo', forma: 'otro', ubicacion_otro: 'Patio' });
  });

  test.each([
    {}, { ubicacion_id: 3, ubicacion: 'Biblioteca' }, { ubicacion: 'Biblioteca' },
    { ubicacion_id: 3, ubicacion_otro: 'Patio' },
    { ubicacion: 'Biblioteca', ubicacion_otro: 'Patio' },
    { ubicacion_id: 3, ubicacion: 'Biblioteca', ubicacion_otro: 'Patio' },
    { ubicacion_id: 3, ubicacion_otro: '' },
  ])('rechaza ninguna o varias formas: %p', (ubicacion) => {
    esperar400(() => resolverFormaUbicacion({ campus: 'principal', ...ubicacion }));
  });

  test.each([undefined, null, '', ' ', 7, []])('exige campus no vacío: %p', (campus) => {
    esperar400(() => resolverFormaUbicacion({ campus, ubicacion_id: 3 }));
  });

  test.each([null, '', ' ', 0, -1, 1.5, 'abc', true, [], {}])
  ('rechaza ID inválido: %p', (ubicacion_id) => {
    esperar400(() => resolverFormaUbicacion({ campus: 'principal', ubicacion_id }));
  });

  test.each(['ubicacion', 'ubicacion_otro'])('exige texto no vacío para %s', (campo) => {
    for (const valor of [null, '', '  ', 3, [], {}]) {
      esperar400(() => resolverFormaUbicacion({ campus: 'principal', [campo]: valor }));
    }
  });

  test('coincidencia activa ya filtrada por nombre/campus se convierte en ID', () => {
    const coincidencias = Object.freeze([Object.freeze({ id: 8, activo: true })]);
    expect(resolverUbicacionPorNombre(' biblioteca ', coincidencias))
      .toEqual({ ubicacion_id: 8, ubicacion_otro: null });
  });

  test.each([false, null])('coincidencia no activa (%p) nunca cae a texto libre', (activo) => {
    esperar400(() => resolverUbicacionPorNombre('Biblioteca', [{ id: 8, activo }]));
  });

  test('sin coincidencias conserva el nombre recortado como otro, sin crear ubicación', () => {
    expect(resolverUbicacionPorNombre(' Patio nuevo ', Object.freeze([])))
      .toEqual({ ubicacion_id: null, ubicacion_otro: 'Patio nuevo' });
  });
});

describe('Matriz pura de transiciones (RF-8)', () => {
  const estados = ['perdido', 'encontrado', 'en_servicios', 'devuelto', 'donado'];
  const permitidas = new Set([
    'perdido:perdido:devuelto',
    'encontrado:encontrado:en_servicios',
    'encontrado:en_servicios:devuelto',
    'encontrado:en_servicios:donado',
  ]);
  const casos = ['perdido', 'encontrado'].flatMap((tipo) =>
    estados.flatMap((actual) => estados.map((nuevo) => [tipo, actual, nuevo])));

  test.each(casos)('%s: %s → %s', (tipo, actual, nuevo) => {
    expect(esTransicionValida(tipo, actual, nuevo))
      .toBe(permitidas.has(`${tipo}:${actual}:${nuevo}`));
  });

  test.each([undefined, null, '', 'entregado', 'En servicios', 'otro'])
  ('valores fuera del enum no autorizan transiciones: %p', (valor) => {
    expect(esTransicionValida(valor, 'perdido', 'devuelto')).toBe(false);
    expect(esTransicionValida('perdido', valor, 'devuelto')).toBe(false);
    expect(esTransicionValida('encontrado', 'en_servicios', valor)).toBe(false);
  });

  test.each(estados)('mismo estado %s no representa una mutación válida', (estado) => {
    expect(esTransicionValida('perdido', estado, estado)).toBe(false);
    expect(esTransicionValida('encontrado', estado, estado)).toBe(false);
    // T7 tratará la igualdad antes de validar: sin UPDATE ni historial.
  });
});

describe('Forma pura de estadísticas (RF-10)', () => {
  const vacias = {
    total: 0, activos: 0, inactivos: 0,
    porEstado: { Perdido: 0, Encontrado: 0, 'En servicios': 0, Devuelto: 0, Donado: 0 },
    seriesFechas: [], seriesUbicaciones: [],
  };

  test.each([undefined, {}, { totales: null, porEstado: null, seriesFechas: null, seriesUbicaciones: null }])
  ('sin datos devuelve ceros y listas vacías: %p', (datos) => {
    expect(formatearEstadisticas(datos)).toEqual(vacias);
  });

  test('forma exacta, conteos pg numéricos, cinco etiquetas y series con campus', () => {
    const datos = Object.freeze({
      totales: Object.freeze({ total: '9', activos: '6', inactivos: '3', entregados: 99 }),
      porEstado: Object.freeze([
        Object.freeze({ estado: 'perdido', count: '2' }),
        { estado: 'encontrado', count: '1' }, { estado: 'en_servicios', count: '3' },
        { estado: 'devuelto', count: '2' }, { estado: 'donado', count: '1' },
        { estado: 'entregado', count: '99' },
      ]),
      seriesFechas: Object.freeze([Object.freeze({ fecha: '2026-10-22', count: '9' })]),
      seriesUbicaciones: Object.freeze([
        Object.freeze({ campus: 'principal', ubicacion: 'Biblioteca', count: '4' }),
        { campus: 'nuevo', ubicacion: 'Biblioteca', count: '2' },
      ]),
    });
    expect(formatearEstadisticas(datos)).toEqual({
      total: 9, activos: 6, inactivos: 3,
      porEstado: { Perdido: 2, Encontrado: 1, 'En servicios': 3, Devuelto: 2, Donado: 1 },
      seriesFechas: [{ fecha: '2026-10-22', count: 9 }],
      seriesUbicaciones: [
        { campus: 'principal', ubicacion: 'Biblioteca', count: 4 },
        { campus: 'nuevo', ubicacion: 'Biblioteca', count: 2 },
      ],
    });
    expect(datos.totales.total).toBe('9');
    expect(datos.seriesFechas[0].count).toBe('9');
  });

  test('no propaga null ni crea grupos desde ubicacion_otro', () => {
    expect(formatearEstadisticas({
      totales: { total: null, activos: null, inactivos: null },
      porEstado: [null, { estado: null, count: '3' }, { estado: 'perdido', count: null }],
      seriesFechas: [null, { fecha: null, count: '2' }],
      seriesUbicaciones: [null, { campus: 'principal', ubicacion: null, ubicacion_otro: 'Patio', count: '2' }],
    } as unknown as Parameters<typeof formatearEstadisticas>[0])).toEqual(vacias);
  });

  test('respuestas sucesivas no comparten objetos ni arreglos mutables', () => {
    const primera = formatearEstadisticas();
    primera.porEstado.Perdido = 8;
    primera.seriesFechas.push({ fecha: '2026-10-22', count: 8 });
    expect(formatearEstadisticas()).toEqual(vacias);
  });
});

describe('Tipo y estado inicial por autor (RF-4)', () => {
  test.each<[TipoAutor, TipoReporte, EstadoReporte]>([
    ['usuario', 'perdido', 'perdido'],
    ['usuario', 'encontrado', 'encontrado'],
    ['admin', 'encontrado', 'en_servicios'],
  ])('%s/%s deriva %s sin mutar el tipo de entrada', (tipo, tipo_reporte, estado) => {
    const datos = Object.freeze({ tipo_reporte });
    expect(resolverTipoEstado(datos, { tipo })).toEqual({ tipo_reporte, estado });
    expect(datos).toEqual({ tipo_reporte });
    expect(resolverTipoEstado({ tipo_reporte, estado }, { tipo }))
      .toEqual({ tipo_reporte, estado });
  });

  test.each(['perdido', 'encontrado'])('acepta estado legado %s sin tipo', (estado) => {
    expect(resolverTipoEstado({ estado }, { tipo: 'usuario' }))
      .toEqual({ tipo_reporte: estado, estado });
  });

  test('el hallazgo legado interno de admin deriva custodia, no estado de cliente', () => {
    expect(resolverTipoEstado({ estado: 'encontrado' }, { tipo: 'admin' }))
      .toEqual({ tipo_reporte: 'encontrado', estado: 'en_servicios' });
  });

  test('normaliza valores de texto heredados de la API', () => {
    expect(resolverTipoEstado({ tipo_reporte: ' Encontrado ', estado: 'Encontrado' }, { tipo: 'usuario' }))
      .toEqual({ tipo_reporte: 'encontrado', estado: 'encontrado' });
  });

  test.each([
    {}, { tipo_reporte: '' }, { tipo_reporte: null },
    { tipo_reporte: 'otro' }, { tipo_reporte: 'devuelto' },
    { tipo_reporte: ['perdido'] }, { tipo_reporte: 'en_servicios' },
    { estado: 'en_servicios' }, { estado: 'devuelto' }, { estado: 'donado' },
    { estado: 'entregado' }, { estado: '' }, { estado: null },
    { tipo_reporte: 'perdido', estado: 'encontrado' },
    { tipo_reporte: 'encontrado', estado: 'perdido' },
    { tipo_reporte: 'encontrado', estado: 'en_servicios' },
    { tipo_reporte: 'perdido', estado: 'devuelto' },
    { tipo_reporte: 'encontrado', estado: 'donado' },
    { tipo_reporte: 'perdido', estado: '' },
    { tipo_reporte: 'perdido', estado: null },
  ])('rechaza ausencia, contradicción o estado no inicial: %p', (datos) => {
    esperar400(() => resolverTipoEstado(datos, { tipo: 'usuario' }));
  });

  test('admin no puede originar perdidos ni contradecir el estado derivado', () => {
    esperar400(() => resolverTipoEstado({ tipo_reporte: 'perdido' }, { tipo: 'admin' }));
    esperar400(() => resolverTipoEstado({ tipo_reporte: 'encontrado', estado: 'encontrado' }, { tipo: 'admin' }));
  });

  test.each([undefined, null, {}, { tipo: 'otro' }])('no presupone un autor válido: %p', (autor) => {
    esperar400(() => resolverTipoEstado(
      { tipo_reporte: 'perdido' },
      autor as unknown as Pick<AutorReporte, 'tipo'> | null | undefined,
    ));
  });
});

describe('Fecha del incidente (RF-2, RNF-07)', () => {
  const opciones = { hoy: '2026-10-22' };

  test.each(['2026-10-22', '2026-10-21', '2024-02-29', '2000-02-29'])
  ('acepta fecha real no futura: %s', (fecha) => {
    expect(validarFechaIncidente(fecha, opciones)).toBe(fecha);
  });

  test.each([
    undefined, null, '', ' ', '22/10/2026', '2026-1-02', '2026-10-22T00:00:00Z',
    '2026-02-29', '2026-04-31', '1900-02-29', '2026-13-01', '2026-00-01',
    '2026-01-00', '0000-01-01', '2026-10-23', 20261022, ['2026-10-22'],
  ])('rechaza fecha inválida o futura: %p', (fecha) => {
    esperar400(() => validarFechaIncidente(fecha, opciones));
  });

  test('hoy inyectado controla el límite sin depender del reloj de la prueba', () => {
    esperar400(() => validarFechaIncidente('2026-10-22', { hoy: '2026-10-21' }));
  });
});

describe('Presentación de estados (RC-IDIOMA)', () => {
  test.each([
    ['perdido', 'Perdido'], ['encontrado', 'Encontrado'],
    ['en_servicios', 'En servicios'], ['devuelto', 'Devuelto'], ['donado', 'Donado'],
  ])('%s se presenta como %s', (estado, etiqueta) => {
    expect(presentarEstado(estado)).toBe(etiqueta);
  });
});

describe('T3: Verificación de devolución A10 (RF-9, RNF-21)', () => {
  const datosValidos = Object.freeze({
    nombre_receptor: 'Juan Pérez',
    referencia_comprobante: 'Verificación presencial con carnet universitario',
  });

  test('acepta los dos campos obligatorios sin opcionales y minimiza', () => {
    expect(validarVerificacionDevolucion(datosValidos)).toEqual({
      nombre_receptor: 'Juan Pérez',
      referencia_comprobante: 'Verificación presencial con carnet universitario',
    });
  });

  test('V4-T9 / B7: acepta observacion opcional vacía o con espacios y la omite sin lanzar 400', () => {
    expect(validarVerificacionDevolucion({ ...datosValidos, observacion: '' })).toEqual({
      nombre_receptor: 'Juan Pérez',
      referencia_comprobante: 'Verificación presencial con carnet universitario',
    });
    expect(validarVerificacionDevolucion({ ...datosValidos, observacion: '   ' })).toEqual({
      nombre_receptor: 'Juan Pérez',
      referencia_comprobante: 'Verificación presencial con carnet universitario',
    });
    expect(validarVerificacionDevolucion({ ...datosValidos, observacion: null })).toEqual({
      nombre_receptor: 'Juan Pérez',
      referencia_comprobante: 'Verificación presencial con carnet universitario',
    });
  });

  test('acepta observacion y usuario_id válidos', () => {
    const completo = {
      ...datosValidos,
      observacion: 'Entregado en ventanilla central',
      usuario_id: 42,
    };
    expect(validarVerificacionDevolucion(completo)).toEqual(completo);
  });

  test('acepta usuario_id en extremos INTEGER 1..2147483647', () => {
    expect(validarVerificacionDevolucion({ ...datosValidos, usuario_id: 1 }).usuario_id).toBe(1);
    expect(validarVerificacionDevolucion({ ...datosValidos, usuario_id: 2147483647 }).usuario_id).toBe(2147483647);
    for (const invalido of [0, -1, 2147483648, '42', null, []]) {
      esperar400(() => validarVerificacionDevolucion({ ...datosValidos, usuario_id: invalido }));
    }
  });

  test.each([
    ['nombre_receptor', ''],
    ['nombre_receptor', '   '],
    ['nombre_receptor', null],
    ['nombre_receptor', 123],
    ['referencia_comprobante', ''],
    ['referencia_comprobante', '   '],
    ['referencia_comprobante', undefined],
    ['referencia_comprobante', null],
  ])('rechaza cuando %s es inválido o ausente: %p', (campo, valor) => {
    esperar400(() => validarVerificacionDevolucion({ ...datosValidos, [campo]: valor }));
  });

  test('rechaza textos que excedan los límites máximos', () => {
    esperar400(() => validarVerificacionDevolucion({ ...datosValidos, nombre_receptor: 'a'.repeat(256) }));
    esperar400(() => validarVerificacionDevolucion({ ...datosValidos, referencia_comprobante: 'a'.repeat(256) }));
    esperar400(() => validarVerificacionDevolucion({ ...datosValidos, observacion: 'a'.repeat(1001) }));
    expect(validarVerificacionDevolucion({ ...datosValidos, observacion: 'a'.repeat(1000) }).observacion?.length).toBe(1000);
  });

  test.each([
    'fotografia', 'foto', 'documento', 'carnet', 'ci', 'imagen', 'image', 'extra',
  ])('rechaza claves no autorizadas: %s', (clave) => {
    esperar400(() => validarVerificacionDevolucion({ ...datosValidos, [clave]: 'valor' }));
  });

  test.each([null, undefined, 'texto', 123, []])('rechaza cuerpo no objeto: %p', (cuerpo) => {
    esperar400(() => validarVerificacionDevolucion(cuerpo));
  });
});

describe('T3: Validación de forma de edición (RF-17–RF-19)', () => {
  const hoy = '2026-11-09';

  test('acepta un campo editable único o varios', () => {
    expect(validarFormaEdicion({ titulo: ' Nuevo título ' })).toEqual({ titulo: 'Nuevo título' });
    expect(validarFormaEdicion({
      titulo: 'Título',
      descripcion: 'Descripción',
      contacto: 'contacto@example.test',
      categoria_id: 2,
      fecha_incidente: '2026-11-08',
      campus: 'Campus Central',
      ubicacion_otro: 'Piso 2',
    }, { hoy })).toEqual({
      titulo: 'Título',
      descripcion: 'Descripción',
      contacto: 'contacto@example.test',
      categoria_id: 2,
      fecha_incidente: '2026-11-08',
      campus: 'Campus Central',
      ubicacion_otro: 'Piso 2',
    });
  });

  test('rechaza cuerpo vacío sin campos de edición', () => {
    esperar400(() => validarFormaEdicion({}));
  });

  test.each([
    'id', 'tipo_reporte', 'estado', 'activo', 'imagen', 'image', 'usuario_id',
    'administrador_id', 'fecha', 'fecha_creacion', 'clave_desconocida',
  ])('rechaza campos inmutables o no autorizados: %s', (campo) => {
    esperar400(() => validarFormaEdicion({ titulo: 'Válido', [campo]: 'no_permitido' }));
  });

  test('rechaza ambigüedad de ubicación con ambos campos en edición', () => {
    esperar400(() => validarFormaEdicion({ ubicacion_id: 3, ubicacion_otro: 'Patio' }));
  });

  test('rechaza fecha_incidente futura', () => {
    esperar400(() => validarFormaEdicion({ fecha_incidente: '2026-11-10' }, { hoy }));
  });
});

describe('T3: Diferencias de edición (RF-18, CF-5)', () => {
  const reporteBase: FilaReporte = {
    id: 10,
    usuario_id: null,
    administrador_id: 1,
    tipo_autor: 'admin',
    usuario_nombre: null,
    usuario_correo: null,
    administrador_nombre: 'Admin',
    titulo: 'Mochila negra',
    descripcion: 'Encontrada en el aula 101',
    contacto: 'servicios@example.test',
    categoria_id: 1,
    categoria_nombre: 'Mochilas',
    fecha_incidente: '2026-11-01',
    fecha: '2026-11-01',
    campus: 'Central',
    ubicacion_id: 5,
    ubicacion_nombre: 'Aula 101',
    ubicacion_otro: null,
    imagen: 'foto.jpg',
    tipo_reporte: 'encontrado',
    estado: 'en_servicios',
    activo: true,
  };

  test('retorna arreglo vacío si los valores enviados son idénticos a los actuales', () => {
    const cambios = {
      titulo: 'Mochila negra',
      descripcion: 'Encontrada en el aula 101',
      categoria_id: 1,
    };
    expect(obtenerDiferenciasEdicion(reporteBase, cambios)).toEqual([]);
  });

  test('detecta diferencias solo en campos que cambiaron', () => {
    const cambios = {
      titulo: 'Mochila azul',
      descripcion: 'Encontrada en el aula 101', // idéntico
      contacto: 'nuevo@example.test',
    };
    const difs = obtenerDiferenciasEdicion(reporteBase, cambios);
    expect(difs).toEqual([
      { campo: 'titulo', valor_anterior: 'Mochila negra', valor_nuevo: 'Mochila azul' },
      { campo: 'contacto', valor_anterior: 'servicios@example.test', valor_nuevo: 'nuevo@example.test' },
    ]);
  });

  test('detecta cambio de forma de ubicación (de id a otro y viceversa)', () => {
    const aOtro = obtenerDiferenciasEdicion(reporteBase, { ubicacion_otro: 'Patio central' });
    expect(aOtro).toContainEqual({ campo: 'ubicacion_id', valor_anterior: '5', valor_nuevo: null });
    expect(aOtro).toContainEqual({ campo: 'ubicacion_otro', valor_anterior: null, valor_nuevo: 'Patio central' });

    const reporteConOtro: FilaReporte = { ...reporteBase, ubicacion_id: null, ubicacion_otro: 'Patio central' };
    const aId = obtenerDiferenciasEdicion(reporteConOtro, { ubicacion_id: 8 });
    expect(aId).toContainEqual({ campo: 'ubicacion_otro', valor_anterior: 'Patio central', valor_nuevo: null });
    expect(aId).toContainEqual({ campo: 'ubicacion_id', valor_anterior: null, valor_nuevo: '8' });
  });
});

describe('T3: Validación de forma básica de solicitud por operación', () => {
  test.each(['recepcion', 'donacion', 'archivo', 'reactivacion'] as const)(
    '%s acepta objeto vacío o ausente y rechaza cualquier clave',
    (operacion) => {
      expect(validarFormaBasicaSolicitud(operacion, {})).toEqual({});
      expect(validarFormaBasicaSolicitud(operacion, undefined)).toEqual({});
      esperar400(() => validarFormaBasicaSolicitud(operacion, { extra: 'no_permitido' }));
    },
  );

  test('cierre A13 valida exclusivamente reporte_encontrado_id', () => {
    expect(validarFormaBasicaSolicitud('cierre', { reporte_encontrado_id: 42 })).toEqual({
      reporte_encontrado_id: 42,
    });
    // rechaza cuerpo vacío o ausente
    esperar400(() => validarFormaBasicaSolicitud('cierre', {}));
    esperar400(() => validarFormaBasicaSolicitud('cierre', undefined));
    esperar400(() => validarFormaBasicaSolicitud('cierre', null));
    // rechaza campos adicionales
    esperar400(() => validarFormaBasicaSolicitud('cierre', { reporte_encontrado_id: 42, extra: 'x' }));
    // rechaza IDs inválidos
    esperar400(() => validarFormaBasicaSolicitud('cierre', { reporte_encontrado_id: 0 }));
    esperar400(() => validarFormaBasicaSolicitud('cierre', { reporte_encontrado_id: -1 }));
    esperar400(() => validarFormaBasicaSolicitud('cierre', { reporte_encontrado_id: 2147483648 }));
    esperar400(() => validarFormaBasicaSolicitud('cierre', { reporte_encontrado_id: '42' }));
    esperar400(() => validarFormaBasicaSolicitud('cierre', { reporte_encontrado_id: 3.14 }));
  });

  test('devolucion ejecuta validación A10', () => {
    expect(validarFormaBasicaSolicitud('devolucion', {
      nombre_receptor: 'Ana',
      referencia_comprobante: 'Carnet',
    })).toEqual({
      nombre_receptor: 'Ana',
      referencia_comprobante: 'Carnet',
    });
    esperar400(() => validarFormaBasicaSolicitud('devolucion', {}));
  });

  test('edicion ejecuta validación de campos de edición', () => {
    expect(validarFormaBasicaSolicitud('edicion', { titulo: 'Nuevo' })).toEqual({ titulo: 'Nuevo' });
    esperar400(() => validarFormaBasicaSolicitud('edicion', {}));
  });
});

describe('T3: Matriz de autorización RBAC (RF-1–RF-3)', () => {
  test('expone la matriz A1 canónica por operación', () => {
    expect(ROLES_POR_OPERACION.lectura).toEqual(['superadmin', 'admin', 'personal_servicios']);
    expect(ROLES_POR_OPERACION.alta).toEqual(['admin', 'personal_servicios']);
    expect(ROLES_POR_OPERACION.recepcion).toEqual(['admin', 'personal_servicios']);
    expect(ROLES_POR_OPERACION.devolucion).toEqual(['admin', 'personal_servicios']);
    expect(ROLES_POR_OPERACION.cierre).toEqual(['admin', 'personal_servicios']);
    expect(ROLES_POR_OPERACION.donacion).toEqual(['admin']); // Solo admin
    expect(ROLES_POR_OPERACION.edicion).toEqual(['admin', 'personal_servicios']);
    expect(ROLES_POR_OPERACION.archivo).toEqual(['admin', 'personal_servicios']);
    expect(ROLES_POR_OPERACION.reactivacion).toEqual(['admin', 'personal_servicios']);
  });

  test('esRolAutorizadoParaOperacion valida estrictamente roles permitidos', () => {
    expect(esRolAutorizadoParaOperacion('donacion', 'admin')).toBe(true);
    expect(esRolAutorizadoParaOperacion('donacion', 'personal_servicios')).toBe(false);
    expect(esRolAutorizadoParaOperacion('donacion', 'superadmin')).toBe(false);
    expect(esRolAutorizadoParaOperacion('alta', 'superadmin')).toBe(false);
    expect(esRolAutorizadoParaOperacion('alta', 'personal_servicios')).toBe(true);
    expect(esRolAutorizadoParaOperacion('edicion', 'admin')).toBe(true);
    expect(esRolAutorizadoParaOperacion('edicion', 'estudiante')).toBe(false);
    expect(esRolAutorizadoParaOperacion('edicion', undefined)).toBe(false);
  });

  test('middleware autorizador por operación responde 403 cuando no está autorizado', () => {
    const middleware = crearAutorizadorPorOperacion('donacion');
    const req = { administrador: { rol: 'personal_servicios' } } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const next = jest.fn();

    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Operación administrativa no habilitada' });
    expect(next).not.toHaveBeenCalled();
  });

  test('middleware autorizador por operación llama a next cuando el rol es permitido', () => {
    const middleware = crearAutorizadorPorOperacion('donacion');
    const req = { administrador: { rol: 'admin' } } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('T3: Función pura decidirOperacion (RF-8–RF-23, CF-1/3–5)', () => {
  const actorAdmin: PerfilAdministrador = { id: 1, nombre: 'Admin', correo: 'admin@findu.test', rol: 'admin' };
  const actorServicios: PerfilAdministrador = { id: 2, nombre: 'Servicios', correo: 'serv@findu.test', rol: 'personal_servicios' };
  const actorSuperadmin: PerfilAdministrador = { id: 3, nombre: 'Super', correo: 'super@findu.test', rol: 'superadmin' };

  const reporteEncontradoActivo: FilaReporte = {
    id: 100, usuario_id: null, administrador_id: 1, tipo_autor: 'admin',
    usuario_nombre: null, usuario_correo: null, administrador_nombre: 'Admin',
    titulo: 'Billetera', descripcion: 'Marrón de cuero', contacto: 'c@test',
    categoria_id: 1, categoria_nombre: 'Accesorios', fecha_incidente: '2026-11-01',
    fecha: '2026-11-01', campus: 'Central', ubicacion_id: 2, ubicacion_nombre: 'Patio',
    ubicacion_otro: null, imagen: 'foto.jpg', tipo_reporte: 'encontrado',
    estado: 'encontrado', activo: true,
  };

  test('rechaza con error 403 si el rol del actor no está autorizado', () => {
    const resultado = decidirOperacion({
      operacion: 'donacion',
      reporte: { ...reporteEncontradoActivo, estado: 'en_servicios' },
      actor: actorServicios, // personal_servicios no puede donar
      payload: {},
    });
    expect(resultado).toEqual({
      tipo: 'error',
      status: 403,
      message: 'Operación administrativa no habilitada',
    });
  });

  test('rechaza con 409 si el reporte está archivado para operaciones de estado o edición', () => {
    const archivado: FilaReporte = { ...reporteEncontradoActivo, activo: false };
    for (const operacion of ['recepcion', 'devolucion', 'cierre', 'donacion', 'edicion'] as const) {
      const res = decidirOperacion({ operacion, reporte: archivado, actor: actorAdmin, payload: {} });
      expect(res).toEqual({
        tipo: 'error',
        status: 409,
        message: 'No se puede operar sobre un reporte archivado',
      });
    }
  });

  test('permite archivo y reactivacion sobre reporte archivado', () => {
    const archivado: FilaReporte = { ...reporteEncontradoActivo, activo: false };
    // archivo sobre archivado es no-op
    expect(decidirOperacion({ operacion: 'archivo', reporte: archivado, actor: actorAdmin, payload: {} })).toEqual({
      tipo: 'sin_efecto',
      respuesta: { cambiado: false, id: 100, activo: false },
    });
    // reactivacion sobre archivado es mutacion
    const reactivacion = decidirOperacion({ operacion: 'reactivacion', reporte: archivado, actor: actorAdmin, payload: {} });
    expect(reactivacion.tipo).toBe('mutacion');
    if (reactivacion.tipo === 'mutacion') {
      expect(reactivacion.cambios).toEqual({ activo: true });
      expect(reactivacion.historial).toEqual([{ accion: 'reactivacion', valor_anterior: 'inactivo', valor_nuevo: 'activo' }]);
      expect(reactivacion.auditoria).toEqual({ accion: 'reactivacion_reporte' });
    }
  });

  test('incompatibilidad tipo/ruta: devolucion/donacion requieren encontrado, cierre requiere perdido (400)', () => {
    const reportePerdido: FilaReporte = { ...reporteEncontradoActivo, tipo_reporte: 'perdido', estado: 'perdido' };
    expect(decidirOperacion({ operacion: 'devolucion', reporte: reportePerdido, actor: actorAdmin, payload: { nombre_receptor: 'A', referencia_comprobante: 'B' } })).toEqual({
      tipo: 'error', status: 400, message: 'Esta operación solo aplica a reportes encontrados',
    });
    expect(decidirOperacion({ operacion: 'donacion', reporte: reportePerdido, actor: actorAdmin, payload: {} })).toEqual({
      tipo: 'error', status: 400, message: 'Esta operación solo aplica a reportes encontrados',
    });
    expect(decidirOperacion({ operacion: 'cierre', reporte: reporteEncontradoActivo, actor: actorAdmin, payload: {} })).toEqual({
      tipo: 'error', status: 400, message: 'Esta operación solo aplica a reportes perdidos',
    });
  });

  test('edición sobre reporte terminal activo responde 409', () => {
    const devueltoActivo: FilaReporte = { ...reporteEncontradoActivo, estado: 'devuelto' };
    expect(decidirOperacion({ operacion: 'edicion', reporte: devueltoActivo, actor: actorAdmin, payload: { titulo: 'Nuevo' } })).toEqual({
      tipo: 'error', status: 409, message: 'No se puede editar un reporte en estado terminal',
    });
    const donadoActivo: FilaReporte = { ...reporteEncontradoActivo, estado: 'donado' };
    expect(decidirOperacion({ operacion: 'edicion', reporte: donadoActivo, actor: actorAdmin, payload: { titulo: 'Nuevo' } })).toEqual({
      tipo: 'error', status: 409, message: 'No se puede editar un reporte en estado terminal',
    });
  });

  test('no-ops (A9/A10): estado idéntico o edición sin diferencias en reporte activo', () => {
    // recepcion repetida
    const enServicios: FilaReporte = { ...reporteEncontradoActivo, estado: 'en_servicios' };
    expect(decidirOperacion({ operacion: 'recepcion', reporte: enServicios, actor: actorAdmin, payload: {} })).toEqual({
      tipo: 'sin_efecto',
      respuesta: { cambiado: false, id: 100, estado: 'En servicios' },
    });

    // devolucion repetida sobre devuelto (valida A10 y no altera nada)
    const devuelto: FilaReporte = { ...reporteEncontradoActivo, estado: 'devuelto' };
    expect(decidirOperacion({
      operacion: 'devolucion',
      reporte: devuelto,
      actor: actorAdmin,
      payload: { nombre_receptor: 'Ana', referencia_comprobante: 'Carnet' },
    })).toEqual({
      tipo: 'sin_efecto',
      respuesta: { cambiado: false, id: 100, estado: 'Devuelto' },
    });

    // cierre repetido sobre devuelto en reporte perdido: tres situaciones A13/A15
    const cierrePerdidoDevuelto: FilaReporte = { ...reporteEncontradoActivo, tipo_reporte: 'perdido', estado: 'devuelto' };

    // 1) A15 histórico sin enlace registrado
    expect(decidirOperacion({
      operacion: 'cierre',
      reporte: cierrePerdidoDevuelto,
      actor: actorAdmin,
      payload: { reporte_encontrado_id: 42 },
      esCierreHistoricoSinEnlace: true,
    })).toEqual({
      tipo: 'sin_efecto',
      respuesta: {
        cambiado: false,
        id: 100,
        estado: 'Devuelto',
        nota: 'Cierre anterior sin contraparte registrada',
      },
    });

    // 2) A13 con mismo enlace
    expect(decidirOperacion({
      operacion: 'cierre',
      reporte: cierrePerdidoDevuelto,
      actor: actorAdmin,
      payload: { reporte_encontrado_id: 50 },
      enlaceExistente: { reporte_encontrado_id: 50 },
    })).toEqual({
      tipo: 'sin_efecto',
      respuesta: { cambiado: false, id: 100, estado: 'Devuelto' },
    });

    // 3) A13 con enlace distinto responde 409
    expect(decidirOperacion({
      operacion: 'cierre',
      reporte: cierrePerdidoDevuelto,
      actor: actorAdmin,
      payload: { reporte_encontrado_id: 99 },
      enlaceExistente: { reporte_encontrado_id: 50 },
    })).toEqual({
      tipo: 'error',
      status: 409,
      message: 'El reporte ya se encuentra vinculado a otra contraparte',
    });

    // donacion repetida sobre donado
    const donado: FilaReporte = { ...reporteEncontradoActivo, estado: 'donado' };
    expect(decidirOperacion({ operacion: 'donacion', reporte: donado, actor: actorAdmin, payload: {} })).toEqual({
      tipo: 'sin_efecto',
      respuesta: { cambiado: false, id: 100, estado: 'Donado' },
    });

    // archivo repetido sobre activo: false
    expect(decidirOperacion({ operacion: 'archivo', reporte: { ...reporteEncontradoActivo, activo: false }, actor: actorAdmin, payload: {} })).toEqual({
      tipo: 'sin_efecto',
      respuesta: { cambiado: false, id: 100, activo: false },
    });

    // reactivacion repetida sobre activo: true
    expect(decidirOperacion({ operacion: 'reactivacion', reporte: reporteEncontradoActivo, actor: actorAdmin, payload: {} })).toEqual({
      tipo: 'sin_efecto',
      respuesta: { cambiado: false, id: 100, activo: true },
    });

    // edicion sin diferencias sobre reporte activo
    expect(decidirOperacion({
      operacion: 'edicion',
      reporte: enServicios,
      actor: actorAdmin,
      payload: { titulo: 'Billetera' },
    })).toEqual({
      tipo: 'sin_efecto',
      respuesta: { actualizado: false, id: 100 },
    });
  });

  test('transición o acción incompatible responde 400', () => {
    // devolucion directa sobre encontrado (sin haber pasado por en_servicios)
    expect(decidirOperacion({
      operacion: 'devolucion',
      reporte: reporteEncontradoActivo,
      actor: actorAdmin,
      payload: { nombre_receptor: 'A', referencia_comprobante: 'B' },
    })).toEqual({
      tipo: 'error', status: 400, message: 'El reporte debe ser recepcionado antes de ser devuelto',
    });

    // donacion sobre devuelto
    const devuelto: FilaReporte = { ...reporteEncontradoActivo, estado: 'devuelto' };
    expect(decidirOperacion({ operacion: 'donacion', reporte: devuelto, actor: actorAdmin, payload: {} })).toEqual({
      tipo: 'error', status: 400, message: 'Transición de estado inválida',
    });

    // devolucion sobre donado
    const donado: FilaReporte = { ...reporteEncontradoActivo, estado: 'donado' };
    expect(decidirOperacion({
      operacion: 'devolucion',
      reporte: donado,
      actor: actorAdmin,
      payload: { nombre_receptor: 'A', referencia_comprobante: 'B' },
    })).toEqual({
      tipo: 'error', status: 400, message: 'Transición de estado inválida',
    });
  });

  test('mutaciones válidas producen cambios, historial y auditoría exactos', () => {
    // recepcion
    const resRecepcion = decidirOperacion({ operacion: 'recepcion', reporte: reporteEncontradoActivo, actor: actorAdmin, payload: {} });
    expect(resRecepcion).toEqual({
      tipo: 'mutacion',
      cambios: { estado: 'en_servicios' },
      historial: [{ accion: 'recepcion', valor_anterior: 'encontrado', valor_nuevo: 'en_servicios' }],
      auditoria: { accion: 'recepcion_reporte' },
    });

    // devolucion
    const enServicios: FilaReporte = { ...reporteEncontradoActivo, estado: 'en_servicios' };
    const resDev = decidirOperacion({
      operacion: 'devolucion',
      reporte: enServicios,
      actor: actorAdmin,
      payload: { nombre_receptor: 'Carlos', referencia_comprobante: 'Carnet #123' },
    });
    expect(resDev).toEqual({
      tipo: 'mutacion',
      cambios: { estado: 'devuelto' },
      historial: [{ accion: 'devolucion', valor_anterior: 'en_servicios', valor_nuevo: 'devuelto' }],
      auditoria: {
        accion: 'devolucion_reporte',
        detalles: { nombre_receptor: 'Carlos', referencia_comprobante: 'Carnet #123' },
      },
    });

    // cierre de perdido
    const perdido: FilaReporte = { ...reporteEncontradoActivo, tipo_reporte: 'perdido', estado: 'perdido' };
    const resCierre = decidirOperacion({
      operacion: 'cierre',
      reporte: perdido,
      actor: actorAdmin,
      payload: { reporte_encontrado_id: 50 },
      contraparteValida: {
        reporte: { ...reporteEncontradoActivo, id: 50, estado: 'devuelto' },
        entregaA10Id: 777,
      },
    });
    expect(resCierre).toEqual({
      tipo: 'mutacion',
      cambios: { estado: 'devuelto' },
      historial: [{ accion: 'cierre', valor_anterior: 'perdido', valor_nuevo: 'devuelto' }],
      auditoria: {
        accion: 'cierre_reporte',
        detalles: { reporte_encontrado_id: 50, registro_devolucion_id: 777 },
      },
    });

    // donacion
    const resDonacion = decidirOperacion({ operacion: 'donacion', reporte: enServicios, actor: actorAdmin, payload: {} });
    expect(resDonacion).toEqual({
      tipo: 'mutacion',
      cambios: { estado: 'donado' },
      historial: [{ accion: 'donacion', valor_anterior: 'en_servicios', valor_nuevo: 'donado' }],
      auditoria: { accion: 'donacion_reporte' },
    });

    // edicion con diferencias
    const resEdicion = decidirOperacion({
      operacion: 'edicion',
      reporte: enServicios,
      actor: actorAdmin,
      payload: { titulo: 'Billetera roja' },
    });
    expect(resEdicion.tipo).toBe('mutacion');
    if (resEdicion.tipo === 'mutacion') {
      expect(resEdicion.cambios).toEqual({ titulo: 'Billetera roja' });
      expect(resEdicion.historial).toEqual([
        {
          accion: 'edicion',
          valor_anterior: JSON.stringify({ campo: 'titulo', valor: 'Billetera' }),
          valor_nuevo: JSON.stringify({ campo: 'titulo', valor: 'Billetera roja' }),
        },
      ]);
      expect(resEdicion.auditoria).toEqual({
        accion: 'edicion_reporte',
        detalles: { campos: ['titulo'] },
      });
    }
  });
});
