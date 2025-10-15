export enum AVAILABLE_CHANNEL_PREFIXES {
	BUILD_STATUS = 'build-status',
	TASK_STATUS = 'task-status',
	BUILD_STATS = 'build-stats',
	TASK_STATS = 'task-stats',
	BUILD_COUNT = 'build-count',
	TASK_COUNT = 'task-count',
}

export interface BuildStatusResponse {
	version: string;
	id: string;
	event: string;
	created: Date;
	data: {
		buildId: string;
		status: string;
		message: string;
		updatedAt: Date;
	};
}

export interface TaskStatusResponse {
	version: string;
	id: string;
	event: string;
	created: Date;
	data: {
		taskId: string;
		status: string;
		message: string;
		updatedAt: Date;
	};
}
