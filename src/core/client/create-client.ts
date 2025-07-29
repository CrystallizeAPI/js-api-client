import { createApiCaller } from './create-api-caller.js';
import { createGrabber } from './create-grabber.js';
import { ProfilingOptions } from './profiling.js';

import { ApiCaller } from './create-api-caller.js';
import { createShopApiCaller } from './shop-api-caller.js';

export type ClientInterface = {
    catalogueApi: ApiCaller;
    discoveryApi: ApiCaller;
    pimApi: ApiCaller;
    nextPimApi: ApiCaller;
    shopCartApi: ApiCaller;
    config: Pick<ClientConfiguration, 'tenantIdentifier' | 'tenantId' | 'origin'>;
    close: () => void;
};
export type ClientConfiguration = {
    tenantIdentifier: string;
    tenantId?: string;
    accessTokenId?: string;
    accessTokenSecret?: string;
    staticAuthToken?: string;
    sessionId?: string;
    shopApiToken?: string;
    shopApiStaging?: boolean;
    origin?: string;
};

export type CreateClientOptions = {
    useHttp2?: boolean;
    profiling?: ProfilingOptions;
    extraHeaders?: RequestInit['headers'];
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

export const createClient = (configuration: ClientConfiguration, options?: CreateClientOptions): ClientInterface => {
    const identifier = configuration.tenantIdentifier;
    const { grab, close: grabClose } = createGrabber({
        useHttp2: options?.useHttp2,
    });

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

    // nothing expect static auth token
    const discoveryConfig: ClientConfiguration = {
        ...commonConfig,
        staticAuthToken: configuration.staticAuthToken,
    };

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
        shopCartApi: createShopApiCaller(grab, configuration, options),
        config: {
            tenantId: configuration.tenantId,
            tenantIdentifier: configuration.tenantIdentifier,
            origin: configuration.origin,
        },
        close: grabClose,
    };
};
