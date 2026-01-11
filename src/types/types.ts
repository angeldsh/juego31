export interface Player {
  name: string;
  cards: string[];
  lives: number;
  sessionWins?: number;
  // Propiedades específicas de Ventanita
  ventanitaCards?: string[]; // Las 4 cartas del jugador
  visibleCards?: boolean[]; // Estado de visibilidad de las 4 cartas (true = boca arriba)
  ventanitaWins?: number; // Rondas ganadas en ventanita
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
  gameType: '31' | 'ventanita'; // Nuevo campo para el tipo de juego
  closingPlayer?: string;
  lastWinner?: string;
  lastLoser?: string; // Nuevo campo para guardar el perdedor
  lastWinnerPoints?: number;
  lastLoserPoints?: number;
  celebrationImage?: string; // Nueva propiedad para la imagen de celebración
  opponentActions?: { [playerName: string]: OpponentAction[] };
  lastAction?: OpponentAction; // Restaurar esta línea
}