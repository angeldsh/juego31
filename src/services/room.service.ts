import { Injectable } from '@angular/core';
import { Database, ref, set, get, onValue, off } from '@angular/fire/database';
import { Observable } from 'rxjs';
import { Room, Player } from '../types/types';

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  suits = ['C', 'O', 'E', 'B'];
  values = ['1','2','3','4','5','6','7','S','C','R'];

  constructor(private db: Database) {}

  async createRoom(playerName: string): Promise<string> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const deck = this.generateDeck();
    const playerCards = this.drawCards(deck, 3);
    
    const roomData: Room = {
      players: [
        { name: playerName, cards: playerCards, lives: 3 }
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
      lives: 3
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
      
      return () => off(roomRef, 'value', unsubscribe);
    });
  }

  generateDeck(): string[] {
    const deck = [];
    for (let s of this.suits) {
      for (let v of this.values) {
        deck.push(v+s);
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
    
    // Verificar si es el final de ronda
    const isRoundClosing = roomData.status === 'round_closing';
    
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
    
    // Verificar si es el final de ronda
    const isRoundClosing = roomData.status === 'round_closing';
    
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
  private finishRoundInternal(roomData: Room): { winner: string, winnerPoints: number, loserPoints: number, isTie: boolean } | null {
    if (roomData.players.length !== 2) return null;
    
    // Calcular puntos de ambos jugadores
    const player1 = roomData.players[0];
    const player2 = roomData.players[1];
    
    const points1 = this.calculatePlayerPoints(player1.cards);
    const points2 = this.calculatePlayerPoints(player2.cards);
    
    // Verificar empate
    if (points1 === points2) {
      // En caso de empate, nadie pierde vidas
      roomData.status = 'waiting';
      roomData.lastWinner = 'EMPATE';
      roomData.lastWinnerPoints = points1;
      roomData.lastLoserPoints = points2;
      
      delete roomData.closingPlayer;
      
      return {
        winner: 'EMPATE',
        winnerPoints: points1,
        loserPoints: points2,
        isTie: true
      };
    }
    
    // Determinar ganador (MAYOR puntuación gana)
    const winner = points1 >= points2 ? player1 : player2;
    const loser = points1 >= points2 ? player2 : player1;
    const winnerPoints = Math.max(points1, points2);
    const loserPoints = Math.min(points1, points2);
    
    // Restar vida al perdedor
    loser.lives -= 1;
    
    // Actualizar estado de la sala
    roomData.status = loser.lives <= 0 ? 'finished' : 'waiting';
    roomData.lastWinner = winner.name;
    roomData.lastWinnerPoints = winnerPoints;
    roomData.lastLoserPoints = loserPoints;
    
    delete roomData.closingPlayer;
    
    return {
      winner: winner.name,
      winnerPoints,
      loserPoints,
      isTie: false
    };
  }

  async closeRound(code: string, playerName: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);
    
    if (!snapshot.exists()) return false;
    
    const roomData = snapshot.val() as Room;
    
    // Verificar que es el turno del jugador
    if (roomData.turn !== playerName) {
      console.error('No es el turno del jugador');
      return false;
    }
    
    // Marcar que el jugador se plantó
    roomData.status = 'round_closing';
    roomData.closingPlayer = playerName;
    
    // Cambiar turno al otro jugador DIRECTAMENTE
    const currentIndex = roomData.players.findIndex(p => p.name === playerName);
    const nextIndex = (currentIndex + 1) % roomData.players.length;
    roomData.turn = roomData.players[nextIndex].name;
    
    await this.updateRoom(code, roomData);
    return true;
  }


  async finishRound(code: string): Promise<{ winner: string, winnerPoints: number, loserPoints: number, isTie: boolean } | null> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);
    
    if (!snapshot.exists()) return null;
    
    const roomData = snapshot.val() as Room;
    const result = this.finishRoundInternal(roomData);
    
    if (result) {
      // Actualizar el estado con los resultados
      await this.updateRoom(code, roomData);
      
      // NO REINICIAR AUTOMÁTICAMENTE AQUÍ - lo hará el componente
      // El componente manejará el reinicio después de mostrar la imagen
    }
    
    return result;
  }

  // MEJORAR el método para reiniciar ronda
  async startNewRound(code: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);
    
    if (!snapshot.exists()) return false;
    
    const roomData = snapshot.val() as Room;
    
    // Solo reiniciar si todos los jugadores están vivos
    const allPlayersAlive = roomData.players.every(player => player.lives > 0);
    
    if (allPlayersAlive && roomData.status === 'waiting') {
      // Limpiar TODAS las propiedades del ganador anterior
      delete roomData.lastWinner;
      delete roomData.lastWinnerPoints;
      delete roomData.lastLoserPoints;
      delete roomData.closingPlayer;
      
      // Generar nuevo mazo completamente mezclado
      roomData.deck = this.generateDeck();
      roomData.discardPile = [];
      
      // Dar 3 cartas nuevas a cada jugador
      roomData.players.forEach(player => {
        player.cards = this.drawCards(roomData.deck, 3);
      });
      
      // Agregar carta inicial al descarte
      if (roomData.deck.length > 0) {
        roomData.discardPile.push(roomData.deck.pop()!);
      }
      
      // El primer jugador empieza la nueva ronda
      roomData.turn = roomData.players[0].name;
      roomData.status = 'playing';
      
      await this.updateRoom(code, roomData);
      return true;
    }
    
    return false;
  }

  private calculatePlayerPoints(cards: string[]): number {
    // Agrupar cartas por palo (como en el componente)
    const suitGroups: { [key: string]: number[] } = {};
    
    for (const card of cards) {
      const suit = card.charAt(card.length - 1); // Último carácter es el palo
      const value = card.charAt(0);
      let numericValue: number;
      
      switch(value) {
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
}