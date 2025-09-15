import { Component, OnInit, OnDestroy } from '@angular/core';
import { RoomService } from '../../services/room.service';
import { GameComponent } from '../game/game.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.css'],
  imports: [GameComponent, FormsModule, CommonModule],
  standalone: true
})
export class LobbyComponent implements OnInit, OnDestroy {
  playerName: string = '';
  roomCode: string = '';
  currentRoom: any = null;
  gameStarted: boolean = false;
  selectedPlayer: string = '';
  
  // Contador de días juntos
  daysTogetherCount: number = 0;
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

  constructor(private roomService: RoomService) {}
  
  ngOnInit() {
    this.calculateDaysTogether();
    // Actualizar cada minuto para mantener el contador actualizado
    this.intervalId = setInterval(() => {
      this.calculateDaysTogether();
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

  // Método para seleccionar jugador
  selectPlayer(playerId: string) {
    this.selectedPlayer = playerId;
    this.playerName = this.playerOptions.find(p => p.id === playerId)?.name || '';
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
      const code = await this.roomService.createRoom(this.playerName);
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
      const success = await this.roomService.joinRoom(this.roomCode, this.playerName);
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
    this.roomService.subscribeToRoom(code).subscribe(room => {
      this.currentRoom = room;
    });
  }
}
