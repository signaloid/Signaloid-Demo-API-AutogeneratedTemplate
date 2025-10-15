export interface TaskOutputResponse {
	Stdout: string;
	Stderr: string;
	StdoutChunks: string[];
}

export interface StdoutResponse {
	description: string;
	plots: StdoutPlotResponse[];
}

export interface StdoutPlotResponse {
	variableID: string;
	variableSymbol: string;
	variableDescription: string;
	values: string[];
	stdValues: number;
}
