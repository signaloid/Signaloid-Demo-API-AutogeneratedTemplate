import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { WsManagerService } from './services/ws-manager.service';
import { AVAILABLE_CHANNEL_PREFIXES } from './services/ws-manager.models';
import { environment } from '@env';
import { demoDetails } from './models/demo.applications';
import { TitleCasePipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { InfromationTooltipComponent } from 'design-system';

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
		this.wsmanagerService.establishConnection().then(() => {
			this.wsmanagerService.subscribeToChannel(AVAILABLE_CHANNEL_PREFIXES.TASK_STATUS);
			this.wsmanagerService.subscribeToChannel(AVAILABLE_CHANNEL_PREFIXES.BUILD_STATUS);
		});
		this.title.setTitle(demoDetails.title);
	}
}
