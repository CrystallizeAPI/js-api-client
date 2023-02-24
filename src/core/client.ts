import fetch from 'node-fetch';

export type ClientConfiguration = {
    tenantIdentifier: string;
    tenantId?: string;
    accessTokenId?: string;
    accessTokenSecret?: string;
    staticAuthToken?: string;
    sessionId?: string;
    origin?: string;
};

type ProfilingOptions = {
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

export type CreateClientOptions = {
    profiling?: ProfilingOptions;
};

export type VariablesType = Record<string, any>;
export type ApiCaller<T> = (query: string, variables?: VariablesType) => Promise<T>;

export type ClientInterface = {
    catalogueApi: ApiCaller<any>;
    searchApi: ApiCaller<any>;
    orderApi: ApiCaller<any>;
    subscriptionApi: ApiCaller<any>;
    pimApi: ApiCaller<any>;
    config: Pick<ClientConfiguration, 'tenantIdentifier' | 'tenantId' | 'origin'>;
};

function authenticationHeaders(config: ClientConfiguration) {
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
}

async function post<T>(
    path: string,
    config: ClientConfiguration,
    query: string,
    variables?: VariablesType,
    init?: RequestInit | any | undefined,
    profiling?: ProfilingOptions,
): Promise<T> {
    try {
        const commonHeaders = {
            'Content-type': 'application/json; charset=UTF-8',
            Accept: 'application/json',
        };
        const headers = {
            ...commonHeaders,
            ...authenticationHeaders(config),
        };
        const body = JSON.stringify({ query, variables });
        let start: number = 0;
        if (profiling) {
            start = Date.now();
            if (profiling.onRequest) {
                profiling.onRequest(query, variables);
            }
        }

        const response = await fetch(path, {
            ...init,
            method: 'POST',
            headers,
            body,
        });

        if (profiling) {
            const ms = Date.now() - start;
            const serverTiming = response.headers.get('server-timing') ?? undefined;
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
            const json = await response.json();
            throw {
                code: response.status,
                statusText: response.statusText,
                message: json.message,
                errors: json.errors || {},
            };
        }
        // we still need to check for error as the API can return 200 with errors
        const json = await response.json();
        if (json.errors) {
            throw {
                code: 400,
                statusText: 'Error was returned from the API',
                message: json.errors[0].message,
                errors: json.errors || {},
            };
        }

        return <T>json.data;
    } catch (exception) {
        throw exception;
    }
}

function createApiCaller(
    uri: string,
    configuration: ClientConfiguration,
    options?: CreateClientOptions,
): ApiCaller<any> {
    return function callApi<T>(query: string, variables?: VariablesType): Promise<T> {
        return post<T>(uri, configuration, query, variables, undefined, options?.profiling);
    };
}

export function createClient(configuration: ClientConfiguration, options?: CreateClientOptions): ClientInterface {
    const identifier = configuration.tenantIdentifier;
    const origin = configuration.origin || '.crystallize.com';
    const apiHost = (path: string[], prefix: 'api' | 'pim' = 'api') => `https://${prefix}${origin}/${path.join('/')}`;
    return {
        catalogueApi: createApiCaller(apiHost([identifier, 'catalogue']), configuration, options),
        searchApi: createApiCaller(apiHost([identifier, 'search']), configuration, options),
        orderApi: createApiCaller(apiHost([identifier, 'orders']), configuration, options),
        subscriptionApi: createApiCaller(apiHost([identifier, 'subscriptions']), configuration, options),
        pimApi: createApiCaller(apiHost(['graphql'], 'pim'), configuration, options),
        config: {
            tenantId: configuration.tenantId,
            tenantIdentifier: configuration.tenantIdentifier,
            origin: configuration.origin,
        },
    };
}
