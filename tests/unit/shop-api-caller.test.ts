import { describe, test, expect, vi, afterEach } from 'vitest';
import {
    createShopApiCaller,
    createShopApiTokenManager,
    shopApiScopesFor,
} from '../../src/core/client/shop-api-caller.js';
import { createClient } from '../../src/core/client/create-client.js';
import type { GrabOptions } from '../../src/core/client/create-grabber.js';
import { mockGrabResponse, defaultConfig } from './helpers.js';

const fakeToken = (scopes: string[], expiresInSeconds = 3600) =>
    [
        'e30',
        Buffer.from(JSON.stringify({ scopes, exp: Math.floor(Date.now() / 1000) + expiresInSeconds })).toString(
            'base64url',
        ),
        'signature',
    ].join('.');

const isTokenRequest = (url: string) => url.endsWith('/auth/token');

/** Issues a token for the requested scopes (unless `refuse` says otherwise) and answers GraphQL calls with data. */
const createShopGrab = ({
    expiresInSeconds = 3600,
    refuse = () => false,
}: { expiresInSeconds?: number; refuse?: (scopes: string[]) => boolean } = {}) =>
    vi.fn(async (url: string, init?: GrabOptions) => {
        if (isTokenRequest(url)) {
            const { scopes } = JSON.parse(init!.body!);
            if (refuse(scopes)) {
                return mockGrabResponse({ jsonData: { success: false, error: 'scope not allowed' } });
            }
            return mockGrabResponse({ jsonData: { success: true, token: fakeToken(scopes, expiresInSeconds) } });
        }
        return mockGrabResponse({ jsonData: { data: { ok: true } } });
    });

type ShopGrab = ReturnType<typeof createShopGrab>;

const requestedScopes = (grab: ShopGrab) =>
    grab.mock.calls.filter(([url]) => isTokenRequest(url)).map(([, init]) => JSON.parse(init!.body!).scopes);

const graphQLCalls = (grab: ShopGrab) =>
    grab.mock.calls
        .filter(([url]) => !isTokenRequest(url))
        .map(([url, init]) => ({ url, authorization: init!.headers!.Authorization }));

const scopesOf = (authorization: string) =>
    JSON.parse(Buffer.from(authorization.replace('Bearer ', '').split('.')[1], 'base64url').toString()).scopes;

describe('shopApiScopesFor', () => {
    test('the endpoint name is the scope', () => {
        expect(shopApiScopesFor('order')).toEqual(['order']);
        expect(shopApiScopesFor('subscription-contract')).toEqual(['subscription-contract']);
    });

    test('admin sub-paths also need the <endpoint>:admin scope', () => {
        expect(shopApiScopesFor('booking/admin')).toEqual(['booking', 'booking:admin']);
    });
});

