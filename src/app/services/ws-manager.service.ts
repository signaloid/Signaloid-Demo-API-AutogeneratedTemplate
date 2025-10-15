import { Injectable } from '@angular/core';
import { environment } from '@env';
import { v4 } from 'uuid';
import { BehaviorSubject } from 'rxjs';
import { SignaloidWrapperService } from './signaloid-wrapper.service';
import { SnackbarService } from 'design-system';
import {AVAILABLE_CHANNEL_PREFIXES} from './ws-manager.models';

@Injectable({
	providedIn: 'root',
})
export class WsManagerService {
	private ws: WebSocket | undefined;
	private wsUrl = environment.REALTIME_ENDPOINT;
	private listeners: { [key in string]: BehaviorSubject<any> } = {};
	private connectionReady: boolean = false;
	private authorization = {
		host: environment.REALTIME_HOST,
		authorization: '',
	};
	private subscriptions: { [key in AVAILABLE_CHANNEL_PREFIXES]: string } = {
		[AVAILABLE_CHANNEL_PREFIXES.TASK_STATUS]: '',
		[AVAILABLE_CHANNEL_PREFIXES.BUILD_STATUS]: '',
		[AVAILABLE_CHANNEL_PREFIXES.BUILD_COUNT]: '',
		[AVAILABLE_CHANNEL_PREFIXES.TASK_COUNT]: '',
		[AVAILABLE_CHANNEL_PREFIXES.BUILD_STATS]: '',
		[AVAILABLE_CHANNEL_PREFIXES.TASK_STATS]: '',
	};

	public addAuthorizationBearer(key: string, bearer: boolean = false) {
    this.authorization.authorization = bearer ? `Bearer ${key}` : `${key}`;
	}

	constructor(
		private signaloidService: SignaloidWrapperService,
		private snackbarService: SnackbarService,
	) {}

	public establishConnection() {
		return new Promise<void>((resolve, reject) => {
			this.ws = new WebSocket(`${this.wsUrl}`, this.getAuthProtocol(this.authorization.authorization));
			this.ws.onopen = () => {
				console.log('WebSocket connection established');
				this.ws?.send(
					JSON.stringify({
						type: 'connection_init',
					}),
				);
			};

			this.ws.onmessage = (event) => {
				this.handleWsMessage(event, resolve);
			};
			this.ws.onerror = (error) => {
				this.connectionReady = false;
				reject(error);
			};
		});
	}

	private handleWsMessage(event: MessageEvent<any>, resolve: (value: PromiseLike<void> | void) => void) {
		const message = JSON.parse(event.data);
		let messageBody = {};
		if (message?.event) {
			messageBody = JSON.parse(message.event);
		}
		if (message?.type === 'connection_ack') {
			this.connectionReady = true;
			resolve();
		} else {
			if (this.listeners[message.id]) {
				this.listeners[message.id].next(messageBody);
			} else {
				console.warn('No active listener', message.id);
			}
		}

		if (message.type.includes('error')) {
			this.snackbarService.openSnackbar({
				header: 'Connection Error',
				type: 'error',
				description: message.message,
			});
		}
	}

	public async subscribeToChannel(channel: AVAILABLE_CHANNEL_PREFIXES, subscriptionId: string = v4()) {
		if (this.subscriptions[channel]) {
			return this.subscriptions[channel];
		}
		if (this.ws || this.connectionReady) {
			const userId = await this.signaloidService.getCurrentUser();
      const userIdTrimmed = userId.split('_')[1];
			this.ws?.send(
				JSON.stringify({
					id: subscriptionId,
					type: 'subscribe',
					channel: `${channel}/${userIdTrimmed}`,
					authorization: this.authorization,
				}),
			);
			this.subscriptions[channel] = subscriptionId;
			this.listeners[subscriptionId] = new BehaviorSubject<any>(null);
		} else {
			console.warn('No websocket connection');
		}
		return subscriptionId;
	}

	public async unsubscribe(subscriptionId: string, channel: string) {
		if (this.listeners[subscriptionId]) {
			this.listeners[subscriptionId].complete();
			delete this.listeners[subscriptionId];
		} else {
			console.warn(`No listener found for subscriptionId ${subscriptionId}`);
		}
		const userId = await this.signaloidService.getCurrentUser();
    const userIdTrimmed = userId.split('_')[1];
		this.ws?.send(
			JSON.stringify({
				id: subscriptionId,
				type: 'unsubscribe',
				channel: `${channel}/${userId}`,
				authorization: this.authorization,
			}),
		);
	}

	public unsubscribeToChannel(channel: AVAILABLE_CHANNEL_PREFIXES) {
		if (this.subscriptions[channel]) {
			this.ws?.send(
				JSON.stringify({
					id: this.subscriptions[channel],
					type: 'unsubscribe',
					channel: `${channel}/${this.subscriptions[channel]}`,
					authorization: this.authorization,
				}),
			);
			this.subscriptions[channel] = '';
		}
	}

	public getListener(subscriptionId: string) {
		return this.listeners[subscriptionId];
	}

	private getTimestamp(): string {
		const date = new Date();
		return date.toISOString();
	}

	private getAuthProtocol(bearer: string): string[] {
		const header = btoa(
			JSON.stringify({
				host: environment.REALTIME_HOST,
				authorization: bearer,
			}),
		)
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, ''); // base64url
		return [`header-${header}`, 'aws-appsync-event-ws'];
	}

	public stopConnection() {
		this.ws?.close();
		this.connectionReady = false;
	}

	public isConnected(): boolean {
		return this.connectionReady;
	}
}
