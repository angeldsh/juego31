export interface Player {
  name: string;
  cards: string[];
  lives: number;
}

export interface OpponentAction {
  type: 'draw_deck' | 'draw_discard' | 'discard' | 'swap';
  cardDrawn?: string; // Carta que robó (si es visible)
  cardDiscarded?: string; // Carta que descartó
  cardSwapped?: string; // Carta que intercambió
  timestamp: number;
}

export interface Room {
  players: Player[];
  deck: string[];
  discardPile: string[];
  turn: string;
  status: 'waiting' | 'playing' | 'finished' | 'round_closing';
  closingPlayer?: string;
  lastWinner?: string;
  lastWinnerPoints?: number;
  lastLoserPoints?: number;
  celebrationImage?: string; // Nueva propiedad para la imagen de celebración
  opponentActions?: { [playerName: string]: OpponentAction[] };
  lastAction?: OpponentAction; // Restaurar esta línea
}