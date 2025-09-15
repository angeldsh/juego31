import { FormsModule } from "@angular/forms";
import { LobbyComponent } from "../components/lobby/lobby.component";
import { GameComponent } from "../components/game/game.component";
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, LobbyComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent { }
