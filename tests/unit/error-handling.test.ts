import { describe, test, expect, vi } from 'vitest';
import { post, JSApiClientCallError } from '../../src/core/client/create-api-caller.js';
import { mockGrabResponse, defaultConfig } from './helpers.js';

const query = '{ items { id name } }';
const variables = { lang: 'en' };

describe('HTTP error codes', () => {
    const errorCases = [
        { status: 400, statusText: 'Bad Request', message: 'Invalid query syntax' },
        { status: 401, statusText: 'Unauthorized', message: 'Invalid credentials' },
        { status: 403, statusText: 'Forbidden', message: 'Access denied' },
        { status: 404, statusText: 'Not Found', message: 'Endpoint not found' },
        { status: 429, statusText: 'Too Many Requests', message: 'Rate limit exceeded' },
        { status: 500, statusText: 'Internal Server Error', message: 'Server error' },
        { status: 502, statusText: 'Bad Gateway', message: 'Upstream failure' },
        { status: 503, statusText: 'Service Unavailable', message: 'Service down' },
    ];

    test.each(errorCases)(
        'throws JSApiClientCallError for HTTP $status ($statusText)',
        async ({ status, statusText, message }) => {
            const grab = vi.fn().mockResolvedValue(
                mockGrabResponse({
                    ok: false,
                    status,
                    statusText,
                    jsonData: { message, errors: [] },
                }),
            );

            try {
                await post(grab, 'https://api.test.com', defaultConfig, query, variables);
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(JSApiClientCallError);
                const err = e as JSApiClientCallError;
                expect(err.name).toBe('JSApiClientCallError');
                expect(err.code).toBe(status);
                expect(err.statusText).toBe(statusText);
                expect(err.message).toBe(message);
                expect(err.query).toBe(query);
                expect(err.variables).toEqual(variables);
            }
        },
    );

    test('error includes errors array from response', async () => {
        const errors = [
            { field: 'token', message: 'expired' },
            { field: 'scope', message: 'insufficient' },
        ];
        const grab = vi.fn().mockResolvedValue(
            mockGrabResponse({
                ok: false,
                status: 403,
                statusText: 'Forbidden',
                jsonData: { message: 'Forbidden', errors },
            }),
        );

        try {
            await post(grab, 'https://api.test.com', defaultConfig, query);
            expect.unreachable('should have thrown');
        } catch (e) {
            const err = e as JSApiClientCallError;
            expect(err.errors).toEqual(errors);
        }
    });

    test('error defaults variables to empty object when undefined', async () => {
        const grab = vi.fn().mockResolvedValue(
            mockGrabResponse({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                jsonData: { message: 'fail', errors: [] },
            }),
        );

        try {
            await post(grab, 'https://api.test.com', defaultConfig, query);
            expect.unreachable('should have thrown');
        } catch (e) {
            const err = e as JSApiClientCallError;
            expect(err.variables).toEqual({});
        }
    });
});

describe('GraphQL errors in 200 response', () => {
    test('throws on single GraphQL error', async () => {
        const grab = vi.fn().mockResolvedValue(
            mockGrabResponse({
                jsonData: {
                    errors: [{ message: 'Cannot query field "foo" on type "Query"' }],
                    data: null,
                },
            }),
        );

        try {
            await post(grab, 'https://api.test.com', defaultConfig, '{ foo }');
            expect.unreachable('should have thrown');
        } catch (e) {
            const err = e as JSApiClientCallError;
            expect(err).toBeInstanceOf(JSApiClientCallError);
            expect(err.code).toBe(400);
            expect(err.message).toBe('Cannot query field "foo" on type "Query"');
            expect(err.statusText).toBe('Error was returned from the API');
            expect(err.errors).toEqual([{ message: 'Cannot query field "foo" on type "Query"' }]);
        }
    });

    test('uses first error message when multiple GraphQL errors', async () => {
        const grab = vi.fn().mockResolvedValue(
            mockGrabResponse({
                jsonData: {
                    errors: [{ message: 'First error' }, { message: 'Second error' }, { message: 'Third error' }],
                    data: null,
                },
            }),
        );

        try {
            await post(grab, 'https://api.test.com', defaultConfig, '{ bad }');
            expect.unreachable('should have thrown');
        } catch (e) {
            const err = e as JSApiClientCallError;
            expect(err.message).toBe('First error');
            expect(err.errors).toHaveLength(3);
        }
    });

    test('preserves query and variables in GraphQL error', async () => {
        const grab = vi.fn().mockResolvedValue(
            mockGrabResponse({
                jsonData: {
                    errors: [{ message: 'Validation error' }],
                    data: null,
                },
            }),
        );

        const vars = { id: 'abc', limit: 5 };
        try {
            await post(grab, 'https://api.test.com', defaultConfig, 'query Q($id: ID!) { item(id: $id) }', vars);
            expect.unreachable('should have thrown');
        } catch (e) {
            const err = e as JSApiClientCallError;
            expect(err.query).toBe('query Q($id: ID!) { item(id: $id) }');
            expect(err.variables).toEqual(vars);
        }
    });
});

