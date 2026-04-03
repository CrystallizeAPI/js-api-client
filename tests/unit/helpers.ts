import type { GrabResponse } from '../../src/core/client/create-grabber.js';
import type { ClientConfiguration } from '../../src/core/client/create-client.js';

export const mockGrabResponse = (overrides: Partial<GrabResponse> & { jsonData?: unknown } = {}): GrabResponse => {
    const { jsonData = { data: { test: true } }, ...rest } = overrides;
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => null },
        json: () => Promise.resolve(jsonData as any),
        text: () => Promise.resolve(JSON.stringify(jsonData)),
        ...rest,
    };
};

export const defaultConfig: ClientConfiguration = {
    tenantIdentifier: 'test-tenant',
    tenantId: 'test-id',
    accessTokenId: 'token-id',
    accessTokenSecret: 'token-secret',
};
