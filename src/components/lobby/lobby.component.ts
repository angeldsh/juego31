import { Component, OnInit, OnDestroy } from '@angular/core';
import { RoomService } from '../../services/room.service';
import { VentanitaRoomService } from '../../services/ventanita-room.service';
import { GameComponent } from '../game/game.component';
import { VentanitaGameComponent } from '../ventanita-game/ventanita-game.component';
import { Room } from '../../types/types';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.css'],
  imports: [GameComponent, VentanitaGameComponent, FormsModule, CommonModule],
  standalone: true
})
export class LobbyComponent implements OnInit, OnDestroy {
  playerName: string = '';
  roomCode: string = '';
  currentRoom: any = null;
  gameStarted: boolean = false;
  selectedPlayer: string = '';
  selectedGame: '31' | 'ventanita' = '31';

  // Contador de días juntos
  daysTogetherCount: number = 0;
  // Contador de días hasta Navidad (14 de diciembre a las 8:55 AM)
  daysUntilChristmas: number = 0;
  private intervalId: any;

  // Opciones de jugadores
  playerOptions = [
    {
      id: 'aguila',
      name: 'Águila',
      emoji: '🦅',
      description: 'calva'
    },
    {
      id: 'lince',
      name: 'Lince',
      emoji: '🐱',
      description: 'boreal'
    }
  ];

  // Opciones de juego
  gameOptions = [
    {
      id: '31',
      name: '31',
      emoji: '🃏',
      description: 'El clásico'
    },
    {
      id: 'ventanita',
      name: 'Ventanita',
      emoji: '🪟',
      description: 'Golf / 4 cartas'
    }
  ];

  constructor(
    private roomService: RoomService,
    private ventanitaRoomService: VentanitaRoomService
  ) { }

  ngOnInit() {
    this.calculateDaysTogether();
    this.calculateDaysUntilChristmas();
    // Actualizar cada minuto para mantener el contador actualizado
    this.intervalId = setInterval(() => {
      this.calculateDaysTogether();
      this.calculateDaysUntilChristmas();
    }, 60000); // 60 segundos
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private calculateDaysTogether() {
    const startDate = new Date('2025-04-06'); // 6 de abril de 2025
    const currentDate = new Date();

    // Calcular la diferencia en milisegundos
    const timeDifference = currentDate.getTime() - startDate.getTime();

    // Convertir a días (redondeando hacia abajo)
    this.daysTogetherCount = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

    // Si la fecha actual es anterior a la fecha de inicio, mostrar 0
    if (this.daysTogetherCount < 0) {
      this.daysTogetherCount = 0;
    }
  }

  private calculateDaysUntilChristmas() {
    const christmasDate = new Date('2026-03-18T21:00:00'); // El viaje a EEUU
    const currentDate = new Date();

    // Calcular la diferencia en milisegundos
    const timeDifference = christmasDate.getTime() - currentDate.getTime();

    // Convertir a días (redondeando hacia abajo)
    this.daysUntilChristmas = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

    // Si ya pasó la fecha, mostrar 0
    if (this.daysUntilChristmas < 0) {
      this.daysUntilChristmas = 0;
    }
  }

  // Método para seleccionar jugador
  selectPlayer(playerId: string) {
    this.selectedPlayer = playerId;
    this.playerName = this.playerOptions.find(p => p.id === playerId)?.name || '';
  }

  // Método para seleccionar juego
  selectGame(gameId: string) {
    if (gameId === '31' || gameId === 'ventanita') {
      this.selectedGame = gameId;
    }
  }

  async createRoom() {
    if (!this.selectedPlayer) {
      await Swal.fire({
        title: 'Selecciona tu jugador',
        text: 'Elige entre Águila o Lince',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    try {
      let code: string;
      if (this.selectedGame === 'ventanita') {
        code = await this.ventanitaRoomService.createRoom(this.playerName);
      } else {
        code = await this.roomService.createRoom(this.playerName);
      }
      
      if (code) {
        this.roomCode = code;
        // Suscribirse directamente a la sala creada sin llamar joinRoom
        this.subscribeToRoom(code);
        this.gameStarted = true;
      } else {
        await Swal.fire({
          title: 'Error',
          text: 'Error al crear la sala',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      await Swal.fire({
        title: 'Error',
        text: 'Error al crear la sala',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  }

  async joinRoom() {
    if (!this.selectedPlayer || !this.roomCode.trim()) {
      await Swal.fire({
        title: 'Error',
        text: 'Selecciona tu jugador e ingresa el código',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    try {
      let success: boolean;
      if (this.selectedGame === 'ventanita') {
        success = await this.ventanitaRoomService.joinRoom(this.roomCode, this.playerName);
      } else {
        success = await this.roomService.joinRoom(this.roomCode, this.playerName);
      }

      if (success) {
        this.subscribeToRoom(this.roomCode);
        this.gameStarted = true;
      } else {
        await Swal.fire({
          title: 'Error',
          text: 'Código incorrecto, sala llena o ya estás en la sala',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      await Swal.fire({
        title: 'Error',
        text: 'Error al unirse a la sala',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  }

  // Método para suscribirse a los cambios de la sala
  private subscribeToRoom(code: string) {
    if (this.selectedGame === 'ventanita') {
      this.ventanitaRoomService.subscribeToRoom(code).subscribe(room => {
        this.currentRoom = room;
      });
    } else {
      this.roomService.subscribeToRoom(code).subscribe(room => {
        this.currentRoom = room;
      });
    }
  }
  onInputFocus() {
    // Agregar clase para manejar el estado de focus
    document.body.classList.add('input-focused');

    // Scroll suave hacia el input en móviles
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        const inputElement = document.querySelector('.mobile-input') as HTMLElement;
        if (inputElement) {
          inputElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 300);
    }
  }

  onInputBlur() {
    // Remover clase cuando se pierde el focus
    document.body.classList.remove('input-focused');
  }
}
