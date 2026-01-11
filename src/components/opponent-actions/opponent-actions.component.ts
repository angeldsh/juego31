import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OpponentAction } from '../../types/types';

@Component({
  selector: 'app-opponent-actions',
  templateUrl: './opponent-actions.component.html',
  styleUrls: ['./opponent-actions.component.css'],
  imports: [CommonModule],
  standalone: true
})
export class OpponentActionsComponent implements OnInit {
  @Input() opponentName: string = '';
  @Input() opponentCards: string[] = [];
  @Input() opponentVisibleCards: boolean[] = [];
  @Input() lastAction?: OpponentAction;
  @Input() isOpponentTurn: boolean = false;


  constructor() {}

  ngOnInit() {}

  getCardImagePath(card: string): string {
    if (!card) return '/assets/cards/RV.png'; // Imagen por defecto
    return `/assets/cards/${card}.png`;
  }

  getActionDescription(): string {
    if (!this.lastAction) return '';
    
    switch (this.lastAction.type) {
      case 'draw_deck':
        return '🎴 Robó del mazo';
      case 'draw_discard':
        return '♻️ Robó del descarte';
      case 'discard':
        return '🗑️ Pasó';
      case 'swap':
        return '🔄 Intercambió cartas';
      default:
        return '';
    }
  }
  getOpponentIcon(): string {
    // Determinar el icono basado en el nombre del oponente
    if (this.opponentName === 'Aguila' || this.opponentName === 'Águila') {
      return '🦅'; // Águila
    } else if (this.opponentName === 'Lince') {
      return '🐱'; // Lince (usando gato como representación)
    }
    return ''; // Icono por defecto si no se reconoce
  }  
}

