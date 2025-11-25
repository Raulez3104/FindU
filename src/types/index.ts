export interface LostItem {
  id: number;
  name: string;
  status: string;
  statusColor: string;
  imageUrl: string;
}

export interface Location {
  name: string;
  x: number;
  y: number;
  color: 'red' | 'green';
}

export type TabType = 'Todos' | 'Biblioteca' | 'Cafetería' | 'Aula'|'Laboratorio'|'Anfiteatro'|'Otros';
