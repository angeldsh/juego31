import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { VentanitaRoomService } from '../../services/ventanita-room.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { OpponentActionsComponent } from '../opponent-actions/opponent-actions.component';
import { OpponentAction } from '../../types/types';

@Component({
  selector: 'app-ventanita-game',
  templateUrl: './ventanita-game.component.html',
  styleUrls: ['./ventanita-game.component.css'],
  imports: [FormsModule, CommonModule, OpponentActionsComponent],
  standalone: true
})
export class VentanitaGameComponent implements OnInit, OnDestroy {
  @Input() room: any;
  @Input() playerName: string = '';
  @Input() roomCode: string = '';

  private roomSubscription?: Subscription;
  ventanitaCards: string[] = [];
  visibleCards: boolean[] = [];
  ventanitaWins: number = 0;
  isYourTurn: boolean = false;
  drawnCard: string | null = null;
  selectedCardIndex: number = -1;

  // Nuevas propiedades para animaciones
  cardAnimations: { [key: number]: { entering: boolean, leaving: boolean } } = {};
  showDrawnCardAnimation: boolean = false;
  isDrawingFromDeck: boolean = false;
  showWinnerImage: boolean = false;
  isHandlingRoundEnd: boolean = false;
  lastWinnerProcessed: string | null = null;

  winnerImageSrc: string = '';
  winnerText: string = '';

  constructor(private ventanitaRoomService: VentanitaRoomService) { }

  ngOnInit() {
    this.updateState();
    // Suscribirse a actualizaciones de la sala usando Observable
    this.roomSubscription = this.ventanitaRoomService.subscribeToRoom(this.roomCode).subscribe({
      next: (updatedRoom) => {
        this.room = updatedRoom;
        this.updateState();
      },
      error: (error) => {
        console.error('Error en la suscripción de la sala:', error);
      }
    });
  }

  ngOnDestroy() {
    if (this.roomSubscription) {
      this.roomSubscription.unsubscribe();
    }
  }

  updateState() {
    if (!this.room || !this.room.players) return;

    // Debug logging
    console.log(`[Ventanita] UpdateState: Status=${this.room.status}, Turn=${this.room.turn}, Me=${this.playerName}`);
    if (this.room.status === 'round_closing') {
      console.log(`[Ventanita] Closing player: ${this.room.closingPlayer}`);
    }

    const player = this.room.players.find((p: any) => p.name === this.playerName);
    if (player) {
      this.isYourTurn = (this.room.turn === this.playerName);
      
      this.ventanitaCards = player.ventanitaCards || [];
      this.visibleCards = player.visibleCards || [false, false, false, false];
      this.ventanitaWins = player.ventanitaWins || 0;

      // Solo limpiar cartas si NO es tu turno Y NO estás en round_closing
      if (!this.isYourTurn && this.room.status !== 'round_closing') {
        this.drawnCard = null;
        this.selectedCardIndex = -1;
      }

      // Detectar si la ronda ha terminado y mostrar resultados (SOLO UNA VEZ)
      if (this.room.status === 'waiting' && this.room.lastWinner && !this.showWinnerImage && !this.isHandlingRoundEnd) {
         // Evitar bucle infinito si ya procesamos este ganador
         if (this.lastWinnerProcessed !== this.room.lastWinner + this.room.lastWinnerPoints) {
            this.handleRoundEnd();
         }
      }

      // Limpiar estado cuando se inicia nueva ronda
      if (this.room.status === 'playing') {
        if (!this.room.lastWinner) {
            this.lastWinnerProcessed = null;
            this.drawnCard = null;
            this.selectedCardIndex = -1;
            this.showWinnerImage = false;
            this.isHandlingRoundEnd = false;
        }
      }
    }
  }

  async drawFromDeck() {
    if (!this.isYourTurn || this.drawnCard) return;

    try {
      this.isDrawingFromDeck = true;
      setTimeout(() => {
        this.isDrawingFromDeck = false;
      }, 600);

      console.log('Drawing from deck...');
      const newCard = await this.ventanitaRoomService.drawFromDeck(this.roomCode, this.playerName);
      if (newCard) {
        this.drawnCard = newCard;
        setTimeout(() => {
          this.showDrawnCardAnimation = true;
        }, 300);
      } else {
        console.warn('drawFromDeck returned null');
      }
    } catch (error) {
      console.error('Error al robar del mazo:', error);
      this.isDrawingFromDeck = false;
    }
  }

