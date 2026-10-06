import { decodeJwt } from 'jose';
import { ApiCaller, authenticationHeaders, post, VariablesType } from './create-api-caller.js';
import { apiHost, ClientConfiguration, CreateClientOptions } from './create-client.js';
import { Grab } from './create-grabber.js';

/** The Shop API GraphQL endpoints, each served at `https://shop-api.crystallize.com/@{tenant}/{endpoint}`. */
export type ShopApiEndpoint = 'cart' | 'order' | 'lock' | 'customer' | 'subscription-contract' | 'booking';

export type ShopApiTokenManager = {
    /** Resolves a Shop API token whose scopes include `scopes`, (re)fetching it when needed. */
    getToken: (scopes: string[]) => Promise<string | undefined>;
};

const decodeToken = (token: string) => {
    const { exp, scopes } = decodeJwt(token);
    return {
        expiresAt: Number(exp) * 1000,
        scopes: Array.isArray(scopes) ? (scopes as string[]) : undefined,
    };
};

/**
 * The scopes a token needs to call `endpoint`: the endpoint name (path segment after `@{tenant}`),
 * plus `<name>:admin` for admin sub-paths such as `booking/admin`.
 */
export const shopApiScopesFor = (endpoint: string): string[] => {
    const [name, subPath] = endpoint.split('/');
    return subPath === 'admin' ? [name, `${name}:admin`] : [name];
};

/**
 * One token cache shared by all the Shop API callers of a client.
 * The token is requested with `options.shopApiToken.scopes` (default `['cart']`) and, when a caller needs a
 * scope the cached token lacks, refetched with the union of both. It is also refreshed 5 minutes before expiry.
 */
export const createShopApiTokenManager = (
    grab: Grab['grab'],
    configuration: ClientConfiguration,
    options?: CreateClientOptions,
): ShopApiTokenManager => {
    const identifier = configuration.tenantIdentifier;
    let shopApiToken = configuration.shopApiToken;
    // only widened once a token was actually issued for them, so a refused scope can't break later refreshes
    let tokenScopes = options?.shopApiToken?.scopes || ['cart'];
    let pendingFetch: Promise<void> | undefined;

    const covers = (scopes: string[]) => {
        if (!shopApiToken) {
            return false;
        }
        const { expiresAt, scopes: grantedScopes } = decodeToken(shopApiToken);
        const isTokenAboutToExpireOrIsExpired = expiresAt - Date.now() < 1000 * 60 * 5;
        // a token without a scopes claim (provided by the configuration) is trusted as is
        return !isTokenAboutToExpireOrIsExpired && (!grantedScopes || scopes.every((s) => grantedScopes.includes(s)));
    };

    const fetchToken = async (scopes: string[]) => {
        const requestedScopes = [...new Set([...tokenScopes, ...scopes])];
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
                scopes: requestedScopes,
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
        tokenScopes = requestedScopes;
    };

    return {
        getToken: async (scopes) => {
            if (options?.shopApiToken?.doNotFetch === true) {
                return shopApiToken;
            }
            // another caller may be fetching a token already, it might cover these scopes too
            // (its failure is its own: if it didn't cover us, we fetch below)
            while (pendingFetch) {
                await pendingFetch.catch(() => undefined);
            }
            if (!covers(scopes)) {
                pendingFetch = fetchToken(scopes).finally(() => {
                    pendingFetch = undefined;
                });
                await pendingFetch;
            }
            return shopApiToken;
        },
    };
};

/**
 * Creates a caller for one Shop API endpoint (`cart` by default).
 * Pass the same `tokenManager` to every caller of a client so they share one token.
 */
export const createShopApiCaller = (
    grab: Grab['grab'],
    configuration: ClientConfiguration,
    options?: CreateClientOptions,
    endpoint: ShopApiEndpoint | `${ShopApiEndpoint}/admin` = 'cart',
    tokenManager: ShopApiTokenManager = createShopApiTokenManager(grab, configuration, options),
): ApiCaller => {
    const identifier = configuration.tenantIdentifier;
    const scopes = shopApiScopesFor(endpoint);
    return async function callApi<T>(query: string, variables?: VariablesType): Promise<T> {
        const shopApiToken = await tokenManager.getToken(scopes);
        return post<T>(
            grab,
            apiHost(configuration)([`@${identifier}`, endpoint], 'shop-api'),
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
};
