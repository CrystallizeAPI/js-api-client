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

const getExpirationAtFromToken = (token: string) => {
    const payload = token.split('.')[1];
    const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
    const parsedPayload = JSON.parse(decodedPayload);
    return parsedPayload.exp * 1000;
};
function shopApiCaller(configuration: ClientConfiguration, options?: CreateClientOptions) {
    const identifier = configuration.tenantIdentifier;
    let shopApiToken = configuration.shopApiToken;
    return async function callApi<T>(query: string, variables?: VariablesType): Promise<T> {
        const tokenExpiresAt: number | null = shopApiToken ? getExpirationAtFromToken(shopApiToken) : null;
        const isTokenAboutToExpireOrIsExpired = tokenExpiresAt ? tokenExpiresAt - Date.now() < 1000 * 60 * 5 : true;
        if ((!shopApiToken || isTokenAboutToExpireOrIsExpired) && options?.shopApiToken?.doNotFetch !== true) {
            //static auth token must be removed to fetch the shop api token
            const { staticAuthToken, ...withoutStaticAuthToken } = configuration;
            const headers = {
                'Content-type': 'application/json; charset=UTF-8',
                Accept: 'application/json',
                ...authenticationHeaders(withoutStaticAuthToken),
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

    // let's rewrite the configuration based on the need of the endpoint
    // authenticationHeaders manages this priority: sessionId > staticAuthToken > accessTokenId/accessTokenSecret
    const commonConfig: ClientConfiguration = {
        tenantIdentifier: configuration.tenantIdentifier,
        tenantId: configuration.tenantId,
        origin: configuration.origin,
    };

    // static auth token is excluded
    const pimConfig: ClientConfiguration = {
        ...commonConfig,
        sessionId: configuration.sessionId,
        accessTokenId: configuration.accessTokenId,
        accessTokenSecret: configuration.accessTokenSecret,
    };

    // sessionId is excluded
    const catalogConfig: ClientConfiguration = {
        ...commonConfig,
        staticAuthToken: configuration.staticAuthToken,
        accessTokenId: configuration.accessTokenId,
        accessTokenSecret: configuration.accessTokenSecret,
    };

    // sessionId and static auth token are excluded
    const tokenOnlyConfig: ClientConfiguration = {
        ...commonConfig,
        accessTokenId: configuration.accessTokenId,
        accessTokenSecret: configuration.accessTokenSecret,
    };

    return {
        catalogueApi: createApiCaller(apiHost(configuration)([identifier, 'catalogue']), catalogConfig, options),
        searchApi: createApiCaller(apiHost(configuration)([identifier, 'search']), catalogConfig, options),
        orderApi: createApiCaller(apiHost(configuration)([identifier, 'orders']), tokenOnlyConfig, options),
        subscriptionApi: createApiCaller(
            apiHost(configuration)([identifier, 'subscriptions']),
            tokenOnlyConfig,
            options,
        ),
        pimApi: createApiCaller(apiHost(configuration)(['graphql'], 'pim'), pimConfig, options),
        nextPimApi: createApiCaller(apiHost(configuration)([`@${identifier}`]), pimConfig, options),
        shopCartApi: shopApiCaller(configuration, options),
        config: {
            tenantId: configuration.tenantId,
            tenantIdentifier: configuration.tenantIdentifier,
            origin: configuration.origin,
        },
    };
}
