import { Injectable } from '@angular/core';
import { DemoApplicationCard, demoRepository } from '../models/demo.applications';
import { BehaviorSubject, catchError, EMPTY, filter, from, map, mergeMap, Observable, of, take, tap } from 'rxjs';
import {makeErrorReadable, SnackbarService, UxValueService} from 'design-system';
import { HttpClient } from '@angular/common/http';
import { LoaderStep } from 'design-system';
import { SignaloidWrapperService } from './signaloid-wrapper.service';
import { WsManagerService } from './ws-manager.service';
import { AVAILABLE_CHANNEL_PREFIXES } from './ws-manager.models';
import {BuildDetails} from '@signaloid/scce-sdk';

@Injectable({
  providedIn: 'root',
})
export class ApiDemoExecutionService {
  public state: BehaviorSubject<string> = new BehaviorSubject('idle');
  private demoObject: DemoApplicationCard | undefined;
  private repository: any;
  private arguments: string = '';
  private buildId: string = '';
  private argumentsMap: { [key in string]: string } = {};
  private defaultArguments = '';
  private resampleToSize = 64;
  constructor(
    private signaloidClient: SignaloidWrapperService,
    private uxValueService: UxValueService,
    private wsManagerService: WsManagerService,
    private http: HttpClient,
    private snackbarService: SnackbarService,
  ) {}

  public async setDemoObject(demoObject: DemoApplicationCard) {
    this.demoObject = demoObject;
    this.repository = demoRepository;
    this.state.next('connectRepo:error');
  }

  public setArgumentsFromString(input: string) {
    this.defaultArguments = input;
  }

  public getBuildsFor(repoId: string) {
    return this.signaloidClient.getBuildsFor(repoId).pipe(take(1));
  }

  public getLatestBuild(repoId: string | undefined) {
    if (!repoId) return EMPTY;
    return this.signaloidClient.getBuildsFor(repoId).pipe(
      take(1),
      map((res) => res.Builds.filter((b: any) => b.Status === 'Completed')),
      map((res) => res.filter((elem) => elem.UpdatedAt)),
      map((res: BuildDetails[]) => {
        return res.sort((a, b) => {
          if (a.UpdatedAt && b.UpdatedAt) return b.UpdatedAt - a.UpdatedAt;
          return 0;
        });
      }),
      map((res: BuildDetails[]) => {
        if (res.length === 0) {
          return undefined;
        }
        return res[0];
      }),
      tap((res: any) => {
        this.buildId = res?.BuildID;
      }),
    );
  }

  public setArgumentsForSingleDistribution(
    input: { distribution: [number, number][]; value: number },
    flags: string,
  ) {
    this.arguments = flags;
    this.arguments += this.uxValueService.buildDistributionArgs(
      {
        initialDistribution: input.distribution,
        initialValue: input.value,
      },
      this.resampleToSize,
    );
  }

  public setArgumentsForMultipleDistributions(
    input: { distribution?: [number, number][]; value: number | string },
    argument: string,
    scale?: number,
  ) {
    if (input?.distribution) {
      const uxValue = this.uxValueService.buildDistributionArgs(
        {
          initialDistribution: input.distribution,
          initialValue: input.value as number,
          scale,
        },
        this.resampleToSize,
      );
      this.argumentsMap[argument] = uxValue;
    } else {
      this.argumentsMap[argument] = `${input?.value}`;
    }
    this.arguments = this.defaultArguments;
    Object.keys(this.argumentsMap).forEach((key) => {
      this.arguments += `${key} ${this.argumentsMap[key]}`;
    });
  }

  public removeArgumentFromMap(argument: string) {
    delete this.argumentsMap[argument];
    this.arguments = this.defaultArguments;
    Object.keys(this.argumentsMap).forEach((key) => {
      this.arguments += `${key} ${this.argumentsMap[key]}`;
    });
  }

  public executeDemo() {
    let taskId = '';
    if (!this.arguments) this.arguments = this.defaultArguments;
    if (this.buildId) {
      this.state.next('startTask');
      return this.getTaskObservable(taskId);
    } else if (this.repository && this.demoObject?.coreId && this.repository?.RepositoryID) {
      console.log('building repo');
      return this.subscribeToBuildChannelWs().pipe(
        mergeMap((subscriptionId) => {
          this.state.next('building_repo');
          return this.getBuildingObservable(subscriptionId, taskId);
        }),
      );
    } else {
      console.warn(
        'One of them is missing',
        this.repository,
        this.demoObject?.coreId,
        this.repository?.RepositoryID,
      );
      this.state.next('connectRepo:error');
      return of(Error('No repository or demo application found'));
    }
  }