  async drawFromDiscard() {
    if (!this.isYourTurn || this.drawnCard || !this.canDrawFromDiscard()) {
      console.log('Cannot draw from discard:', { isYourTurn: this.isYourTurn, hasDrawnCard: !!this.drawnCard, canDraw: this.canDrawFromDiscard() });
      return;
    }

    try {
      console.log('Drawing from discard...');
      const newCard = await this.ventanitaRoomService.drawFromDiscard(this.roomCode, this.playerName);
      if (newCard) {
        this.drawnCard = newCard;
        setTimeout(() => {
          this.showDrawnCardAnimation = true;
        }, 100);
      } else {
         console.warn('drawFromDiscard returned null');
      }
    } catch (error) {
      console.error('Error al robar del descarte:', error);
      await Swal.fire({
        title: 'Error',
        text: 'No se pudo robar del descarte',
        icon: 'error',
        toast: true,
        position: 'top-end',
        timer: 3000
      });
    }
  }

  getDeckCount(): number {
    return this.room?.deck?.length || 0;
  }

  canDrawFromDiscard(): boolean {
    return this.room?.discardPile && this.room.discardPile.length > 0 && !this.drawnCard && this.isYourTurn;
  }

  get canCloseRound(): boolean {
    // En Ventanita se puede cerrar siempre que sea tu turno y no tengas carta robada
    return this.isYourTurn && !this.drawnCard && this.room.status !== 'round_closing';
  }

  getCardValue(card: string): string {
    const value = card.charAt(0);
    switch (value) {
      case 'S': return 'Sota';
      case 'C': return 'Caballo';
      case 'R': return 'Rey';
      default: return value;
    }
  }

  getCardSuit(card: string): string {
    return card.charAt(card.length - 1);
  }

  getSuitSymbol(suit: string): string {
    switch (suit) {
      case 'C': return '♥';
      case 'O': return '🔶';
      case 'E': return '♠';
      case 'B': return '♣';
      default: return suit;
    }
  }

  getCardImagePath(card: string): string {
    return `assets/cards/${card}.png`;
  }

  getCardDisplayName(card: string): string {
    const value = this.getCardValue(card);
    const suit = this.getCardSuit(card);
    const suitName = this.getSuitName(suit);
    return `${value} de ${suitName}`;
  }

  getSuitName(suit: string): string {
    switch (suit) {
      case 'C': return 'Copas';
      case 'O': return 'Oros';
      case 'E': return 'Espadas';
      case 'B': return 'Bastos';
      default: return suit;
    }
  }

  onImageError(event: any, card: string): void {
    console.warn(`No se pudo cargar la imagen para la carta: ${card}`);
    const img = event.target;
    const cardElement = img.parentElement;
    const fallback = cardElement.querySelector('.card-fallback');

    img.style.display = 'none';
    if (fallback) {
      fallback.style.display = 'flex';
    }
  }

  getPlayerIcon(): string {
    if (this.playerName === 'Aguila' || this.playerName === 'Águila') {
      return '🦅';
    } else if (this.playerName === 'Lince') {
      return '🐱';
    }
    if (this.playerName.toLowerCase().includes('aguila') || this.playerName.toLowerCase().includes('águila')) {
      return '🦅';
    } else if (this.playerName.toLowerCase().includes('lince')) {
      return '🐾';
    }
    return '👤';
  }

  getOpponent() {
    if (!this.room || !this.room.players || this.room.players.length < 2) {
      return null;
    }
    return this.room.players.find((p: any) => p.name !== this.playerName);
  }

  getOpponentLastAction(): OpponentAction | undefined {
    const opponent = this.getOpponent();
    if (!opponent || !this.room) {
      return undefined;
    }
    const action = this.ventanitaRoomService.getLastOpponentAction(this.room, opponent.name);
    return action || undefined;
  }

  getSessionScore(): string {
    if (!this.room || !this.room.players || this.room.players.length < 2) {
      return '';
    }
    const p1 = this.room.players[0];
    const p2 = this.room.players[1];
    const score1 = p1.ventanitaWins || 0;
    const score2 = p2.ventanitaWins || 0;
    return `${score1} - ${score2}`;
  }

  calculateVentanitaScoreLocal(): number {
    if (!this.ventanitaCards) return 0;
    
    let score = 0;
    for (const card of this.ventanitaCards) {
      const value = card.substring(0, card.length - 1);
      if (value === 'S') score += 0;
      else if (value === '1' || value === '2') score += 2;
      else if (value === 'C' || value === 'R') score += 10;
      else score += parseInt(value);
    }
    return score;
  }

