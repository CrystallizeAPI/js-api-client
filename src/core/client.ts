import fetch from 'node-fetch';

export type ClientConfiguration = {
    tenantIdentifier: string;
    tenantId?: string;
    accessTokenId?: string;
    accessTokenSecret?: string;
    staticAuthToken?: string;
    sessionId?: string;
    shopApiToken?: string;
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
    shopApiToken?: {
        doNotFetch?: boolean;
        scopes?: string[];
        expiresIn?: number;
    };
};

export type VariablesType = Record<string, any>;
export type ApiCaller<T> = (query: string, variables?: VariablesType) => Promise<T>;

export type ClientInterface = {
    catalogueApi: ApiCaller<any>;
    searchApi: ApiCaller<any>;
    orderApi: ApiCaller<any>;
    subscriptionApi: ApiCaller<any>;
    pimApi: ApiCaller<any>;
    nextPimApi: ApiCaller<any>;
    shopCartApi: ApiCaller<any>;
    config: Pick<ClientConfiguration, 'tenantIdentifier' | 'tenantId' | 'origin'>;
};

function authenticationHeaders(config: ClientConfiguration): Record<string, string> {
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
        const { headers: initHeaders, ...initRest } = init || {};

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

        const response = await fetch(path, {
            ...initRest,
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

function apiHost(configuration: ClientConfiguration) {
    const origin = configuration.origin || '.crystallize.com';
    return (path: string[], prefix: 'api' | 'pim' | 'shop-api' = 'api') =>
        `https://${prefix}${origin}/${path.join('/')}`;
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

function shopApiCaller(configuration: ClientConfiguration, options?: CreateClientOptions) {
    const identifier = configuration.tenantIdentifier;
    let shopApiToken = configuration.shopApiToken;
    return async function callApi<T>(query: string, variables?: VariablesType): Promise<T> {
        if (!shopApiToken && options?.shopApiToken?.doNotFetch !== true) {
            const headers = {
                'Content-type': 'application/json; charset=UTF-8',
                Accept: 'application/json',
                ...authenticationHeaders(configuration),
            };
            const response = await fetch(apiHost(configuration)([`@${identifier}`, 'auth', 'token'], 'shop-api'), {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    scopes: options?.shopApiToken?.scopes || ['cart'],
                    expiresIn: options?.shopApiToken?.expiresIn || 3600 * 12,
                }),
            });
            const results = await response.json();
            if (results.success !== true) {
                throw new Error('Could not fetch shop api token: ' + results.error);
            }
            shopApiToken = results.token;
        }
        return post<T>(
            apiHost(configuration)([`@${identifier}`, 'cart'], 'shop-api'),
            {
                ...configuration,
                shopApiToken: shopApiToken,
            },
            query,
            variables,
            {
                headers: {
                    Authorization: `Bearer ${shopApiToken}`,
                },
            },
            options?.profiling,
        );
    };
}

export function createClient(configuration: ClientConfiguration, options?: CreateClientOptions): ClientInterface {
    const identifier = configuration.tenantIdentifier;
    return {
        catalogueApi: createApiCaller(apiHost(configuration)([identifier, 'catalogue']), configuration, options),
        searchApi: createApiCaller(apiHost(configuration)([identifier, 'search']), configuration, options),
        orderApi: createApiCaller(apiHost(configuration)([identifier, 'orders']), configuration, options),
        subscriptionApi: createApiCaller(apiHost(configuration)([identifier, 'subscriptions']), configuration, options),
        pimApi: createApiCaller(apiHost(configuration)(['graphql'], 'pim'), configuration, options),
        nextPimApi: createApiCaller(apiHost(configuration)([`@${identifier}`]), configuration, options),
        shopCartApi: shopApiCaller(configuration, options),
        config: {
            tenantId: configuration.tenantId,
            tenantIdentifier: configuration.tenantIdentifier,
            origin: configuration.origin,
        },
    };
}
