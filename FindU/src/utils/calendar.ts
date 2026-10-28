export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

export interface PartesFecha {
  anio: number;
  mes: number;
  dia: number;
}

export function partesFecha(fecha: string): PartesFecha | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!coincidencia) {
    return null;
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  if (mes < 1 || mes > 12 || dia < 1) {
    return null;
  }

  return { anio, mes, dia };
}

export function formatearFechaVisible(fecha: string): string {
  const partes = partesFecha(fecha);
  if (!partes) {
    return fecha;
  }
  return `${String(partes.dia).padStart(2, '0')}/${String(partes.mes).padStart(2, '0')}/${partes.anio}`;
}

export function formatearFechaHoraVisible(fecha: string): string {
  const coincidencia = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?/.exec(fecha.trim());
  if (!coincidencia || !coincidencia[1]) {
    return fecha;
  }

  const fechaVisible = formatearFechaVisible(coincidencia[1]);
  return coincidencia[2] ? `${fechaVisible} ${coincidencia[2]}` : fechaVisible;
}

export function fechaISO(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

export function primerDiaSemanaLunes(anio: number, mes: number): number {
  return (new Date(anio, mes - 1, 1).getDay() + 6) % 7;
}

export function celdasDelMes(anio: number, mes: number): (number | null)[] {
  const celdas: (number | null)[] = Array(primerDiaSemanaLunes(anio, mes)).fill(null);
  for (let dia = 1; dia <= diasDelMes(anio, mes); dia += 1) {
    celdas.push(dia);
  }
  while (celdas.length % 7 !== 0) {
    celdas.push(null);
  }
  return celdas;
}