  async plantarseVentanita() {
    if (!this.isYourTurn) {
        await Swal.fire({
          title: 'No es tu turno',
          text: 'Espera a que sea tu turno para cerrar',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        return;
    }

    try {
        const score = this.calculateVentanitaScoreLocal();
        const success = await this.ventanitaRoomService.plantarse(this.roomCode, this.playerName);
        
        if (success) {
            await Swal.fire({
                title: '🔒 ¡Cerrado!',
                html: `<div style="text-align: center; font-size: 16px;">
                        <span style="color: #27ae60; font-weight: 700; font-size: 18px;">${score} puntos</span>
                        <br>
                        <small style="color: #666; margin-top: 4px; display: block; font-size: 13px;">Ronda final para los demás</small>
                       </div>`,
                icon: 'success',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true,
                toast: true,
                position: 'top'
            });
        }
    } catch (error) {
        console.error('Error al plantarse en Ventanita:', error);
    }
  }

  getVentanitaCardImage(index: number): string {
    if (this.visibleCards && this.visibleCards[index]) {
      return this.getCardImagePath(this.ventanitaCards[index]);
    }
    return 'assets/cards/RV.png';
  }

  async discardVentanitaDrawnCard() {
    if (!this.drawnCard) return;

    try {
      const success = await this.ventanitaRoomService.discardVentanitaDrawnCard(this.roomCode, this.playerName, this.drawnCard);
      if (success) {
        this.drawnCard = null;
        this.showDrawnCardAnimation = false;
      } else {
        console.error('No se pudo descartar la carta en Ventanita');
        await Swal.fire({
          title: 'Error',
          text: 'No se pudo descartar la carta. Intenta de nuevo.',
          icon: 'error',
          toast: true,
          position: 'top',
          timer: 3000
        });
      }
    } catch (error) {
      console.error('Error al descartar carta en Ventanita:', error);
      this.drawnCard = null;
      this.showDrawnCardAnimation = false;
      await Swal.fire({
        title: 'Error',
        text: 'Ocurrió un error al descartar.',
        icon: 'error',
        toast: true,
        position: 'top',
        timer: 3000
      });
    }
  }

  async swapVentanitaCard(index: number) {
    if (!this.drawnCard) return;

    try {
      this.cardAnimations[index] = { entering: false, leaving: true };

      setTimeout(async () => {
        try {
          const success = await this.ventanitaRoomService.swapVentanitaCard(
            this.roomCode, 
            this.playerName, 
            index, 
            this.drawnCard!
          );

          if (success) {
            this.cardAnimations[index] = { entering: true, leaving: false };
            setTimeout(() => {
              this.cardAnimations[index] = { entering: false, leaving: false };
            }, 600);
            
            this.drawnCard = null;
            this.showDrawnCardAnimation = false;
          } else {
            this.cardAnimations[index] = { entering: false, leaving: false };
            await Swal.fire({
              title: 'Error',
              text: 'No se pudo intercambiar la carta.',
              icon: 'error',
              toast: true,
              position: 'top',
              timer: 3000
            });
          }
        } catch (innerError) {
             console.error('Inner error swapVentanitaCard:', innerError);
             this.cardAnimations[index] = { entering: false, leaving: false };
        }
      }, 400);

    } catch (error) {
      console.error('Error al intercambiar carta en Ventanita:', error);
      this.cardAnimations[index] = { entering: false, leaving: false };
    }
  }

  async handleRoundEnd() {
    if (this.isHandlingRoundEnd || this.showWinnerImage) return;

    if (this.room?.status === 'waiting' && this.room.lastWinner) {
      this.isHandlingRoundEnd = true;
      this.lastWinnerProcessed = this.room.lastWinner + this.room.lastWinnerPoints;

      const winner = this.room.lastWinner;
      const winnerPoints = this.room.lastWinnerPoints || 0;

      this.winnerImageSrc = this.room.celebrationImage || 'assets/a.jpeg';

      if (winner === 'EMPATE') {
        this.winnerText = `¡Empate! Ambos con ${winnerPoints} puntos`;
      } else {
        this.winnerText = `¡${winner} ganó con ${winnerPoints} puntos!`;
      }

      this.showWinnerImage = true;

      setTimeout(async () => {
        this.showWinnerImage = false;

        const isHost = this.room.players && this.room.players.length > 0 && this.room.players[0].name === this.playerName;
        
        if (isHost) {
           await this.ventanitaRoomService.startNewRound(this.roomCode);
        }

        this.isHandlingRoundEnd = false;
      }, 4000);
    }
  }
}
