import { VariablesType } from './create-api-caller.js';

export type ProfilingOptions = {
    onRequest?: (query: string, variables?: VariablesType) => void;
    onRequestResolved: (
        {
            resolutionTimeMs,
            serverTimeMs,
        }: {
            resolutionTimeMs: number;
            serverTimeMs: number;
        },
        query: string,
        variables?: VariablesType,
    ) => void;
};
