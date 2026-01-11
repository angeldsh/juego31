import { Injectable } from '@angular/core';
import { Database, ref, set, get, onValue } from '@angular/fire/database';
import { Room, Player, OpponentAction } from '../types/types';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VentanitaRoomService {
  suits = ['C', 'O', 'E', 'B'];
  values = ['1', '2', '3', '4', '5', '6', '7', 'S', 'C', 'R'];
  
  private celebrationImages: string[] = [
    'assets/a.jpeg', 'assets/b.jpeg', 'assets/c.jpeg', 'assets/d.jpeg', 'assets/e.jpeg',
    'assets/f.jpeg', 'assets/g.jpeg', 'assets/h.jpeg', 'assets/i.jpeg', 'assets/j.jpeg',
    'assets/k.jpeg', 'assets/l.jpeg', 'assets/m.jpeg', 'assets/n.jpeg', 'assets/o.jpeg',
    'assets/p.jpeg', 'assets/q.jpeg', 'assets/r.jpeg', 'assets/s.jpeg', 'assets/t.jpeg',
    'assets/u.jpeg', 'assets/w.jpeg', 'assets/x.jpeg', 'assets/y.jpeg', 'assets/z.jpeg',
    'assets/ñ.jpeg'
  ];

  constructor(private db: Database) { }

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

  getLastOpponentAction(room: Room, opponentName: string): OpponentAction | null {
    if (!room.opponentActions || !room.opponentActions[opponentName] || room.opponentActions[opponentName].length === 0) {
      return null;
    }
    const actions = room.opponentActions[opponentName];
    return actions[actions.length - 1];
  }

  private getRandomCelebrationImage(): string {
    const randomIndex = Math.floor(Math.random() * this.celebrationImages.length);
    return this.celebrationImages[randomIndex];
  }

  calculateVentanitaScore(cards: string[]): number {
    if (!cards || !Array.isArray(cards)) return 0;

    let score = 0;
    for (const card of cards) {
      if (!card) continue;
      
      const value = card.substring(0, card.length - 1);
      
      // Reglas específicas de Ventanita
      if (value === 'S') { // Sota (10) -> 0 puntos
        score += 0;
      } else if (value === '1' || value === '2') { // As y Dos -> 2 puntos
        score += 2;
      } else if (value === 'C' || value === 'R') { // Caballo y Rey -> 10 puntos
        score += 10;
      } else {
        // Para 3, 4, 5, 6, 7 el valor es el número
        score += parseInt(value) || 0;
      }
    }
    return score;
  }

  async updateRoom(code: string, roomData: Room) {
    const roomRef = ref(this.db, `rooms/${code}`);
    await set(roomRef, roomData);
  }

  async createRoom(playerName: string): Promise<string> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const deck = this.generateDeck();

    const player: Player = {
      name: playerName,
      cards: [], // No se usan en ventanita
      lives: 3,
      sessionWins: 0,
      ventanitaCards: this.drawCards(deck, 4),
      visibleCards: [false, false, false, false],
      ventanitaWins: 0
    };

    const roomData: Room = {
      players: [player],
      deck,
      discardPile: [],
      turn: playerName,
      status: 'waiting',
      gameType: 'ventanita'
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

    if (!roomData || !roomData.players || !Array.isArray(roomData.players)) {
      return false;
    }

    if (roomData.players.some(player => player.name === playerName)) {
      return false;
    }

    // Verificar que el deck existe y tiene cartas suficientes
    if (!roomData.deck || roomData.deck.length < 4) {
      return false;
    }

    // Repartir cartas
    const ventanitaCards = [];
    for (let i = 0; i < 4 && roomData.deck.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * roomData.deck.length);
      ventanitaCards.push(roomData.deck.splice(randomIndex, 1)[0]);
    }

    const newPlayer: Player = {
      name: playerName,
      cards: [],
      lives: 3,
      sessionWins: 0,
      ventanitaCards: ventanitaCards,
      visibleCards: [false, false, false, false],
      ventanitaWins: 0
    };

    roomData.players.push(newPlayer);
    roomData.status = 'playing';
    
    // Asegurar discardPile
    if (!roomData.discardPile) roomData.discardPile = [];
    if (roomData.deck.length > 0) roomData.discardPile.push(roomData.deck.pop()!);

    try {
      await set(roomRef, roomData);
      return true;
    } catch (error) {
      console.error('Error al actualizar la sala:', error);
      return false;
    }
  }
  async drawFromDeck(code: string, playerName: string): Promise<string | null> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return null;

    const roomData = snapshot.val() as Room;

    // Block actions if waiting
    if (roomData.status === 'waiting') {
        console.warn('Cannot draw while waiting for new round');
        return null;
    }

    if (roomData.turn !== playerName) {
      console.warn(`drawFromDeck: Not ${playerName}'s turn. It is ${roomData.turn}'s turn.`);
      return null;
    }

    // Safety check: If it's round_closing and the turn is back to the closing player, finish the round immediately.
    if (roomData.status === 'round_closing' && roomData.closingPlayer === playerName) {
      console.warn('Turn returned to closing player in round_closing (drawFromDeck). Forcing finishRound.');
      await this.finishRound(code, roomData);
      return null;
    }

    // Handle empty deck by reshuffling discard pile
    if (!roomData.deck || roomData.deck.length === 0) {
      if (roomData.discardPile && roomData.discardPile.length > 1) {
        console.log('Deck empty. Reshuffling discard pile...');
        // Keep the top card of discard pile
        const topDiscard = roomData.discardPile.pop()!;
        
        // The rest becomes the new deck
        const newDeck = roomData.discardPile;
        
        // Shuffle newDeck
        for (let i = newDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
        }
        
        roomData.deck = newDeck;
        roomData.discardPile = [topDiscard]; // Only top card remains
        
        console.log(`Reshuffled. New deck size: ${roomData.deck.length}`);
      } else {
        console.warn('Deck is empty and not enough cards in discard to reshuffle.');
        return null;
      }
    }

    const card = roomData.deck.pop()!;

    if (!roomData.opponentActions) roomData.opponentActions = {};
    if (!roomData.opponentActions[playerName]) roomData.opponentActions[playerName] = [];

    roomData.opponentActions[playerName].push({
      type: 'draw_deck',
      timestamp: Date.now()
    });

    if (roomData.opponentActions[playerName].length > 5) {
      roomData.opponentActions[playerName].shift();
    }

    roomData.lastAction = {
      type: 'draw_deck',
      timestamp: Date.now()
    };

    await this.updateRoom(code, roomData);
    return card;
  }

  async drawFromDiscard(code: string, playerName: string): Promise<string | null> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return null;

    const roomData = snapshot.val() as Room;

    // Block actions if waiting
    if (roomData.status === 'waiting') return null;

    if (roomData.turn !== playerName) return null;

    // Safety check: If it's round_closing and the turn is back to the closing player, finish the round immediately.
    if (roomData.status === 'round_closing' && roomData.closingPlayer === playerName) {
      console.warn('Turn returned to closing player in round_closing. Forcing finishRound.');
      await this.finishRound(code, roomData);
      return null;
    }

    if (!roomData.discardPile || roomData.discardPile.length === 0) return null;

    const card = roomData.discardPile.pop()!;

    if (!roomData.opponentActions) roomData.opponentActions = {};
    if (!roomData.opponentActions[playerName]) roomData.opponentActions[playerName] = [];

    roomData.opponentActions[playerName].push({
      type: 'draw_discard',
      cardDrawn: card,
      timestamp: Date.now()
    });

    if (roomData.opponentActions[playerName].length > 5) {
      roomData.opponentActions[playerName].shift();
    }

    roomData.lastAction = {
      type: 'draw_discard',
      cardDrawn: card,
      timestamp: Date.now()
    };

    await this.updateRoom(code, roomData);
    return card;
  }

  async discardVentanitaDrawnCard(code: string, playerName: string, card: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) return false;

    const roomData = snapshot.val() as Room;
    
    if (!roomData.discardPile) roomData.discardPile = [];
    roomData.discardPile.push(card);

    if (!roomData.opponentActions) roomData.opponentActions = {};
    if (!roomData.opponentActions[playerName]) roomData.opponentActions[playerName] = [];
    
    roomData.opponentActions[playerName].push({
      type: 'discard',
      timestamp: Date.now(),
      cardDiscarded: card
    });

    const playerIndex = roomData.players.findIndex(p => p.name === playerName);
    if (playerIndex === -1) {
        console.error('Jugador no encontrado en discardVentanitaDrawnCard');
        return false;
    }

    const nextIndex = (playerIndex + 1) % roomData.players.length;
    const nextPlayerName = roomData.players[nextIndex].name;

    console.log(`[Ventanita Discard] Player: ${playerName}, Next: ${nextPlayerName}, Status: ${roomData.status}, ClosingPlayer: ${roomData.closingPlayer}`);

    // LOGIC FIX: In a 2-player game, if we are in round_closing, ANY discard/swap means the round ends.
    // Because: Player A closed. Player B played. Done.
    const isTwoPlayerGame = roomData.players.length === 2;
    const isRoundClosing = roomData.status === 'round_closing';
    const isReturningToCloser = roomData.closingPlayer === nextPlayerName;

    if (isRoundClosing && (isReturningToCloser || isTwoPlayerGame)) {
        console.log('Finalizando ronda Ventanita (Discard)...');
        await this.finishRound(code, roomData);
        return true;
    }

    roomData.turn = nextPlayerName;

    await this.updateRoom(code, roomData);
    return true;
  }

  async swapVentanitaCard(code: string, playerName: string, cardIndex: number, newCard: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) return false;

    const roomData = snapshot.val() as Room;
    const playerIndex = roomData.players.findIndex(p => p.name === playerName);
    if (playerIndex === -1) return false;

    const player = roomData.players[playerIndex];
    if (!player.ventanitaCards) return false;

    const oldCard = player.ventanitaCards[cardIndex];
    player.ventanitaCards[cardIndex] = newCard;

    if (!roomData.discardPile) roomData.discardPile = [];
    roomData.discardPile.push(oldCard);

    if (!roomData.opponentActions) roomData.opponentActions = {};
    if (!roomData.opponentActions[playerName]) roomData.opponentActions[playerName] = [];
    
    roomData.opponentActions[playerName].push({
      type: 'swap',
      timestamp: Date.now(),
      cardSwapped: oldCard
    });

    const nextIndex = (playerIndex + 1) % roomData.players.length;
    const nextPlayerName = roomData.players[nextIndex].name;

    console.log(`[Ventanita Swap] Player: ${playerName}, Next: ${nextPlayerName}, Status: ${roomData.status}, ClosingPlayer: ${roomData.closingPlayer}`);

    // LOGIC FIX: In a 2-player game, if we are in round_closing, ANY discard/swap means the round ends.
    const isTwoPlayerGame = roomData.players.length === 2;
    const isRoundClosing = roomData.status === 'round_closing';
    const isReturningToCloser = roomData.closingPlayer === nextPlayerName;

    if (isRoundClosing && (isReturningToCloser || isTwoPlayerGame)) {
        console.log('Finalizando ronda Ventanita (Swap)...');
        await this.finishRound(code, roomData);
        return true;
    }

    roomData.turn = nextPlayerName;

    await this.updateRoom(code, roomData);
    return true;
  }

  async plantarse(code: string, playerName: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return false;

    const roomData = snapshot.val() as Room;

    if (roomData.status === 'round_closing') {
      return false;
    }

    roomData.status = 'round_closing';
    roomData.closingPlayer = playerName;

    const currentIndex = roomData.players.findIndex(p => p.name === playerName);
    const nextIndex = (currentIndex + 1) % roomData.players.length;
    roomData.turn = roomData.players[nextIndex].name;

    await this.updateRoom(code, roomData);
    return true;
  }

  async finishRound(code: string, roomData: Room) {
    console.log('Starting finishRound for room:', code);
    try {
      if (!roomData.players || roomData.players.length === 0) {
        throw new Error('No players in room');
      }

      const playerScores = roomData.players.map(player => {
        let score = 0;
        // Solo lógica Ventanita
        score = this.calculateVentanitaScore(player.ventanitaCards || []);
        player.visibleCards = [true, true, true, true];
        
        return {
          name: player.name,
          score: score,
          lives: player.lives
        };
      });

      console.log('Player scores:', playerScores);

      let highestScore = -1;
      let lowestScore = 1000; // Increased safety margin

      playerScores.forEach(p => {
        if (p.score > highestScore) highestScore = p.score;
        if (p.score < lowestScore) lowestScore = p.score;
      });

      // Ventanita: Gana el MENOR puntaje
      const winners = playerScores.filter(p => p.score === lowestScore);
      const losers = playerScores.filter(p => p.score === highestScore);

      if (winners.length === 0) {
        console.error('Error calculating winners', { winners, playerScores });
        // Fallback: pick first player as winner
        winners.push(playerScores[0]);
        lowestScore = playerScores[0].score;
      }
      
      let winnerName = winners.length > 1 ? 'EMPATE' : winners[0].name;
      const loserName = losers.length > 0 ? losers[0].name : ''; 
      
      roomData.lastWinner = winnerName;
      roomData.lastWinnerPoints = lowestScore;
      roomData.lastLoser = loserName;
      roomData.lastLoserPoints = highestScore;

      if (winnerName !== 'EMPATE') {
          const winnerPlayer = roomData.players.find(p => p.name === winnerName);
          if (winnerPlayer) {
            const previousWins = winnerPlayer.ventanitaWins || 0;
            if (!winnerPlayer.ventanitaWins) winnerPlayer.ventanitaWins = 0;
            
            // If player ALREADY had 4 wins and wins again, they win the SESSION.
            if (previousWins >= 4) {
                 winnerPlayer.sessionWins = (winnerPlayer.sessionWins || 0) + 1;
                 // Reset ventanita wins for everyone to start fresh session
                 roomData.players.forEach(p => p.ventanitaWins = 0);
                 winnerName = `${winnerName} (¡GANADOR DE LA PARTIDA!)`;
            } else {
                 winnerPlayer.ventanitaWins++;
            }
          }
      }

      roomData.celebrationImage = this.getRandomCelebrationImage();
      roomData.status = 'waiting';
      delete roomData.closingPlayer;
      roomData.opponentActions = {};
      delete roomData.lastAction;

      console.log(`Round finished. Winner: ${winnerName}, Status set to waiting.`);
      await this.updateRoom(code, roomData);
    } catch (error) {
      console.error('CRITICAL ERROR in finishRound:', error);
      // Attempt to force state reset to avoid infinite loop
      try {
        roomData.status = 'waiting';
        // Set dummy values if needed
        if (!roomData.lastWinner) {
            roomData.lastWinner = 'Error';
            roomData.lastWinnerPoints = 0;
        }
        await this.updateRoom(code, roomData);
      } catch (e) {
        console.error('Failed to recover from finishRound error:', e);
      }
    }
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
      cards.push(deck.splice(randomIndex, 1)[0]);
    }
    return cards;
  }

  async startNewRound(code: string): Promise<boolean> {
    const roomRef = ref(this.db, `rooms/${code}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return false;

    const roomData = snapshot.val() as Room;
    
    const deck = this.generateDeck();
    roomData.deck = deck;
    roomData.discardPile = [];
    
    roomData.players.forEach(player => {
        player.ventanitaCards = this.drawCards(deck, 4);
        
        // Logic for visible cards: 
        // 1 win = 1 visible card
        // 2 wins = 2 visible cards, etc.
        const wins = player.ventanitaWins || 0;
        player.visibleCards = [false, false, false, false];
        
        for(let i=0; i < wins && i < 4; i++) {
            player.visibleCards[i] = true;
        }

        player.cards = [];
    });

    roomData.status = 'playing';
    delete roomData.closingPlayer;
    delete roomData.lastWinner;
    delete roomData.lastWinnerPoints;
    roomData.opponentActions = {};
    delete roomData.lastAction;

    if (roomData.lastLoser) {
      roomData.turn = roomData.lastLoser;
    } else {
      const randomPlayerIndex = Math.floor(Math.random() * roomData.players.length);
      roomData.turn = roomData.players[randomPlayerIndex].name;
    }

    await this.updateRoom(code, roomData);
    return true;
  }
}
