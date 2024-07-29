import http2 from 'node:http2';

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

type GrabResponse = {
    ok: boolean;
    status: number;
    statusText: string;
    headers: {
        get: (name: string) => string | string[] | undefined | null;
    };
    json: <T>() => Promise<T>;
    text: () => Promise<string>;
};
type Grab = (url: string, options?: RequestInit | any | undefined) => Promise<GrabResponse>;

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
    useHttp2?: boolean;
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
    close: () => void;
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
    grab: Grab,
    path: string,
    config: ClientConfiguration,
    query: string,
    variables?: VariablesType,
    init?: RequestInit | any | undefined,
    options?: CreateClientOptions,
): Promise<T> {
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
            throw {
                code: response.status,
                statusText: response.statusText,
                message: json.message,
                errors: json.errors || {},
            };
        }
        // we still need to check for error as the API can return 200 with errors
        const json = await response.json<{
            errors: {
                message: string;
            }[];
            data: T;
        }>();
        if (json.errors) {
            throw {
                code: 400,
                statusText: 'Error was returned from the API',
                message: json.errors[0].message,
                errors: json.errors || {},
            };
        }

        return json.data;
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
    grab: Grab,
    uri: string,
    configuration: ClientConfiguration,
    options?: CreateClientOptions,
): ApiCaller<any> {
    return function callApi<T>(query: string, variables?: VariablesType): Promise<T> {
        return post<T>(grab, uri, configuration, query, variables, undefined, options);
    };
}

const getExpirationAtFromToken = (token: string) => {
    const payload = token.split('.')[1];
    const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
    const parsedPayload = JSON.parse(decodedPayload);
    return parsedPayload.exp * 1000;
};

function shopApiCaller(grab: Grab, configuration: ClientConfiguration, options?: CreateClientOptions) {
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
            const response = await grab(apiHost(configuration)([`@${identifier}`, 'auth', 'token'], 'shop-api'), {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    scopes: options?.shopApiToken?.scopes || ['cart'],
                    expiresIn: options?.shopApiToken?.expiresIn || 3600 * 12,
                }),
            });
            const results = await response.json<{
                success: boolean;
                token: string;
                error?: string;
            }>();
            if (results.success !== true) {
                throw new Error('Could not fetch shop api token: ' + results.error);
            }
            shopApiToken = results.token;
        }
        return post<T>(
            grab,
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
            options,
        );
    };
}

export function createClient(configuration: ClientConfiguration, options?: CreateClientOptions): ClientInterface {
    const identifier = configuration.tenantIdentifier;
    const clients = new Map();
    const IDLE_TIMEOUT = 300000; // 5 min idle timeout
    const grab: Grab = (url, grabOptions) => {
        if (options?.useHttp2 !== true) {
            return fetch(url, grabOptions);
        }
        const closeAndDeleteClient = (origin: string) => {
            const clientObj = clients.get(origin);
            if (clientObj) {
                clientObj.client.close();
                clients.delete(origin);
            }
        };

        const resetIdleTimeout = (origin: string) => {
            const clientObj = clients.get(origin);
            if (clientObj && clientObj.idleTimeout) {
                clearTimeout(clientObj.idleTimeout);
            }
            clientObj.idleTimeout = setTimeout(() => {
                closeAndDeleteClient(origin);
            }, IDLE_TIMEOUT);
        };

        const getClient = (origin: string): http2.ClientHttp2Session => {
            if (!clients.has(origin) || clients.get(origin).client.closed) {
                closeAndDeleteClient(origin);
                const client = http2.connect(origin);
                client.on('error', () => {
                    closeAndDeleteClient(origin);
                });
                clients.set(origin, { client, idleTimeout: null });
                resetIdleTimeout(origin);
            }
            return clients.get(origin).client;
        };

        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const origin = urlObj.origin;
            const client = getClient(origin);
            resetIdleTimeout(origin);
            const headers = {
                ':method': grabOptions.method || 'GET',
                ':path': urlObj.pathname + urlObj.search,
                ...grabOptions.headers,
            };
            const req = client.request(headers);
            if (grabOptions.body) {
                req.write(grabOptions.body);
            }
            req.setEncoding('utf8');
            let responseData = '';

            req.on('response', (headers) => {
                const responseHeaders: Record<string, string | string[] | undefined> = {};
                for (const name in headers) {
                    responseHeaders[name.toLowerCase()] = headers[name];
                }
                const status = headers[':status'] || 500; // Default to 500 if undefined
                const statusText = statusTexts[status as keyof typeof statusTexts] || '';
                const response = {
                    status,
                    statusText,
                    ok: status >= 200 && status < 300,
                    headers: {
                        get: (name: string) => responseHeaders[name.toLowerCase()],
                    },
                    text: () => Promise.resolve(responseData),
                    json: () => Promise.resolve(JSON.parse(responseData)),
                };

                req.on('data', (chunk) => {
                    responseData += chunk;
                });

                req.on('end', () => {
                    resetIdleTimeout(origin);
                    resolve(response);
                });

                req.on('error', (err) => {
                    resetIdleTimeout(origin);
                    reject(err);
                });
            });
            req.end();
        });
    };

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
        catalogueApi: createApiCaller(grab, apiHost(configuration)([identifier, 'catalogue']), catalogConfig, options),
        searchApi: createApiCaller(grab, apiHost(configuration)([identifier, 'search']), catalogConfig, options),
        orderApi: createApiCaller(grab, apiHost(configuration)([identifier, 'orders']), tokenOnlyConfig, options),
        subscriptionApi: createApiCaller(
            grab,
            apiHost(configuration)([identifier, 'subscriptions']),
            tokenOnlyConfig,
            options,
        ),
        pimApi: createApiCaller(grab, apiHost(configuration)(['graphql'], 'pim'), pimConfig, options),
        nextPimApi: createApiCaller(grab, apiHost(configuration)([`@${identifier}`]), pimConfig, options),
        shopCartApi: shopApiCaller(grab, configuration, options),
        config: {
            tenantId: configuration.tenantId,
            tenantIdentifier: configuration.tenantIdentifier,
            origin: configuration.origin,
        },
        close: () => {
            clients.forEach((clientObj) => {
                if (clientObj.idleTimeout) {
                    clearTimeout(clientObj.idleTimeout);
                }
                clientObj.client.close();
            });
            clients.clear();
        },
    };
}

const statusTexts = {
    100: 'Continue',
    101: 'Switching Protocols',
    102: 'Processing',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    207: 'Multi-Status',
    208: 'Already Reported',
    226: 'IM Used',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Payload Too Large',
    414: 'URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Range Not Satisfiable',
    417: 'Expectation Failed',
    418: "I'm a teapot",
    421: 'Misdirected Request',
    422: 'Unprocessable Entity',
    423: 'Locked',
    424: 'Failed Dependency',
    425: 'Too Early',
    426: 'Upgrade Required',
    428: 'Precondition Required',
    429: 'Too Many Requests',
    431: 'Request Header Fields Too Large',
    451: 'Unavailable For Legal Reasons',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
    506: 'Variant Also Negotiates',
    507: 'Insufficient Storage',
    508: 'Loop Detected',
    510: 'Not Extended',
    511: 'Network Authentication Required',
} as const;
