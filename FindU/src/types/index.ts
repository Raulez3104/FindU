export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  foto: string | null;
}

export interface Sesion {
  token: string;
  expiraEn: number;
  usuario: Usuario;
}

export interface LostItem {
  id: number;
  name: string;
  status: string;
  statusColor: string;
  imageUrl: string | null;
  categoria: string;
  fechaIncidente: string;
  fechaCreacion: string;
  campus: string;
  ubicacion: string;
  tipo: 'perdido' | 'encontrado';
  estado: string;
  autor: string | null;
}

export interface Location {
  name: string;
  x: number;
  y: number;
  color: 'red' | 'green';
}

export type TabType =
  | 'Todos'
  | 'Biblioteca'
  | 'Cafetería'
  | 'Aula'
  | 'Laboratorio'
  | 'Anfiteatro'
  | 'Otros';
