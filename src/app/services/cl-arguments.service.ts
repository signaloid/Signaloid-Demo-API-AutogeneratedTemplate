import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class ClArgumentsService {
	public arguments = new BehaviorSubject<string>('');
	constructor() {}
}
