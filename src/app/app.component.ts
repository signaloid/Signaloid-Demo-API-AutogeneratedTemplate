import { Component } from '@angular/core';
import {Router, RouterOutlet} from '@angular/router';
import {WsManagerService} from './services/ws-manager.service';
import {environment} from '@env';
import {demoDetails} from './models/demo.applications';
import {TitleCasePipe} from '@angular/common';
import {Title} from '@angular/platform-browser';
import {InfromationTooltipComponent} from 'design-system';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, InfromationTooltipComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  protected pageHeader = demoDetails.title;
  protected pageDescription = demoDetails.description;
  constructor(private wsmanagerService: WsManagerService, private title: Title) {
    this.wsmanagerService.addAuthorizationBearer(environment.SIGNALOID_API_KEY);
    this.wsmanagerService.establishConnection();
    this.title.setTitle(demoDetails.title);
  }
}
