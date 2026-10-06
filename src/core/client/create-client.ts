import { createApiCaller } from './create-api-caller.js';
import { createGrabber } from './create-grabber.js';
import { ProfilingOptions } from './profiling.js';

import { ApiCaller } from './create-api-caller.js';
import { createShopApiCaller, createShopApiTokenManager } from './shop-api-caller.js';

export type ClientInterface = {
    catalogueApi: ApiCaller;
    discoveryApi: ApiCaller;
    pimApi: ApiCaller;
    nextPimApi: ApiCaller;
    meApi: ApiCaller;
    shopCartApi: ApiCaller;
    shopOrderApi: ApiCaller;
    shopLockApi: ApiCaller;
    shopCustomerApi: ApiCaller;
    shopSubscriptionContractApi: ApiCaller;
    shopBookingApi: ApiCaller;
    config: Pick<ClientConfiguration, 'tenantIdentifier' | 'tenantId' | 'origin'>;
    close: () => void;
    [Symbol.dispose]: () => void;
};
export type ClientConfiguration = {
    tenantIdentifier: string;
    tenantId?: string;
    accessTokenId?: string;
    accessTokenSecret?: string;
    staticAuthToken?: string;
    sessionId?: string;
    bearerToken?: string;
    shopApiToken?: string;
    shopApiStaging?: boolean;
    origin?: string;
};

export type CreateClientOptions = {
    useHttp2?: boolean;
    profiling?: ProfilingOptions;
    extraHeaders?: Record<string, string> | Headers | [string, string][];
    /** Request timeout in milliseconds. When set, requests that take longer will be aborted. */
    timeout?: number;
    /** HTTP/2 idle timeout in milliseconds. Defaults to 300000 (5 minutes). */
    http2IdleTimeout?: number;
    shopApiToken?: {
        doNotFetch?: boolean;
        scopes?: string[];
        expiresIn?: number;
    };
};

export const apiHost = (configuration: ClientConfiguration) => {
    const origin = configuration.origin || '.crystallize.com';
    return (path: string[], prefix: 'api' | 'pim' | 'shop-api' = 'api') => {
        if (configuration.shopApiStaging && prefix === 'shop-api') {
            return `https://shop-api-staging.crystallize-edge.workers.dev/${path.join('/')}`;
        }
        return `https://${prefix}${origin}/${path.join('/')}`;
    };
};

/**
 * Creates a Crystallize API client that provides access to catalogue, discovery, PIM, and Shop APIs.
 * Use this as the main entry point for all interactions with the Crystallize APIs.
 *
 * @param configuration - The tenant configuration including identifier and authentication credentials.
 * @param options - Optional settings for HTTP/2, profiling, timeouts, and extra headers.
 * @returns A client interface with pre-configured API callers for each Crystallize endpoint.
 *
 * @example
 * ```ts
 * const client = createClient({
 *   tenantIdentifier: 'my-tenant',
 *   accessTokenId: 'my-token-id',
 *   accessTokenSecret: 'my-token-secret',
 * });
 * const data = await client.catalogueApi(query);
 * ```
 */
export const createClient = (configuration: ClientConfiguration, options?: CreateClientOptions): ClientInterface => {
    const identifier = configuration.tenantIdentifier;
    const { grab, close: grabClose } = createGrabber({
        useHttp2: options?.useHttp2,
        http2IdleTimeout: options?.http2IdleTimeout,
    });

    // let's rewrite the configuration based on the need of the endpoint
    // authenticationHeaders manages this priority: sessionId > bearerToken > staticAuthToken > accessTokenId/accessTokenSecret
    const commonConfig: ClientConfiguration = {
        tenantIdentifier: configuration.tenantIdentifier,
        tenantId: configuration.tenantId,
        origin: configuration.origin,
    };

    // static auth token is excluded
    const pimConfig: ClientConfiguration = {
        ...commonConfig,
        sessionId: configuration.sessionId,
        bearerToken: configuration.bearerToken,
        accessTokenId: configuration.accessTokenId,
        accessTokenSecret: configuration.accessTokenSecret,
    };

    // sessionId is excluded
    const catalogConfig: ClientConfiguration = {
        ...commonConfig,
        bearerToken: configuration.bearerToken,
        staticAuthToken: configuration.staticAuthToken,
        accessTokenId: configuration.accessTokenId,
        accessTokenSecret: configuration.accessTokenSecret,
    };

    // static auth token and bearer token only
    const discoveryConfig: ClientConfiguration = {
        ...commonConfig,
        bearerToken: configuration.bearerToken,
        staticAuthToken: configuration.staticAuthToken,
    };

    // me is like core next in terms of supported headers
    const meConfig: ClientConfiguration = {
        ...commonConfig,
        sessionId: configuration.sessionId,
        bearerToken: configuration.bearerToken,
        accessTokenId: configuration.accessTokenId,
        accessTokenSecret: configuration.accessTokenSecret,
    };

    // one Shop API token for all the shop callers, widened to the scopes they need
    const shopApiTokenManager = createShopApiTokenManager(grab, configuration, options);

    return {
        catalogueApi: createApiCaller(grab, apiHost(configuration)([identifier, 'catalogue']), catalogConfig, options),
        discoveryApi: createApiCaller(
            grab,
            apiHost(configuration)([identifier, 'discovery']),
            discoveryConfig,
            options,
        ),
        pimApi: createApiCaller(grab, apiHost(configuration)(['graphql'], 'pim'), pimConfig, options),
        nextPimApi: createApiCaller(grab, apiHost(configuration)([`@${identifier}`]), pimConfig, options),
        meApi: createApiCaller(grab, apiHost(configuration)(['@me']), meConfig, options),
        shopCartApi: createShopApiCaller(grab, configuration, options, 'cart', shopApiTokenManager),
        shopOrderApi: createShopApiCaller(grab, configuration, options, 'order', shopApiTokenManager),
        shopLockApi: createShopApiCaller(grab, configuration, options, 'lock', shopApiTokenManager),
        shopCustomerApi: createShopApiCaller(grab, configuration, options, 'customer', shopApiTokenManager),
        shopSubscriptionContractApi: createShopApiCaller(
            grab,
            configuration,
            options,
            'subscription-contract',
            shopApiTokenManager,
        ),
        shopBookingApi: createShopApiCaller(grab, configuration, options, 'booking', shopApiTokenManager),
        config: {
            tenantId: configuration.tenantId,
            tenantIdentifier: configuration.tenantIdentifier,
            origin: configuration.origin,
        },
        close: grabClose,
        [Symbol.dispose]: grabClose,
    };
};