describe('Core Next wrapped errors', () => {
    test('detects errorName at second level of data', async () => {
        const grab = vi.fn().mockResolvedValue(
            mockGrabResponse({
                jsonData: {
                    data: {
                        createItem: {
                            errorName: 'ValidationError',
                            message: 'Name is required',
                        },
                    },
                },
            }),
        );

        try {
            await post(grab, 'https://api.test.com', defaultConfig, 'mutation { createItem }');
            expect.unreachable('should have thrown');
        } catch (e) {
            const err = e as JSApiClientCallError;
            expect(err.code).toBe(400);
            expect(err.message).toBe('[ValidationError] Name is required');
            expect(err.statusText).toContain('Core Next');
        }
    });

    test('uses fallback message when errorName has no message', async () => {
        const grab = vi.fn().mockResolvedValue(
            mockGrabResponse({
                jsonData: {
                    data: {
                        deleteItem: { errorName: 'InternalError' },
                    },
                },
            }),
        );

        try {
            await post(grab, 'https://api.test.com', defaultConfig, 'mutation { deleteItem }');
            expect.unreachable('should have thrown');
        } catch (e) {
            const err = e as JSApiClientCallError;
            expect(err.message).toBe('[InternalError] An error occurred');
        }
    });

    test('does not trigger on normal data without errorName', async () => {
        const grab = vi.fn().mockResolvedValue(
            mockGrabResponse({
                jsonData: {
                    data: {
                        item: { id: '123', name: 'Test' },
                    },
                },
            }),
        );

        const result = await post(grab, 'https://api.test.com', defaultConfig, '{ item }');
        expect(result).toEqual({ item: { id: '123', name: 'Test' } });
    });

    test('does not trigger when errorName is not a string', async () => {
        const grab = vi.fn().mockResolvedValue(
            mockGrabResponse({
                jsonData: {
                    data: {
                        item: { errorName: 42, message: 'not a real error' },
                    },
                },
            }),
        );

        const result = await post(grab, 'https://api.test.com', defaultConfig, '{ item }');
        expect(result).toEqual({ item: { errorName: 42, message: 'not a real error' } });
    });
});

describe('network failures', () => {
    test('propagates network error from grab', async () => {
        const grab = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

        await expect(post(grab, 'https://api.test.com', defaultConfig, query)).rejects.toThrow('fetch failed');
    });

    test('propagates DNS resolution failure', async () => {
        const grab = vi.fn().mockRejectedValue(new TypeError('getaddrinfo ENOTFOUND api.test.com'));

        await expect(post(grab, 'https://api.test.com', defaultConfig, query)).rejects.toThrow('ENOTFOUND');
    });

    test('propagates connection refused', async () => {
        const grab = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:443'));

        await expect(post(grab, 'https://api.test.com', defaultConfig, query)).rejects.toThrow('ECONNREFUSED');
    });

    test('propagates connection reset', async () => {
        const grab = vi.fn().mockRejectedValue(new Error('read ECONNRESET'));

        await expect(post(grab, 'https://api.test.com', defaultConfig, query)).rejects.toThrow('ECONNRESET');
    });
});

