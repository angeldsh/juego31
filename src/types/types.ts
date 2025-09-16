export interface Player {
  name: string;
  cards: string[];
  lives: number;
}

export interface Room {
  players: Player[];
  deck: string[];
  discardPile: string[];
  turn: string;
  status: 'waiting' | 'playing' | 'round_closing' | 'finished';
  closingPlayer?: string;
  lastWinner?: string;
  lastWinnerPoints?: number;
  lastLoserPoints?: number;
  celebrationImage?: string; // Nueva propiedad para la imagen compartida
}