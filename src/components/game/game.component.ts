import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { RoomService } from '../../services/room.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css'],
  imports: [FormsModule, CommonModule],
  standalone: true
})
export class GameComponent implements OnInit, OnDestroy {
  @Input() room: any;
  @Input() playerName: string = '';
  @Input() roomCode: string = '';

  private roomSubscription?: Subscription;
  playerCards: string[] = [];
  isYourTurn: boolean = false;
  drawnCard: string | null = null;
  selectedCardIndex: number = -1;
  
  // Nuevas propiedades para animaciones
  cardAnimations: { [key: number]: { entering: boolean, leaving: boolean } } = {};
  showDrawnCardAnimation: boolean = false;
  isDrawingFromDeck: boolean = false;

  constructor(private roomService: RoomService) {}

  ngOnInit() {
    this.updateState();
    // Suscribirse a actualizaciones de la sala usando Observable
    this.roomSubscription = this.roomService.subscribeToRoom(this.roomCode).subscribe({
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
    
    const player = this.room.players.find((p: any) => p.name === this.playerName);
    if (player) {
      this.playerCards = player.cards || [];
      this.isYourTurn = (this.room.turn === this.playerName);
      
      // Solo limpiar cartas si NO es tu turno Y NO estás en round_closing
      if (!this.isYourTurn && this.room.status !== 'round_closing') {
        this.drawnCard = null;
        this.selectedCardIndex = -1;
      }
      
      // Detectar si la ronda ha terminado y mostrar resultados (SOLO UNA VEZ)
      if (this.room.status === 'waiting' && this.room.lastWinner && !this.showWinnerImage && !this.isHandlingRoundEnd) {
        this.handleRoundEnd();
      }
      
      // Limpiar estado cuando se inicia nueva ronda
      if (this.room.status === 'playing' && !this.room.lastWinner) {
        this.drawnCard = null;
        this.selectedCardIndex = -1;
        this.showWinnerImage = false;
        this.isHandlingRoundEnd = false;
      }
      
      // Manejar el final de ronda automáticamente
      if (this.room.status === 'round_closing' && this.isYourTurn) {
        console.log('Es tu último turno después de que el otro jugador se plantó');
      }
    }
  }

  async drawFromDeck() {
    if (!this.isYourTurn || this.drawnCard) return;
    
    try {
      // Activar animación del mazo
      this.isDrawingFromDeck = true;
      
      // Esperar un poco para la animación
      setTimeout(() => {
        this.isDrawingFromDeck = false;
      }, 600);
      
      const newCard = await this.roomService.drawFromDeck(this.roomCode, this.playerName);
      if (newCard) {
        this.drawnCard = newCard;
        // Activar animación de carta robada
        setTimeout(() => {
          this.showDrawnCardAnimation = true;
        }, 300);
      }
    } catch (error) {
      console.error('Error al robar del mazo:', error);
      this.isDrawingFromDeck = false;
    }
  }

  async drawFromDiscard() {
    if (!this.isYourTurn || this.drawnCard || !this.canDrawFromDiscard()) return;
    
    try {
      const newCard = await this.roomService.drawFromDiscard(this.roomCode, this.playerName);
      if (newCard) {
        this.drawnCard = newCard;
        // Activar animación de carta robada
        setTimeout(() => {
          this.showDrawnCardAnimation = true;
        }, 100);
      }
    } catch (error) {
      console.error('Error al robar del descarte:', error);
    }
  }

  async keepCurrentCards() {
    if (!this.drawnCard) return;
    
    try {
      const success = await this.roomService.discardDrawnCard(this.roomCode, this.playerName, this.drawnCard);
      if (success) {
        this.drawnCard = null;
        this.showDrawnCardAnimation = false;
      } else {
        console.error('No se pudo descartar la carta');
      }
    } catch (error) {
      console.error('Error al descartar carta:', error);
      // Resetear el estado en caso de error
      this.drawnCard = null;
      this.showDrawnCardAnimation = false;
    }
  }

  async confirmCardSwap() {
    if (this.selectedCardIndex === -1 || !this.drawnCard) return;
    
    try {
      // Activar animación de salida para la carta seleccionada
      this.cardAnimations[this.selectedCardIndex] = { entering: false, leaving: true };
      
      // Esperar la animación antes de hacer el cambio
      setTimeout(async () => {
        try {
          const success = await this.roomService.swapCard(
            this.roomCode, 
            this.playerName, 
            this.selectedCardIndex, 
            this.drawnCard!
          );
          
          if (success) {
            // Activar animación de entrada para la nueva carta
            this.cardAnimations[this.selectedCardIndex] = { entering: true, leaving: false };
            
            // Limpiar animaciones después de un tiempo
            setTimeout(() => {
              this.cardAnimations[this.selectedCardIndex] = { entering: false, leaving: false };
            }, 600);
            
            this.drawnCard = null;
            this.selectedCardIndex = -1;
            this.showDrawnCardAnimation = false;
          } else {
            console.error('No se pudo intercambiar la carta');
            // Resetear animaciones
            this.cardAnimations[this.selectedCardIndex] = { entering: false, leaving: false };
          }
        } catch (error) {
          console.error('Error al intercambiar carta:', error);
          // Resetear estado en caso de error
          this.cardAnimations[this.selectedCardIndex] = { entering: false, leaving: false };
          this.drawnCard = null;
          this.selectedCardIndex = -1;
          this.showDrawnCardAnimation = false;
        }
      }, 400);
    } catch (error) {
      console.error('Error en confirmCardSwap:', error);
    }
  }

  // Nuevos métodos auxiliares
  getDeckCount(): number {
    return this.room?.deck?.length || 0;
  }

  canDrawFromDiscard(): boolean {
    return this.room?.discardPile && this.room.discardPile.length > 0;
  }

  selectCard(index: number) {
    if (!this.isYourTurn || !this.drawnCard) {
      return;
    }
    this.selectedCardIndex = index;
  }

  


  get canCloseRound(): boolean {
    const hasMinimumPoints = this.calculateHandPoints() >= 21;
    return this.isYourTurn && !this.drawnCard && this.room.status !== 'round_closing' && hasMinimumPoints;
  }

  getNextPlayerTurn(): string {
    const currentIndex = this.room.players.findIndex((p: any) => p.name === this.playerName);
    const nextIndex = (currentIndex + 1) % this.room.players.length;
    return this.room.players[nextIndex].name;
  }

  calculateHandPoints(): number {
    // Agrupar cartas por palo
    const suitGroups: { [key: string]: number[] } = {};
    
    for (const card of this.playerCards) {
      const suit = this.getCardSuit(card);
      const value = this.getCardNumericValue(card);
      if (!suitGroups[suit]) {
        suitGroups[suit] = [];
      }
      suitGroups[suit].push(value);
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

  getCardNumericValue(card: string): number {
    const value = card.charAt(0);
    switch(value) {
      case '1': return 11; // As vale 11
      case 'S': return 10; // Sota
      case 'C': return 10; // Caballo
      case 'R': return 10; // Rey
      default: return parseInt(value);
    }
  }

  async closeRound() {
    if (this.drawnCard) {
      await Swal.fire({
        title: 'Error',
        text: 'No puedes cerrar la ronda si tienes una carta robada',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    try {
      const points = this.calculateHandPoints();
      const success = await this.roomService.closeRound(this.roomCode, this.playerName);
      if (success) {
        await Swal.fire({
          title: '🎯 ¡Plantado!',
          html: `<div style="text-align: center; font-size: 16px;"><span style="color: #27ae60; font-weight: 700; font-size: 18px;">${points} puntos</span><br><small style="color: #666; margin-top: 4px; display: block; font-size: 13px;">Turno del oponente</small></div>`,
          icon: 'success',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
          toast: true,
          position: 'top',
          showClass: {
            popup: 'animate__animated animate__fadeInDown animate__faster'
          },
          hideClass: {
            popup: 'animate__animated animate__fadeOutUp animate__faster'
          },
          customClass: {
            popup: 'swal-mobile-toast',
            title: 'swal-mobile-title'
          },
          width: '280px',
          padding: '12px'
        });
      } else {
        await Swal.fire({
          title: 'Error',
          text: 'Error al cerrar la ronda',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      await Swal.fire({
        title: 'Error',
        text: 'Error al cerrar la ronda',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  }

  // Agregar método para manejar el final de ronda
  showWinnerImage: boolean = false;
  winnerImageSrc: string = '';
  winnerText: string = '';
  private isHandlingRoundEnd: boolean = false;

  // Pila de imágenes aleatorias del abecedario
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
  
  private lastUsedImageIndex: number = -1;

  // Función para obtener una imagen aleatoria sin repetir la anterior
  private getRandomCelebrationImage(): string {
    let randomIndex;
    
    // Si solo hay una imagen, usarla
    if (this.celebrationImages.length === 1) {
      return this.celebrationImages[0];
    }
    
    // Evitar repetir la misma imagen consecutivamente
    do {
      randomIndex = Math.floor(Math.random() * this.celebrationImages.length);
    } while (randomIndex === this.lastUsedImageIndex && this.celebrationImages.length > 1);
    
    this.lastUsedImageIndex = randomIndex;
    return this.celebrationImages[randomIndex];
  }

  async handleRoundEnd() {
    // Evitar ejecuciones múltiples
    if (this.isHandlingRoundEnd || this.showWinnerImage) return;
    
    if (this.room?.status === 'waiting' && this.room.lastWinner) {
      this.isHandlingRoundEnd = true;
      
      const winner = this.room.lastWinner;
      const winnerPoints = this.room.lastWinnerPoints || 0;
      const loserPoints = this.room.lastLoserPoints || 0;
      
      // Usar directamente la imagen que viene del servidor
      this.winnerImageSrc = this.room.celebrationImage || this.getRandomCelebrationImage();
      
      // Mantener los mensajes específicos del ganador
      if (winner === 'EMPATE') {
        this.winnerText = `¡Empate! Ambos con ${winnerPoints} puntos`;
      } else {
        this.winnerText = `¡${winner} ganó con ${winnerPoints} puntos!`;
      }
      
      this.showWinnerImage = true;
      
      // Después de 4 segundos ocultar la imagen Y REINICIAR AUTOMÁTICAMENTE
      setTimeout(async () => {
        this.showWinnerImage = false;
        
        // REINICIAR AUTOMÁTICAMENTE LA NUEVA RONDA
        const allPlayersAlive = this.room.players.every((player: any) => player.lives > 0);
        if (allPlayersAlive) {
          await this.roomService.startNewRound(this.roomCode);
        }
        
        this.isHandlingRoundEnd = false;
      }, 4000);
    }
  }

  // Nuevo método local para preparar ronda (evita contexto de inyección)
  async prepareNewRoundLocal() {
    if (!this.room) return;
    
    // Solo preparar nueva ronda si todos los jugadores están vivos
    const allPlayersAlive = this.room.players.every((player: any) => player.lives > 0);
    
    if (allPlayersAlive) {
      // Preparar nueva ronda localmente
      this.room.deck = this.roomService.generateDeck();
      this.room.discardPile = [];
      
      this.room.players.forEach((player: any) => {
        player.cards = this.roomService.drawCards(this.room.deck, 3);
      });
      
      // Agregar carta inicial al descarte
      if (this.room.deck.length > 0) {
        this.room.discardPile.push(this.room.deck.pop());
      }
      
      // El primer jugador empieza la nueva ronda
      this.room.turn = this.room.players[0].name;
      this.room.status = 'playing';
      
      // Actualizar la sala
      await this.roomService.updateRoom(this.room.code, this.room);
    }
  }



  // Métodos auxiliares para mostrar las cartas
  getCardValue(card: string): string {
    const value = card.charAt(0);
    switch(value) {
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
    switch(suit) {
      case 'C': return '♥';
      case 'O': return '🔶';
      case 'E': return '♠';
      case 'B': return '♣';
      default: return suit;
    }
  }

  // Método para obtener la ruta de la imagen de la carta
  getCardImagePath(card: string): string {
    return `assets/cards/${card}.png`;
  }
  
  // Método para obtener el nombre completo de la carta
  getCardDisplayName(card: string): string {
    const value = this.getCardValue(card);
    const suit = this.getCardSuit(card);
    const suitName = this.getSuitName(suit);
    return `${value} de ${suitName}`;
  }
  
  // Método para obtener el nombre del palo
  getSuitName(suit: string): string {
    switch(suit) {
      case 'C': return 'Copas';
      case 'O': return 'Oros';
      case 'E': return 'Espadas';
      case 'B': return 'Bastos';
      default: return suit;
    }
  }
  
  // Método para manejar errores de carga de imagen
  onImageError(event: any, card: string): void {
    console.warn(`No se pudo cargar la imagen para la carta: ${card}`);
    // Ocultar la imagen y mostrar el fallback
    const img = event.target;
    const cardElement = img.parentElement;
    const fallback = cardElement.querySelector('.card-fallback');
    
    img.style.display = 'none';
    if (fallback) {
      fallback.style.display = 'flex';
    }
  }

  getPlayerIcon(): string {
    // Determinar el icono basado en el nombre del jugador
    if (this.playerName === 'Aguila' || this.playerName === 'Águila') {
      return '🦅'; // Águila
    } else if (this.playerName === 'Lince') {
      return '🐱'; // Lince (usando gato como representación)
    }
    
    // Iconos alternativos más específicos
    if (this.playerName.toLowerCase().includes('aguila') || this.playerName.toLowerCase().includes('águila')) {
      return '🦅';
    } else if (this.playerName.toLowerCase().includes('lince')) {
      return '🐾'; // Huellas de lince
    }
    
    // Icono por defecto
    return '👤';
  }
}