describe('timeout scenarios', () => {
    test('passes abort signal when timeout is configured', async () => {
        const grab = vi.fn().mockResolvedValue(mockGrabResponse({ jsonData: { data: { ok: true } } }));

        await post(grab, 'https://api.test.com', defaultConfig, query, undefined, undefined, {
            timeout: 5000,
        });

        expect(grab).toHaveBeenCalledWith(
            'https://api.test.com',
            expect.objectContaining({
                signal: expect.any(AbortSignal),
            }),
        );
    });

    test('does not pass signal when no timeout configured', async () => {
        const grab = vi.fn().mockResolvedValue(mockGrabResponse({ jsonData: { data: { ok: true } } }));

        await post(grab, 'https://api.test.com', defaultConfig, query);

        const callArgs = grab.mock.calls[0][1];
        expect(callArgs.signal).toBeUndefined();
    });

    test('propagates abort error on timeout', async () => {
        const grab = vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'TimeoutError'));

        await expect(
            post(grab, 'https://api.test.com', defaultConfig, query, undefined, undefined, {
                timeout: 1,
            }),
        ).rejects.toThrow('The operation was aborted');
    });
});

describe('malformed responses', () => {
    test('propagates JSON parse error on HTTP error with invalid body', async () => {
        const grab = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            headers: { get: () => null },
            json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
            text: () => Promise.resolve('<html>Server Error</html>'),
        });

        await expect(post(grab, 'https://api.test.com', defaultConfig, query)).rejects.toThrow(SyntaxError);
    });

    test('propagates JSON parse error on 200 with invalid body', async () => {
        const grab = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: { get: () => null },
            json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
            text: () => Promise.resolve(''),
        });

        await expect(post(grab, 'https://api.test.com', defaultConfig, query)).rejects.toThrow(SyntaxError);
    });
});

describe('204 No Content', () => {
    test('returns empty object', async () => {
        const grab = vi.fn().mockResolvedValue(mockGrabResponse({ ok: true, status: 204, statusText: 'No Content' }));

        const result = await post(grab, 'https://api.test.com', defaultConfig, 'mutation { delete }');
        expect(result).toEqual({});
    });

    test('does not attempt to parse JSON body', async () => {
        const jsonFn = vi.fn();
        const grab = vi.fn().mockResolvedValue({
            ok: true,
            status: 204,
            statusText: 'No Content',
            headers: { get: () => null },
            json: jsonFn,
            text: () => Promise.resolve(''),
        });

        await post(grab, 'https://api.test.com', defaultConfig, 'mutation { delete }');
        expect(jsonFn).not.toHaveBeenCalled();
    });
});

describe('JSApiClientCallError properties', () => {
    test('is an instance of Error', () => {
        const err = new JSApiClientCallError({
            message: 'test',
            code: 500,
            statusText: 'Error',
            query: '{ q }',
            variables: {},
        });
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(JSApiClientCallError);
    });

    test('has correct name property', () => {
        const err = new JSApiClientCallError({
            message: 'test',
            code: 400,
            statusText: 'Bad Request',
            query: '{ q }',
            variables: {},
        });
        expect(err.name).toBe('JSApiClientCallError');
    });

    test('stores all constructor properties', () => {
        const errors = [{ field: 'x' }];
        const err = new JSApiClientCallError({
            message: 'Something broke',
            code: 422,
            statusText: 'Unprocessable Entity',
            query: 'mutation M { m }',
            variables: { id: '1' },
            errors,
        });
        expect(err.message).toBe('Something broke');
        expect(err.code).toBe(422);
        expect(err.statusText).toBe('Unprocessable Entity');
        expect(err.query).toBe('mutation M { m }');
        expect(err.variables).toEqual({ id: '1' });
        expect(err.errors).toEqual(errors);
    });

    test('has a stack trace', () => {
        const err = new JSApiClientCallError({
            message: 'test',
            code: 500,
            statusText: 'Error',
            query: '',
            variables: {},
        });
        expect(err.stack).toBeDefined();
        expect(err.stack).toContain('JSApiClientCallError');
    });

    test('uses default values when provided', () => {
        const err = new JSApiClientCallError({
            message: 'An error occurred while calling the API',
            code: 500,
            statusText: 'Internal Server Error',
            query: '',
            variables: {},
        });
        expect(err.message).toBe('An error occurred while calling the API');
        expect(err.code).toBe(500);
        expect(err.errors).toBeUndefined();
    });
});
