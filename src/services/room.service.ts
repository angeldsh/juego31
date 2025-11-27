import { Injectable } from '@angular/core';
import { Database, ref, set, get, onValue, off } from '@angular/fire/database';
import { Observable } from 'rxjs';
import { Room, Player, OpponentAction } from '../types/types';

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  suits = ['C', 'O', 'E', 'B'];
  values = ['1', '2', '3', '4', '5', '6', '7', 'S', 'C', 'R'];

  // Agregar las imágenes de celebración al servicio
  private celebrationImages: string[] = [
    'assets/a.jpeg',
    'assets/b.jpeg',
    'assets/c.jpeg',
    'assets/d.jpeg',
    'assets/e.jpeg',
    'assets/f.jpeg',
    'assets/g.jpeg',
    'assets/h.jpeg',
    'assets/i.jpeg',
    'assets/j.jpeg',
    'assets/k.jpeg',
    'assets/l.jpeg',
    'assets/m.jpeg',
    'assets/n.jpeg',
    'assets/o.jpeg',
    'assets/p.jpeg',
    'assets/q.jpeg',
    'assets/r.jpeg',
    'assets/s.jpeg',
    'assets/t.jpeg',
    'assets/u.jpeg',
    'assets/w.jpeg',
    'assets/x.jpeg',
    'assets/y.jpeg',
    'assets/z.jpeg',
    'assets/ñ.jpeg'
  ];

  // Método para generar imagen aleatoria
  private getRandomCelebrationImage(): string {
    const randomIndex = Math.floor(Math.random() * this.celebrationImages.length);
    return this.celebrationImages[randomIndex];
  }

  constructor(private db: Database) { }

  async createRoom(playerName: string): Promise<string> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const deck = this.generateDeck();
    const playerCards = this.drawCards(deck, 3);

    const roomData: Room = {
      players: [
        { name: playerName, cards: playerCards, lives: 3, sessionWins: 0 }
      ],
      deck,
      discardPile: [],
      turn: playerName,
      status: 'waiting'
    };

    const roomRef = ref(this.db, `rooms/${code}`);
    await set(roomRef, roomData);
    return code;
  }

  async joinRoom(code: string, playerName: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
      console.error('La sala no existe');
      return false;
    }

    const roomData = snapshot.val() as Room;

    // Validar que roomData y sus propiedades existan
    if (!roomData || !roomData.players || !Array.isArray(roomData.players)) {
      console.error('Datos de la sala inválidos:', roomData);
      return false;
    }

    // Verificar si el jugador ya está en la sala
    if (roomData.players.some(player => player.name === playerName)) {
      console.error('El jugador ya está en la sala');
      return false;
    }

    // Verificar que el deck existe y tiene cartas suficientes
    if (!roomData.deck || roomData.deck.length < 3) {
      console.error('No hay suficientes cartas en el deck');
      return false;
    }

    // Repartir cartas y actualizar el deck
    const playerCards: string[] = [];
    for (let i = 0; i < 3 && roomData.deck.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * roomData.deck.length);
      playerCards.push(roomData.deck.splice(randomIndex, 1)[0]);
    }

    const newPlayer: Player = {
      name: playerName,
      cards: playerCards,
      lives: 3,
      sessionWins: 0
    };

    // Actualizar los datos de la sala
    roomData.players.push(newPlayer);
    roomData.status = 'playing';

    // Asegurar que discardPile existe
    if (!roomData.discardPile) {
      roomData.discardPile = [];
    }

    // Solo agregar carta al discardPile si el deck tiene cartas
    if (roomData.deck.length > 0) {
      roomData.discardPile.push(roomData.deck.pop()!);
    }

    try {
      await set(roomRef, roomData);
      return true;
    } catch (error) {
      console.error('Error al actualizar la sala:', error);
      return false;
    }
  }

  subscribeToRoom(code: string): Observable<Room | null> {
    return new Observable(observer => {
      const roomRef = ref(this.db, `rooms/${code}`);

      const unsubscribe = onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
          observer.next(snapshot.val() as Room);
        } else {
          observer.next(null);
        }
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  generateDeck(): string[] {
    const deck = [];
    for (let s of this.suits) {
      for (let v of this.values) {
        deck.push(v + s);
      }
    }
    return deck.sort(() => Math.random() - 0.5);
  }

  drawCards(deck: string[], count: number): string[] {
    const cards: string[] = [];

    for (let i = 0; i < count && deck.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * deck.length);
      cards.push(deck.splice(randomIndex, 1)[0]); // Remover del deck original
    }

    return cards;
  }

  async updateRoom(code: string, roomData: Room) {
    const roomRef = ref(this.db, `rooms/${code}`);
    await set(roomRef, roomData);
  }

  async changeTurn(code: string, currentPlayerName: string): Promise<string> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return currentPlayerName;

    const roomData = snapshot.val() as Room;
    const currentIndex = roomData.players.findIndex(p => p.name === currentPlayerName);
    const nextIndex = (currentIndex + 1) % roomData.players.length;
    roomData.turn = roomData.players[nextIndex].name;

    await this.updateRoom(code, roomData);
    return roomData.turn;
  }

  async drawFromDeck(code: string, playerName: string): Promise<string | null> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return null;

    const roomData = snapshot.val() as Room;

    // Verificar que hay cartas en el deck
    if (!roomData.deck || roomData.deck.length === 0) {
      console.error('No hay cartas en el deck');
      return null;
    }

    // Robar carta del deck
    const drawnCard = roomData.deck.pop()!;

    // Trackear acción del oponente
    this.trackOpponentAction(roomData, playerName, {
      type: 'draw_deck',
      timestamp: Date.now()
    });

    await this.updateRoom(code, roomData);
    return drawnCard;
  }

  async drawFromDiscard(code: string, playerName: string): Promise<string | null> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return null;

    const roomData = snapshot.val() as Room;

    // Verificar que hay cartas en el descarte
    if (!roomData.discardPile || roomData.discardPile.length === 0) {
      console.error('No hay cartas en el descarte');
      return null;
    }

    // Robar la última carta del descarte
    const drawnCard = roomData.discardPile.pop()!;

    // Trackear acción del oponente
    this.trackOpponentAction(roomData, playerName, {
      type: 'draw_discard',
      cardDrawn: drawnCard,
      timestamp: Date.now()
    });

    await this.updateRoom(code, roomData);
    return drawnCard;
  }

  async swapCard(code: string, playerName: string, cardIndex: number, newCard: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return false;

    const roomData = snapshot.val() as Room;
    const player = roomData.players.find(p => p.name === playerName);

    if (!player || !player.cards || cardIndex >= player.cards.length) return false;

    // Inicializar discardPile si no existe
    if (!roomData.discardPile) {
      roomData.discardPile = [];
    }

    // Intercambiar cartas
    const oldCard = player.cards[cardIndex];
    roomData.discardPile.push(oldCard);
    player.cards[cardIndex] = newCard;

    // Trackear acción del oponente
    this.trackOpponentAction(roomData, playerName, {
      type: 'swap',
      cardDiscarded: oldCard,
      cardSwapped: newCard,
      timestamp: Date.now()
    });

    // Verificar si es el final de ronda (Checking closingPlayer adds robustness)
    const isRoundClosing = roomData.status === 'round_closing' || !!roomData.closingPlayer;

    if (isRoundClosing) {
      // Finalizar la ronda inmediatamente
      const result = await this.finishRoundInternal(roomData);
      await this.updateRoom(code, roomData);
      return true;
    } else {
      // Cambiar turno normalmente
      const currentIndex = roomData.players.findIndex(p => p.name === playerName);
      const nextIndex = (currentIndex + 1) % roomData.players.length;
      roomData.turn = roomData.players[nextIndex].name;

      await this.updateRoom(code, roomData);
      return true;
    }
  }

  async discardDrawnCard(code: string, playerName: string, cardToDiscard: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return false;

    const roomData = snapshot.val() as Room;

    // Inicializar discardPile si no existe
    if (!roomData.discardPile) {
      roomData.discardPile = [];
    }

    // Agregar la carta al descarte
    roomData.discardPile.push(cardToDiscard);

    // Trackear acción del oponente
    this.trackOpponentAction(roomData, playerName, {
      type: 'discard',
      cardDiscarded: cardToDiscard,
      timestamp: Date.now()
    });

    // Verificar si es el final de ronda (Checking closingPlayer adds robustness)
    const isRoundClosing = roomData.status === 'round_closing' || !!roomData.closingPlayer;

    if (isRoundClosing) {
      // Finalizar la ronda inmediatamente
      const result = await this.finishRoundInternal(roomData);
      await this.updateRoom(code, roomData);
      return true;
    } else {
      // Cambiar turno normalmente
      const currentIndex = roomData.players.findIndex(p => p.name === playerName);
      const nextIndex = (currentIndex + 1) % roomData.players.length;
      roomData.turn = roomData.players[nextIndex].name;

      await this.updateRoom(code, roomData);
      return true;
    }
  }

  // Nueva función para trackear acciones del oponente
  private trackOpponentAction(roomData: Room, playerName: string, action: OpponentAction) {
    // Inicializar opponentActions si no existe
    if (!roomData.opponentActions) {
      roomData.opponentActions = {};
    }

    // Inicializar array para el jugador si no existe
    if (!roomData.opponentActions[playerName]) {
      roomData.opponentActions[playerName] = [];
    }

    // Añadir la acción
    roomData.opponentActions[playerName].push(action);

    // Mantener solo las últimas 5 acciones para no sobrecargar
    if (roomData.opponentActions[playerName].length > 5) {
      roomData.opponentActions[playerName] = roomData.opponentActions[playerName].slice(-5);
    }
  }

  // Función para obtener la última acción del oponente específico
  getLastOpponentAction(roomData: Room, opponentName: string): OpponentAction | null {
    if (!roomData.opponentActions || !roomData.opponentActions[opponentName]) {
      return null;
    }
    const actions = roomData.opponentActions[opponentName];
    return actions.length > 0 ? actions[actions.length - 1] : null;
  }

  // Función para obtener las acciones del oponente
  getOpponentActions(roomData: Room, opponentName: string): OpponentAction[] {
    if (!roomData.opponentActions || !roomData.opponentActions[opponentName]) {
      return [];
    }
    return roomData.opponentActions[opponentName];
  }

  async plantarse(code: string, playerName: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return false;

    const roomData = snapshot.val() as Room;

    // Verificar si ya se está cerrando la ronda para evitar inconsistencias
    if (roomData.status === 'round_closing' || roomData.closingPlayer) {
      return false;
    }

    // Trackear acción del oponente
    this.trackOpponentAction(roomData, playerName, {
      type: 'discard',
      timestamp: Date.now()
    });

    // Cambiar turno al oponente para que tenga su último turno
    const currentIndex = roomData.players.findIndex(p => p.name === playerName);
    const nextIndex = (currentIndex + 1) % roomData.players.length;
    roomData.turn = roomData.players[nextIndex].name;

    // Cambiar el estado a round_closing DESPUÉS del cambio de turno
    roomData.status = 'round_closing';
    roomData.closingPlayer = playerName;

    await this.updateRoom(code, roomData);
    return true;
  }

  // Método para finalizar ronda (hacer público)
  async finishRound(code: string): Promise<any> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return null;

    const roomData = snapshot.val() as Room;
    const result = this.finishRoundInternal(roomData);

    if (result) {
      // Actualizar el estado con los resultados
      await this.updateRoom(code, roomData);
    }

    return result;
  }

  // Hacer público el método finishRoundInternal
  finishRoundInternal(roomData: Room): { winner: string, winnerPoints: number, loserPoints: number, isTie: boolean } | null {
    if (roomData.players.length !== 2) return null;

    // Calcular puntos de ambos jugadores
    const player1 = roomData.players[0];
    const player2 = roomData.players[1];

    const points1 = this.calculatePlayerPoints(player1.cards);
    const points2 = this.calculatePlayerPoints(player2.cards);

    // Generar imagen de celebración única para ambos jugadores
    const celebrationImage = this.getRandomCelebrationImage();

    // Verificar empate
    if (points1 === points2) {
      // En caso de empate, nadie pierde vidas
      roomData.status = 'waiting';
      roomData.lastWinner = 'EMPATE';
      roomData.lastWinnerPoints = points1;
      roomData.lastLoserPoints = points2;
      roomData.celebrationImage = celebrationImage;

      delete roomData.closingPlayer;

      return {
        winner: 'EMPATE',
        winnerPoints: points1,
        loserPoints: points2,
        isTie: true
      };
    }

    // Determinar ganador (MAYOR puntuación gana en el juego 31)
    let winner: Player, loser: Player;
    if (points1 > points2) {  // Cambiar < por >
      winner = player1;
      loser = player2;
    } else {
      winner = player2;
      loser = player1;
    }

    // El perdedor pierde una vida
    loser.lives--;

    // Actualizar estado de la sala
    roomData.status = loser.lives > 0 ? 'waiting' : 'finished';
    roomData.lastWinner = winner.name;
    roomData.lastWinnerPoints = this.calculatePlayerPoints(winner.cards);
    roomData.lastLoserPoints = this.calculatePlayerPoints(loser.cards);
    roomData.celebrationImage = celebrationImage;

    delete roomData.closingPlayer;

    // Incrementar contador de victorias de sesión
    if (!winner.sessionWins) winner.sessionWins = 0;
    winner.sessionWins++;

    return {
      winner: winner.name,
      winnerPoints: this.calculatePlayerPoints(winner.cards),
      loserPoints: this.calculatePlayerPoints(loser.cards),
      isTie: false
    };
  }

  // Agrupar cartas por palo (como en el componente)
  private calculatePlayerPoints(cards: string[]): number {
    const suitGroups: { [key: string]: number[] } = {};

    for (const card of cards) {
      const suit = card.charAt(card.length - 1); // Último carácter es el palo
      const value = card.charAt(0);
      let numericValue: number;

      switch (value) {
        case '1': numericValue = 11; break; // As vale 11
        case 'S': case 'C': case 'R': numericValue = 10; break; // Figuras valen 10
        default: numericValue = parseInt(value); break; // Números 2-7
      }

      if (!suitGroups[suit]) {
        suitGroups[suit] = [];
      }
      suitGroups[suit].push(numericValue);
    }

    // Encontrar el palo con la suma más alta
    let maxPoints = 0;
    for (const suit in suitGroups) {
      const sum = suitGroups[suit].reduce((a, b) => a + b, 0);
      if (sum > maxPoints) {
        maxPoints = sum;
      }
    }

    return maxPoints;
  }

  async startNewRound(code: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return false;

    const roomData = snapshot.val() as Room;

    // Reset room for new round
    const newDeck = this.generateDeck();

    // Deal new cards to all players
    roomData.players.forEach(player => {
      player.cards = this.drawCards(newDeck, 3);
    });

    // Set up discard pile
    roomData.discardPile = [this.drawCards(newDeck, 1)[0]];
    roomData.deck = newDeck;
    roomData.status = 'playing';

    // Randomize starting turn
    const randomPlayerIndex = Math.floor(Math.random() * roomData.players.length);
    roomData.turn = roomData.players[randomPlayerIndex].name;

    // Clear round-specific data
    delete roomData.closingPlayer;
    delete roomData.lastWinner;
    delete roomData.lastWinnerPoints;
    delete roomData.lastLoserPoints;
    delete roomData.celebrationImage;
    delete roomData.opponentActions; // Limpiar todas las acciones del oponente
    delete roomData.lastAction; // Limpiar la última acción también

    // SAFETY: Ensure closingPlayer is absolutely removed
    if (roomData.closingPlayer) delete roomData.closingPlayer;

    await this.updateRoom(code, roomData);
    return true;
  }
}