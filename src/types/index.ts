export interface LostItem {
  id: number;
  name: string;
  status: string;
  statusColor: string;
  icon: string;
}

export interface Location {
  name: string;
  x: number;
  y: number;
  color: 'red' | 'green';
}

export type TabType = 'Todos' | 'Biblioteca' | 'Cafetería' | 'Cursos';