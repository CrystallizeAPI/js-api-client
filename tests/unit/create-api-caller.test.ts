import { describe, test, expect, vi } from 'vitest';
import {
    createApiCaller,
    post,
    authenticationHeaders,
    JSApiClientCallError,
} from '../../src/core/client/create-api-caller.js';
import type { Grab, GrabResponse } from '../../src/core/client/create-grabber.js';
import { mockGrabResponse, defaultConfig } from './helpers.js';

const mockGrab = (response: GrabResponse): Grab['grab'] => {
    return vi.fn().mockResolvedValue(response);
};

describe('authenticationHeaders', () => {
    test('returns session cookie when sessionId is set', () => {
        const headers = authenticationHeaders({ ...defaultConfig, sessionId: 'sess123' });
        expect(headers).toEqual({ Cookie: 'connect.sid=sess123' });
    });

    test('returns static auth token when set (and no sessionId)', () => {
        const headers = authenticationHeaders({ ...defaultConfig, staticAuthToken: 'static-tok' });
        expect(headers).toEqual({ 'X-Crystallize-Static-Auth-Token': 'static-tok' });
    });

    test('sessionId takes priority over staticAuthToken', () => {
        const headers = authenticationHeaders({
            ...defaultConfig,
            sessionId: 'sess123',
            staticAuthToken: 'static-tok',
        });
        expect(headers).toEqual({ Cookie: 'connect.sid=sess123' });
    });

    test('returns access token headers when no session or static token', () => {
        const headers = authenticationHeaders(defaultConfig);
        expect(headers).toEqual({
            'X-Crystallize-Access-Token-Id': 'token-id',
            'X-Crystallize-Access-Token-Secret': 'token-secret',
        });
    });

    test('returns empty headers when no auth is configured', () => {
        const config: ClientConfiguration = { tenantIdentifier: 'test' };
        expect(authenticationHeaders(config)).toEqual({});
    });
});

describe('post', () => {
    test('successful response returns data', async () => {
        const grab = mockGrab(mockGrabResponse({ jsonData: { data: { items: [1, 2, 3] } } }));
        const result = await post(grab, 'https://api.test.com', defaultConfig, '{ items }');
        expect(result).toEqual({ items: [1, 2, 3] });
    });

    test('passes query and variables in request body', async () => {
        const grab = mockGrab(mockGrabResponse());
        await post(grab, 'https://api.test.com', defaultConfig, '{ items }', { limit: 10 });
        expect(grab).toHaveBeenCalledWith(
            'https://api.test.com',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ query: '{ items }', variables: { limit: 10 } }),
            }),
        );
    });

    test('includes authentication headers', async () => {
        const grab = mockGrab(mockGrabResponse());
        await post(grab, 'https://api.test.com', defaultConfig, '{ items }');
        expect(grab).toHaveBeenCalledWith(
            'https://api.test.com',
            expect.objectContaining({
                headers: expect.objectContaining({
                    'X-Crystallize-Access-Token-Id': 'token-id',
                    'X-Crystallize-Access-Token-Secret': 'token-secret',
                    'Content-type': 'application/json; charset=UTF-8',
                }),
            }),
        );
    });

    test('204 No Content returns empty object', async () => {
        const grab = mockGrab(mockGrabResponse({ ok: true, status: 204, statusText: 'No Content' }));
        const result = await post(grab, 'https://api.test.com', defaultConfig, 'mutation { delete }');
        expect(result).toEqual({});
    });

    test('throws JSApiClientCallError on HTTP error', async () => {
        const grab = mockGrab(
            mockGrabResponse({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                jsonData: { message: 'Invalid credentials', errors: [{ field: 'token' }] },
            }),
        );
        try {
            await post(grab, 'https://api.test.com', defaultConfig, '{ items }');
            expect.unreachable('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(JSApiClientCallError);
            const err = e as JSApiClientCallError;
            expect(err.name).toBe('JSApiClientCallError');
            expect(err.code).toBe(401);
            expect(err.statusText).toBe('Unauthorized');
            expect(err.query).toBe('{ items }');
        }
    });

    test('throws on GraphQL errors in 200 response', async () => {
        const grab = mockGrab(
            mockGrabResponse({
                jsonData: {
                    errors: [{ message: 'Field "foo" not found' }],
                    data: null,
                },
            }),
        );
        try {
            await post(grab, 'https://api.test.com', defaultConfig, '{ foo }');
            expect.unreachable('should have thrown');
        } catch (e) {
            const err = e as JSApiClientCallError;
            expect(err.code).toBe(400);
            expect(err.message).toBe('Field "foo" not found');
            expect(err.statusText).toBe('Error was returned from the API');
        }
    });

    test('detects Core Next wrapped errors', async () => {
        const grab = mockGrab(
            mockGrabResponse({
                jsonData: {
                    data: {
                        someOperation: {
                            errorName: 'ItemNotFound',
                            message: 'The item does not exist',
                        },
                    },
                },
            }),
        );
        try {
            await post(grab, 'https://api.test.com', defaultConfig, '{ someOperation }');
            expect.unreachable('should have thrown');
        } catch (e) {
            const err = e as JSApiClientCallError;
            expect(err.code).toBe(400);
            expect(err.message).toBe('[ItemNotFound] The item does not exist');
            expect(err.statusText).toContain('Core Next');
        }
    });

    test('Core Next error without message uses fallback', async () => {
        const grab = mockGrab(
            mockGrabResponse({
                jsonData: {
                    data: {
                        op: { errorName: 'GenericError' },
                    },
                },
            }),
        );
        try {
            await post(grab, 'https://api.test.com', defaultConfig, '{ op }');
            expect.unreachable('should have thrown');
        } catch (e) {
            const err = e as JSApiClientCallError;
            expect(err.message).toBe('[GenericError] An error occurred');
        }
    });

    test('includes extra headers from options', async () => {
        const grab = mockGrab(mockGrabResponse());
        await post(grab, 'https://api.test.com', defaultConfig, '{ items }', undefined, {
            headers: { 'X-Custom': 'value' },
        });
        expect(grab).toHaveBeenCalledWith(
            'https://api.test.com',
            expect.objectContaining({
                headers: expect.objectContaining({ 'X-Custom': 'value' }),
            }),
        );
    });

    test('error includes query and variables for debugging', async () => {
        const grab = mockGrab(
            mockGrabResponse({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                jsonData: { message: 'Server error', errors: [] },
            }),
        );
        const variables = { id: '123' };
        try {
            await post(grab, 'https://api.test.com', defaultConfig, '{ item(id: $id) }', variables);
            expect.unreachable('should have thrown');
        } catch (e) {
            const err = e as JSApiClientCallError;
            expect(err.query).toBe('{ item(id: $id) }');
            expect(err.variables).toEqual({ id: '123' });
        }
    });
});