  private getBuildingObservable(subscriptionId: string, taskId: string) {
    return this.signaloidClient.buildRepository(this.repository?.RepositoryID, this.demoObject?.coreId).pipe(
      tap((res) => (this.buildId = res['BuildID'])),
      mergeMap((buildResponse: any) => {
        return this.wsManagerService.getListener(subscriptionId);
      }),
      filter((res) => res && res.data),
      map((res) => res.data),
      filter((buildResponse: any) => buildResponse.status === 'Completed' || buildResponse.status === 'Stopped'),
      mergeMap((buildResponse: any) => {
        if (buildResponse.status === 'Stopped') {
          this.state.next('building_repo:error');
          return of(Error('Build stopped'));
        } else {
          this.state.next('startTask');
          return this.getTaskObservable(taskId);
        }
      }),

      catchError((err) => {
        console.error(err);
        return EMPTY;
      }),
    );
  }

  private getTaskObservable(taskId: string) {
    return this.subscribeToTaskChannelWs().pipe(
      mergeMap((subscriptionId) => {
        this.state.next('runTask');
        return this.signaloidClient.startTask(this.buildId, this.arguments).pipe(
          tap((res) => (taskId = res.TaskID)),
          mergeMap((taskResponse) => {
            return this.wsManagerService.getListener(subscriptionId);
          }),
          tap((res) => console.log(res, 'here')),
          filter((res) => res && res.data),
          map((res) => res.data),
          filter((res) => res.taskId === taskId),
          filter((taskResponse) => taskResponse.status === 'Completed' || taskResponse.status === 'Stopped'),
          mergeMap((taskResponse: any) => {
            if (taskResponse.status === 'Stopped') {
              this.state.next('runTask:error');
              return of(Error('Task stopped'));
            } else {
              this.state.next('fetchOutputs');
              return this.signaloidClient.getTaskOutputs(taskResponse.taskId)
            }
          }),
          catchError((err) => {
            this.snackbarService.openSnackbar({
              header: 'Task stopped',
              type: 'error',
              description: makeErrorReadable(err),
            });
            console.error(err);
            return of(Error('Task stopped'));
          })
        );
      }),
    );
  }

  public async connectRepositoryIfNotConnected() {
    const repo = this.repository;
    console.log('is connected');
    const isConnected = await this.signaloidClient.getRepositoryByUrl(repo.RemoteURL);
    console.log({ isConnected });
    if (!isConnected) {
      this.state.next('connectRepo');
      const repo = await this.signaloidClient.registerRepositoryToCurrentUser(this.repository);
      this.repository = repo;
      return repo;
    } else {
      this.repository = isConnected;
      return isConnected;
    }
  }

  fetchJsonFromUrl(url: string): Observable<any> {
    try {
      return this.http.get(url);
    } catch (error) {
      console.error(`Failed to fetch JSON from ${url}:`, error);
      throw error;
    }
  }

  protected loaderSteps: LoaderStep[] = [
    { identifier: 'connectRepo', label: 'Connecting repository', status: 'pending' },
    { identifier: 'building_repo', label: 'Building repository', status: 'pending' },
    { identifier: 'startTask', label: 'Initiating task', status: 'pending' },
    { identifier: 'runTask', label: 'Running task', status: 'pending' },
    { identifier: 'fetchOutputs', label: 'Fetching task outputs', status: 'pending' },
  ];

  public getLoaderStepsBasedOnTaskState() {
    return this.state.pipe(
      map((state) => {
        const [step, error] = state.split(':');
        console.log(step, error);
        const stepIndex = this.loaderSteps.findIndex((elem) => elem.identifier === step);
        this.loaderSteps = this.loaderSteps.map((step, index) => {
          if (index < stepIndex) {
            return Object.assign({}, step, {
              status: 'done',
            });
          } else if (index === stepIndex) {
            return Object.assign({}, step, {
              status: error ? 'failed' : 'inProgress',
            });
          } else if (index !== -1 && index > stepIndex) {
            return Object.assign({}, step, {
              status: 'pending',
            });
          } else {
            return Object.assign({}, step, {
              status: 'done',
            });
          }
        });
        return this.loaderSteps;
      }),
    );
  }

  private subscribeToTaskChannelWs() {
    return from(this.wsManagerService.subscribeToChannel(AVAILABLE_CHANNEL_PREFIXES.TASK_STATUS));
  }

  private subscribeToBuildChannelWs() {
    return from(this.wsManagerService.subscribeToChannel(AVAILABLE_CHANNEL_PREFIXES.BUILD_STATUS));
  }

  public clearDemo() {
    this.demoObject = undefined;
    this.arguments = '';
    this.defaultArguments = '';
    this.buildId = '';
    this.argumentsMap = {};
    this.repository = undefined;
  }
}
