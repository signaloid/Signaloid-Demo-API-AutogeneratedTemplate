import { Injectable, Output } from '@angular/core';
import { createClient, OutputStream, TaskDataSource } from '@signaloid/scce-sdk';
import { HttpClient } from '@angular/common/http';
import { delay, EMPTY, expand, from, map, mergeMap, tap } from 'rxjs';
import { environment } from '@env';

@Injectable({
	providedIn: 'root',
})
// This service is made in order to maintain state of signaloid client
export class SignaloidWrapperService {
	private readonly clientEnvironment: string;
	private readonly api: string;
	private client;
	constructor(
		private http: HttpClient,
	) {
		this.api = environment.API_URL;
		this.clientEnvironment = environment.CLIENT_ENVIRONMENT;
		// @ts-ignore
		this.client = createClient({ method: "apiKey", key: environment.SIGNALOID_API_KEY });
	}

	public getBuildsFor(repoId: string) {
		return from(this.client.repositories.getBuilds(repoId));
	}

	private currentUserPromise: Promise<string> | undefined;

	public async getCurrentUser() {
		try {
			if (!this.currentUserPromise) {
				this.currentUserPromise = this.client.users.me().then((user) => user.UserID);
			}
			return await this.currentUserPromise;
		} catch (error) {
			this.currentUserPromise = undefined;
			console.error(error);
			return '';
		}
	}

	public listUserRepositories() {
		return this.client.repositories.list();
	}

	public getRepository(repositoryId: string) {
		return this.client.repositories.getOne(repositoryId);
	}

	public registerRepositoryToCurrentUser(repo: any) {
		return this.client.repositories.connect(repo);
	}

	public async getRepositoryByUrl(repositoryUrl: string) {
		const repos = await this.listUserRepositories();
		const normalize = (url: string) => url.replace(/\.git$/, '');
		return repos.Repositories.find((elem) => normalize(elem.RemoteURL) === normalize(repositoryUrl));
	}

	private async getDataSourceForDemos(): Promise<TaskDataSource> {
		const userId = await this.getCurrentUser();
		return {
			Location: 'sd0',
			ResourceID: `signaloid-cloud-storage:/${userId}`,
			ResourceType: 'SignaloidCloudStorage',
		};
	}

	public uploadFile(path: string, file: File) {
		return this.client.files.upload(path, file);
	}

	public buildRepository(repositoryId: string, coreId?: string) {
		const payload = {
			CoreID: coreId,
		};
		return from(this.client.builds.createFromRepository(repositoryId, payload));
	}

	public subscribeToBuildStatus(buildId: string) {
		const request = from(this.getAuthHeader()).pipe(
			mergeMap((headers) => {
				return this.http.get(`${this.api}/builds/${buildId}`, headers);
			}),
		);

		return request.pipe(
			expand((response) => {
				//@ts-ignore
				if (response.Status === 'Completed' || response.Status === 'Stopped') {
					return EMPTY;
				} else {
					return request.pipe(delay(1000));
				}
			}),
			//@ts-ignore
			// takeWhile((response) => response.Status !== 'Completed' || response.Status !== 'Stopped'),
		);
	}

	public async getAuthHeader() {
		return {
			headers: {
				Authorization: `${environment.SIGNALOID_API_KEY}`,
			},
		};
	}

	public startTask(buildId: string, args: string) {
		return from(this.getDataSourceForDemos()).pipe(
			mergeMap((dataSource: TaskDataSource) => {
				const executionRequest = {
					Arguments: `${args.trim()}`,
					DataSources: [dataSource],
				};
				return from(this.client.tasks.createTask(buildId, executionRequest));
			}));
	}

	public getTaskOutputs(taskId: string) {
		return from(this.client.tasks.getOutput(taskId, "Stdout" as OutputStream)).pipe(
			map(res => {
				try {
					return JSON.parse(JSON.stringify(res));
				}
				catch (e) {
					throw new Error("Could not parse task output");
				}

			})
		);
	}

	public subscribeToTaskStatus(taskId: string) {
		const request = from(this.getAuthHeader()).pipe(
			mergeMap((headers) => {
				return this.http.get(`${this.api}/tasks/${taskId}`, headers);
			}),
		);

		// @ts-ignore
		return request.pipe(
			expand((response) => {
				// @ts-ignore
				if (response.Status === 'Completed' || response.Status === 'Stopped') {
					return EMPTY;
				} else {
					return request.pipe(delay(1000));
				}
			}),
		);
	}

	public listFiles() {
		return this.http.get<{ items: string[]; count: number }>(`${this.api}/files`);
	}


}