describe('createApiCaller', () => {
    test('returns a callable function', () => {
        const grab = mockGrab(mockGrabResponse());
        const caller = createApiCaller(grab, 'https://api.test.com', defaultConfig);
        expect(typeof caller).toBe('function');
    });

    test('caller delegates to post with correct URL', async () => {
        const grab = mockGrab(mockGrabResponse({ jsonData: { data: { result: 42 } } }));
        const caller = createApiCaller(grab, 'https://api.test.com/graphql', defaultConfig);
        const result = await caller('{ result }');
        expect(result).toEqual({ result: 42 });
        expect(grab).toHaveBeenCalledWith('https://api.test.com/graphql', expect.anything());
    });

    test('passes extra headers from options', async () => {
        const grab = mockGrab(mockGrabResponse());
        const caller = createApiCaller(grab, 'https://api.test.com', defaultConfig, {
            extraHeaders: { 'X-Tenant': 'test' },
        });
        await caller('{ items }');
        expect(grab).toHaveBeenCalledWith(
            'https://api.test.com',
            expect.objectContaining({
                headers: expect.objectContaining({ 'X-Tenant': 'test' }),
            }),
        );
    });
});

describe('profiling', () => {
    test('calls onRequest and onRequestResolved', async () => {
        const onRequest = vi.fn();
        const onRequestResolved = vi.fn();
        const grab = mockGrab(
            mockGrabResponse({
                headers: { get: (name: string) => (name === 'server-timing' ? 'total;dur=42.5' : null) },
            }),
        );
        const caller = createApiCaller(grab, 'https://api.test.com', defaultConfig, {
            profiling: { onRequest, onRequestResolved },
        });
        await caller('{ items }', { limit: 5 });
        expect(onRequest).toHaveBeenCalledWith('{ items }', { limit: 5 });
        expect(onRequestResolved).toHaveBeenCalledWith(
            expect.objectContaining({
                serverTimeMs: 42.5,
                resolutionTimeMs: expect.any(Number),
            }),
            '{ items }',
            { limit: 5 },
        );
    });

    test('handles missing server-timing header', async () => {
        const onRequestResolved = vi.fn();
        const grab = mockGrab(mockGrabResponse());
        const caller = createApiCaller(grab, 'https://api.test.com', defaultConfig, {
            profiling: { onRequestResolved },
        });
        await caller('{ items }');
        expect(onRequestResolved).toHaveBeenCalledWith(
            expect.objectContaining({ serverTimeMs: -1 }),
            '{ items }',
            undefined,
        );
    });
});
