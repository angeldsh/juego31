import { Routes } from '@angular/router';

export const routes: Routes = [
  // Ruta por defecto - redirige al lobby
  { path: '', redirectTo: '/lobby', pathMatch: 'full' },
  
  // Ruta del lobby (componente principal)
  { path: 'lobby', loadComponent: () => import('../components/lobby/lobby.component').then(m => m.LobbyComponent) },
  
  // Ruta del juego
  { path: 'game', loadComponent: () => import('../components/game/game.component').then(m => m.GameComponent) },
  
  // Ruta wildcard para manejar rutas no encontradas
  { path: '**', redirectTo: '/lobby' }
];