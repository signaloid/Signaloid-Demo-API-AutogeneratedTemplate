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

const repoUrl = 'https://github.com/signaloid/Signaloid-Demo-Sensors-BME680ConversionRoutines.git';

export const demoDetails: DemoApplicationCard = {
	title: 'Signaloid application',
	description: 'A new application created with Signaloid CLI.',
	repoUrl: repoUrl,
	coreId: 'cor_e7eec4dce06f5a03a1b5418e0c5cbd7e',
}

export const demoRepository: DemoApplicationRepository = {
	RemoteURL: repoUrl,
	Commit: 'HEAD',
	Branch: 'main',
	BuildDirectory: 'src',
	Arguments: '-j',
	Core: 'cor_e7eec4dce06f5a03a1b5418e0c5cbd7e',
}

export enum DemoStates {
	FIRST_TIME_RUN,
	IDLE,
	SECOND_TIME_LOADING,
	BUILDING_REPO,
	ERROR,
}