describe('createShopApiCaller', () => {
    test.each(['cart', 'order', 'lock', 'customer', 'subscription-contract', 'booking'] as const)(
        'builds the URL of the %s endpoint',
        async (endpoint) => {
            const grab = createShopGrab();
            await createShopApiCaller(grab, defaultConfig, undefined, endpoint)('{ ok }');
            expect(graphQLCalls(grab)[0].url).toBe(`https://shop-api.crystallize.com/@test-tenant/${endpoint}`);
        },
    );

    test('defaults to the cart endpoint and the cart scope', async () => {
        const grab = createShopGrab();
        await createShopApiCaller(grab, defaultConfig)('{ ok }');
        expect(requestedScopes(grab)).toEqual([['cart']]);
        expect(graphQLCalls(grab)[0].url).toBe('https://shop-api.crystallize.com/@test-tenant/cart');
    });

    test('uses the custom origin and the staging host', async () => {
        const grab = createShopGrab();
        await createShopApiCaller(
            grab,
            { ...defaultConfig, origin: '-dev.crystallize.digital' },
            undefined,
            'order',
        )('{ ok }');
        await createShopApiCaller(grab, { ...defaultConfig, shopApiStaging: true }, undefined, 'order')('{ ok }');
        expect(graphQLCalls(grab).map(({ url }) => url)).toEqual([
            'https://shop-api-dev.crystallize.digital/@test-tenant/order',
            'https://shop-api-staging.crystallize-edge.workers.dev/@test-tenant/order',
        ]);
    });

    test('admin sub-paths request the admin scope', async () => {
        const grab = createShopGrab();
        await createShopApiCaller(grab, defaultConfig, undefined, 'booking/admin')('{ ok }');
        expect(requestedScopes(grab)).toEqual([['cart', 'booking', 'booking:admin']]);
        expect(graphQLCalls(grab)[0].url).toBe('https://shop-api.crystallize.com/@test-tenant/booking/admin');
    });

    test('fetches the token with the access token headers, without the static auth token', async () => {
        const grab = createShopGrab();
        await createShopApiCaller(grab, { ...defaultConfig, staticAuthToken: 'static' })('{ ok }');
        const [url, init] = grab.mock.calls[0];
        expect(url).toBe('https://shop-api.crystallize.com/@test-tenant/auth/token');
        expect(init!.headers).toMatchObject({
            'X-Crystallize-Access-Token-Id': 'token-id',
            'X-Crystallize-Access-Token-Secret': 'token-secret',
        });
        expect(init!.headers).not.toHaveProperty('X-Crystallize-Static-Auth-Token');
        expect(JSON.parse(init!.body!)).toEqual({ scopes: ['cart'], expiresIn: 3600 * 12 });
    });
});

describe('shared Shop API token', () => {
    const createCallers = (
        grab: ShopGrab,
        configuration = defaultConfig,
        options?: Parameters<typeof createClient>[1],
    ) => {
        const tokenManager = createShopApiTokenManager(grab, configuration, options);
        return {
            cart: createShopApiCaller(grab, configuration, options, 'cart', tokenManager),
            order: createShopApiCaller(grab, configuration, options, 'order', tokenManager),
            lock: createShopApiCaller(grab, configuration, options, 'lock', tokenManager),
        };
    };

    test('widens the token lazily to the union of the scopes in use', async () => {
        const grab = createShopGrab();
        const { cart, order, lock } = createCallers(grab);
        await cart('{ ok }');
        await order('{ ok }');
        await cart('{ ok }');
        await order('{ ok }');
        await lock('{ ok }');
        expect(requestedScopes(grab)).toEqual([['cart'], ['cart', 'order'], ['cart', 'order', 'lock']]);
        const authorizations = graphQLCalls(grab).map(({ authorization }) => scopesOf(authorization));
        expect(authorizations).toEqual([
            ['cart'],
            ['cart', 'order'],
            ['cart', 'order'],
            ['cart', 'order'],
            ['cart', 'order', 'lock'],
        ]);
    });

    test('options.shopApiToken.scopes requests the union up front', async () => {
        const grab = createShopGrab();
        const { cart, order, lock } = createCallers(grab, defaultConfig, {
            shopApiToken: { scopes: ['cart', 'order', 'lock'], expiresIn: 600 },
        });
        await order('{ ok }');
        await cart('{ ok }');
        await lock('{ ok }');
        expect(
            grab.mock.calls.filter(([url]) => isTokenRequest(url)).map(([, init]) => JSON.parse(init!.body!)),
        ).toEqual([{ scopes: ['cart', 'order', 'lock'], expiresIn: 600 }]);
        expect(new Set(graphQLCalls(grab).map(({ authorization }) => authorization)).size).toBe(1);
    });

    test('concurrent calls share one token request', async () => {
        const grab = createShopGrab();
        const { cart } = createCallers(grab);
        await Promise.all([cart('{ ok }'), cart('{ ok }'), cart('{ ok }')]);
        expect(requestedScopes(grab)).toEqual([['cart']]);
    });

    test('a call waiting on a token that lacks its scope widens it', async () => {
        const grab = createShopGrab();
        const { cart, order } = createCallers(grab);
        await Promise.all([cart('{ ok }'), order('{ ok }')]);
        expect(requestedScopes(grab)).toEqual([['cart'], ['cart', 'order']]);
        const orderCall = graphQLCalls(grab).find(({ url }) => url.endsWith('/order'))!;
        expect(scopesOf(orderCall.authorization)).toEqual(['cart', 'order']);
    });

    test('refreshes the token 5 minutes before it expires', async () => {
        const grab = createShopGrab();
        const { cart } = createCallers(grab, { ...defaultConfig, shopApiToken: fakeToken(['cart'], 4 * 60) });
        await cart('{ ok }');
        expect(requestedScopes(grab)).toEqual([['cart']]);

        const freshGrab = createShopGrab();
        const configuredToken = fakeToken(['cart'], 6 * 60);
        await createCallers(freshGrab, { ...defaultConfig, shopApiToken: configuredToken }).cart('{ ok }');
        expect(requestedScopes(freshGrab)).toEqual([]);
        expect(graphQLCalls(freshGrab)[0].authorization).toBe(`Bearer ${configuredToken}`);
    });

    test('a configured token is refetched only when it lacks the scope', async () => {
        const grab = createShopGrab();
        const configuredToken = fakeToken(['cart', 'order']);
        const { cart, order, lock } = createCallers(grab, { ...defaultConfig, shopApiToken: configuredToken });
        await cart('{ ok }');
        await order('{ ok }');
        expect(requestedScopes(grab)).toEqual([]);
        await lock('{ ok }');
        expect(requestedScopes(grab)).toEqual([['cart', 'lock']]);
    });

    test('doNotFetch always uses the configured token', async () => {
        const grab = createShopGrab();
        const configuredToken = fakeToken(['cart'], 60);
        const { order } = createCallers(
            grab,
            { ...defaultConfig, shopApiToken: configuredToken },
            { shopApiToken: { doNotFetch: true } },
        );
        await order('{ ok }');
        expect(requestedScopes(grab)).toEqual([]);
        expect(graphQLCalls(grab)[0].authorization).toBe(`Bearer ${configuredToken}`);
    });

    test('a refused scope fails its caller but is not requested again on later refreshes', async () => {
        // tokens that expire within 5 minutes are refetched on every call
        const grab = createShopGrab({ expiresInSeconds: 60, refuse: (scopes) => scopes.includes('order') });
        const { cart, order } = createCallers(grab);
        await cart('{ ok }');
        await expect(order('{ ok }')).rejects.toThrow('Could not fetch shop api token: scope not allowed');
        await cart('{ ok }');
        expect(requestedScopes(grab)).toEqual([['cart'], ['cart', 'order'], ['cart']]);
    });
});

