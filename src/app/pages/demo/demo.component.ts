import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import {
  DistributionPlotContainerComponent, ErrorContainerTechnicalComponent,
  FigureContainerComponent, InfromationTooltipComponent,
  LoaderStep, makeErrorReadable, MultipleChoiceComponent,
  SliderComponent,
  SliderTypes, SnackbarService,
  VerticalLoaderComponent,
} from 'design-system';
import {demoDetails, demoRepository, DemoStates} from '../../models/demo.applications';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, catchError, EMPTY, from, mergeMap, Subscription, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiDemoExecutionService } from '../../services/api-demo-execution.service';
import { WsManagerService } from '../../services/ws-manager.service';
import { AVAILABLE_CHANNEL_PREFIXES } from '../../services/ws-manager.models';
import { StdoutPlotResponse, TaskOutputResponse } from '../../models/responses.models';
import { demoInputs, InputConfig } from '../../models/demo.inputs';
import {InputTextComponent} from 'design-system';

@Component({
  selector: 'app-tax-free',
  imports: [
    AsyncPipe,
    DistributionPlotContainerComponent,
    FigureContainerComponent,
    SliderComponent,
    InputTextComponent,
    MultipleChoiceComponent,
    ErrorContainerTechnicalComponent,
  ],
  templateUrl: './demo.component.html',
  styleUrls: ['./demo.component.css', '../../styles/shared.demo.styles.css'],
})
export class DemoComponent implements OnInit, OnDestroy {
  protected state$ = new BehaviorSubject<DemoStates>(DemoStates.FIRST_TIME_RUN);
  protected loaderSteps: LoaderStep[] = [];
  private destroyRef = inject(DestroyRef);
  protected plots: StdoutPlotResponse[] = [];

  private subscriber: Subscription | undefined;
  constructor(
    private apiDemoExecutionService: ApiDemoExecutionService,
    private wsManagerService: WsManagerService,
    private snackbarService: SnackbarService,
  ) {}

  async ngOnInit() {
    this.subscribeToExecutionState();
    this.apiDemoExecutionService.setArgumentsFromString(` ${demoRepository.Arguments} `);
    const demoObj = this.getDemoObject();
    await this.apiDemoExecutionService.setDemoObject(demoObj);
    const repo = await this.apiDemoExecutionService.connectRepositoryIfNotConnected();
    this.apiDemoExecutionService
      .getLatestBuild(repo.RepositoryID)
      .pipe(take(1), catchError((err) => {
        this.snackbarService.openSnackbar({
          header: 'Error',
          type: 'error',
          description: makeErrorReadable(err),
        });
        return EMPTY;
      }))
      .subscribe((res) => {
        if (!res?.BuildID) {
          this.state$.next(DemoStates.BUILDING_REPO);
        }
        this.firstRun();
      });
  }

  ngOnDestroy() {
    this.apiDemoExecutionService.clearDemo();
    this.wsManagerService.unsubscribeToChannel(AVAILABLE_CHANNEL_PREFIXES.TASK_STATUS);
    if (this.subscriber) {
      this.subscriber.unsubscribe();
    }
  }

  private firstRun() {
    this.state$.next(DemoStates.FIRST_TIME_RUN);
    this.demoSliders.forEach((slider: InputConfig) => {
      this.apiDemoExecutionService.setArgumentsForMultipleDistributions(
        {
          // @ts-ignore
          distribution: slider.initialDistribution,
          value: slider.initialValue,
        },
        slider.argumentFlag,
      );
    });
    this.executeDemoTask();
  }

  private executeDemoTask() {
    if (this.subscriber) this.subscriber.unsubscribe();
    this.subscriber = this.apiDemoExecutionService
      .executeDemo()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.state$.next(DemoStates.ERROR);
          this.snackbarService.openSnackbar({
            header: 'Error',
            type: 'error',
            description: err.message,
          });
          return EMPTY;
        }),
      )
      .subscribe((res: any) => {
        console.log(res);
        if (res?.plots) {
          this.plots = res.plots;
          this.state$.next(DemoStates.IDLE);
        }else {
          this.snackbarService.openSnackbar({
            header: 'Error',
            type: 'error',
            description: "Cannot parse task output",
          });
          this.state$.next(DemoStates.ERROR);
          console.log('no plots');
        }
      });
  }

  public onChangingSliderValue(value: number | string, id: string) {
    const slider = demoInputs.find((elem: InputConfig) => elem.id === id);
    if (slider) {
      slider.initialValue = value;
      this.state$.next(DemoStates.SECOND_TIME_LOADING);
      this.apiDemoExecutionService.setArgumentsForMultipleDistributions(
        {
          value,
        },
        slider.argumentFlag,
      );
      this.executeDemoTask();
    }
  }

  public onChangingDist(values: { distribution: [number, number][]; value: number }, id: string) {
    const slider = demoInputs.find((elem: InputConfig) => elem.id === id);
    if (slider && slider.type === 'distribution-slider') {
      slider.initialDistribution = values.distribution;
      slider.initialValue = values.value;
      this.state$.next(DemoStates.SECOND_TIME_LOADING);
      this.apiDemoExecutionService.setArgumentsForMultipleDistributions(values, slider.argumentFlag);
      this.executeDemoTask();
    }
  }

  private subscribeToExecutionState() {
    this.apiDemoExecutionService
      .getLoaderStepsBasedOnTaskState()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((loaderSteps) => (this.loaderSteps = loaderSteps));
  }

  private getDemoObject() {
    const demoObject = demoDetails;
    if (!demoObject) {
      throw new Error('Demo not found');
    }
    return demoObject;
  }

  protected onSwitchedMode(value: 'distribution' | 'slider', sliderId: string) {
    const slider = demoInputs.find((elem: InputConfig) => elem.id === sliderId);
    if (slider) {
      this.state$.next(DemoStates.SECOND_TIME_LOADING);
      if (value === 'slider') {
        this.apiDemoExecutionService.setArgumentsForMultipleDistributions(
          {
            value: slider.initialValue,
          },
          slider.argumentFlag,
        );
      } else {
        this.apiDemoExecutionService.setArgumentsForMultipleDistributions(
          {
            // @ts-ignore
            distribution: slider.initialDistribution,
            value: slider.initialValue,
          },
          slider.argumentFlag,
        );
      }
      this.executeDemoTask();
    }
  }
  protected readonly demoSliders = demoInputs;
  protected readonly DemoStates = DemoStates;
  protected readonly SliderTypes = SliderTypes;
  protected readonly Math = Math;
}
