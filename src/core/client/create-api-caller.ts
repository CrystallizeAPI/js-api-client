import { CreateClientOptions, ClientConfiguration } from './create-client.js';
import { Grab } from './create-grabber.js';

export type VariablesType = Record<string, unknown>;
export type ApiCaller = <T = unknown>(query: string, variables?: VariablesType) => Promise<T>;

export class JSApiClientCallError<Errors = unknown> extends Error {
    code: number;
    statusText: string;
    query: string;
    variables: VariablesType;
    errors?: Errors;

    constructor({
        message = 'An error occurred while calling the API',
        code = 500,
        statusText = 'Internal Server Error',
        query = '',
        variables = {},
        errors,
    }: {
        message: string;
        code: number;
        statusText: string;
        errors?: Errors;
        query: string;
        variables: VariablesType;
    }) {
        super(message);
        this.code = code;
        this.statusText = statusText;
        this.errors = errors;
        this.query = query;
        this.variables = variables;
    }
}
export const createApiCaller = (
    grab: Grab['grab'],
    uri: string,
    configuration: ClientConfiguration,
    options?: CreateClientOptions,
): ApiCaller => {
    return function callApi<T>(query: string, variables?: VariablesType): Promise<T> {
        return post<T>(
            grab,
            uri,
            configuration,
            query,
            variables,
            options?.extraHeaders
                ? {
                      headers: options.extraHeaders,
                  }
                : undefined,
            options,
        );
    };
};

export const authenticationHeaders = (config: ClientConfiguration): Record<string, string> => {
    if (config.sessionId) {
        return {
            Cookie: 'connect.sid=' + config.sessionId,
        };
    }
    if (config.staticAuthToken) {
        return {
            'X-Crystallize-Static-Auth-Token': config.staticAuthToken,
        };
    }
    return {
        'X-Crystallize-Access-Token-Id': config.accessTokenId || '',
        'X-Crystallize-Access-Token-Secret': config.accessTokenSecret || '',
    };
};

type ApiErrorEntry = { errorName: string; message?: string };
const isApiErrorEntry = (x: unknown): x is ApiErrorEntry => {
    return !!x && typeof x === 'object' && typeof (x as { errorName: unknown }).errorName === 'string';
};
const getCoreNextError = (data: unknown): ApiErrorEntry | null => {
    if (!data || typeof data !== 'object') return null;
    for (const v of Object.values(data as Record<string, unknown>)) {
        if (isApiErrorEntry(v)) return v;
    }
    return null;
};

export const post = async <T>(
    grab: Grab['grab'],
    path: string,
    config: ClientConfiguration,
    query: string,
    variables?: VariablesType,
    init?: RequestInit | any | undefined,
    options?: CreateClientOptions,
): Promise<T> => {
    try {
        const { headers: initHeaders, ...initRest } = init || {};
        const profiling = options?.profiling;

        const headers = {
            'Content-type': 'application/json; charset=UTF-8',
            Accept: 'application/json',
            ...authenticationHeaders(config),
            ...initHeaders,
        };

        const body = JSON.stringify({ query, variables });
        let start: number = 0;
        if (profiling) {
            start = Date.now();
            if (profiling.onRequest) {
                profiling.onRequest(query, variables);
            }
        }

        const response = await grab(path, {
            ...initRest,
            method: 'POST',
            headers,
            body,
        });

        if (profiling) {
            const ms = Date.now() - start;
            let serverTiming = response.headers.get('server-timing') ?? undefined;
            if (Array.isArray(serverTiming)) {
                serverTiming = serverTiming[0];
            }
            const duration = serverTiming?.split(';')[1]?.split('=')[1] ?? -1;
            profiling.onRequestResolved(
                {
                    resolutionTimeMs: ms,
                    serverTimeMs: Number(duration),
                },
                query,
                variables,
            );
        }
        if (response.ok && 204 === response.status) {
            return <T>{};
        }
        if (!response.ok) {
            const json = await response.json<{
                message: string;
                errors: unknown;
            }>();
            throw new JSApiClientCallError({
                code: response.status,
                statusText: response.statusText,
                message: json.message,
                query,
                variables: variables || {},
                errors: json.errors || {},
            });
        }
        // we still need to check for error as the API can return 200 with errors
        const json = await response.json<{
            errors: {
                message: string;
            }[];
            data: T;
        }>();
        if (json.errors) {
            throw new JSApiClientCallError({
                code: 400,
                statusText: 'Error was returned from the API',
                message: json.errors[0].message,
                query,
                variables: variables || {},
                errors: json.errors || {},
            });
        }
        // let's try to find `errorName` at the second level to handle Core Next errors more gracefully
        const err = getCoreNextError(json.data);
        if (err) {
            throw new JSApiClientCallError({
                code: 400,
                query,
                variables: variables || {},
                statusText: 'Error was returned (wrapped) from the API. (most likely Core Next)',
                message: `[${err.errorName}] ${err.message ?? 'An error occurred'}`,
            });
        }
        return json.data;
    } catch (exception) {
        throw exception;
    }
};