describe('createClient Shop API callers', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('every shop caller hits its endpoint and they share one token', async () => {
        const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
            if (isTokenRequest(url)) {
                const { scopes } = JSON.parse(init!.body as string);
                return new Response(JSON.stringify({ success: true, token: fakeToken(scopes) }));
            }
            return new Response(JSON.stringify({ data: { ok: true } }));
        });
        vi.stubGlobal('fetch', fetchMock);

        const client = createClient(defaultConfig, {
            shopApiToken: {
                scopes: ['cart', 'order', 'lock', 'customer', 'subscription-contract', 'booking'],
            },
        });
        await client.shopCartApi('{ ok }');
        await client.shopOrderApi('{ ok }');
        await client.shopLockApi('{ ok }');
        await client.shopCustomerApi('{ ok }');
        await client.shopSubscriptionContractApi('{ ok }');
        await client.shopBookingApi('{ ok }');

        const urls = fetchMock.mock.calls.map(([url]) => url);
        expect(urls).toEqual([
            'https://shop-api.crystallize.com/@test-tenant/auth/token',
            'https://shop-api.crystallize.com/@test-tenant/cart',
            'https://shop-api.crystallize.com/@test-tenant/order',
            'https://shop-api.crystallize.com/@test-tenant/lock',
            'https://shop-api.crystallize.com/@test-tenant/customer',
            'https://shop-api.crystallize.com/@test-tenant/subscription-contract',
            'https://shop-api.crystallize.com/@test-tenant/booking',
        ]);
    });
});
