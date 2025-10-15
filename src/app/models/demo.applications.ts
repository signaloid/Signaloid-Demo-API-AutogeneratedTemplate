export interface DemoApplicationCard {
  title: string;
  description: string;
  repoUrl: string;
  coreId: string;
}

export interface DemoApplicationRepository {
  RemoteURL: string;
  Commit: string;
  Branch: string;
  BuildDirectory: string;
  Arguments: string;
  Core?: string;
}

const repoUrl = 'https://github.com/signaloid/Signaloid-CLI-Demo-C-Template';

export const demoDetails: DemoApplicationCard = {
  title: 'Signaloid application',
  description: 'A new application created with Signaloid CLI.',
  repoUrl: repoUrl,
  coreId: 'cor_b852539c8ffd5a40a2688a0b29e344b5',
}

export const demoRepository: DemoApplicationRepository = {
  RemoteURL: repoUrl,
  Commit: 'HEAD',
  Branch: 'main',
  BuildDirectory: 'src',
  Arguments: '',
  Core: 'cor_b852539c8ffd5a40a2688a0b29e344b5',
}

export enum DemoStates {
  FIRST_TIME_RUN,
  IDLE,
  SECOND_TIME_LOADING,
  BUILDING_REPO,
  ERROR,
}

