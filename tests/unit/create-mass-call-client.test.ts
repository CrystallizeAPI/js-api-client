import { describe, test, expect, vi } from 'vitest';
import { createMassCallClient } from '../../src/core/create-mass-call-client.js';
import type { ClientInterface } from '../../src/core/client/create-client.js';
import type { ApiCaller } from '../../src/core/client/create-api-caller.js';

const createMockCaller = (results?: Record<string, unknown>): ApiCaller => {
    let callCount = 0;
    return vi.fn(async (query: string) => {
        callCount++;
        return results?.[query] ?? { success: true, call: callCount };
    }) as unknown as ApiCaller;
};

const createMockClient = (overrides?: Partial<Record<string, ApiCaller>>): ClientInterface => {
    return {
        catalogueApi: overrides?.catalogueApi ?? createMockCaller(),
        discoveryApi: overrides?.discoveryApi ?? createMockCaller(),
        pimApi: overrides?.pimApi ?? createMockCaller(),
        nextPimApi: overrides?.nextPimApi ?? createMockCaller(),
        shopCartApi: overrides?.shopCartApi ?? createMockCaller(),
        config: { tenantIdentifier: 'test', tenantId: 'test-id' },
        close: vi.fn(),
        [Symbol.dispose]: vi.fn(),
    };
};

const noopSleeper = () => ({
    wait: () => Promise.resolve(),
    reset: () => {},
});

describe('createMassCallClient', () => {
    test('enqueue returns a unique key', () => {
        const client = createMockClient();
        const mass = createMassCallClient(client, {});
        const key1 = mass.enqueue.pimApi('{ query1 }');
        const key2 = mass.enqueue.pimApi('{ query2 }');
        expect(key1).not.toBe(key2);
        expect(key1).toContain('pimApi');
        expect(key2).toContain('pimApi');
    });

    test('execute runs all enqueued requests and returns results', async () => {
        const pimCaller = createMockCaller();
        const client = createMockClient({ pimApi: pimCaller });
        const mass = createMassCallClient(client, { sleeper: noopSleeper() });

        const key1 = mass.enqueue.pimApi('{ query1 }');
        const key2 = mass.enqueue.pimApi('{ query2 }');
        const results = await mass.execute();

        expect(results[key1]).toBeDefined();
        expect(results[key2]).toBeDefined();
        expect(pimCaller).toHaveBeenCalledTimes(2);
    });

    test('execute with different API types', async () => {
        const client = createMockClient();
        const mass = createMassCallClient(client, { sleeper: noopSleeper() });

        const k1 = mass.enqueue.catalogueApi('{ catalogue }');
        const k2 = mass.enqueue.pimApi('{ pim }');
        const k3 = mass.enqueue.discoveryApi('{ discovery }');
        const results = await mass.execute();

        expect(results[k1]).toBeDefined();
        expect(results[k2]).toBeDefined();
        expect(results[k3]).toBeDefined();
    });

    test('reset clears queue and state', async () => {
        const client = createMockClient();
        const mass = createMassCallClient(client, { sleeper: noopSleeper() });

        mass.enqueue.pimApi('{ query1 }');
        mass.reset();

        const results = await mass.execute();
        expect(Object.keys(results)).toHaveLength(0);
    });

    test('hasFailed and failureCount track failures', async () => {
        const failingCaller = vi.fn().mockRejectedValue(new Error('fail')) as unknown as ApiCaller;
        const client = createMockClient({ pimApi: failingCaller });
        const mass = createMassCallClient(client, { sleeper: noopSleeper() });

        mass.enqueue.pimApi('{ fail1 }');
        mass.enqueue.pimApi('{ fail2 }');
        await mass.execute();

        expect(mass.hasFailed()).toBe(true);
        expect(mass.failureCount()).toBe(2);
    });

    test('retry re-executes failed requests', async () => {
        let callCount = 0;
        const sometimesFails = vi.fn(async () => {
            callCount++;
            if (callCount <= 2) throw new Error('temporary failure');
            return { recovered: true };
        }) as unknown as ApiCaller;

        const client = createMockClient({ pimApi: sometimesFails });
        const mass = createMassCallClient(client, { sleeper: noopSleeper() });

        mass.enqueue.pimApi('{ q1 }');
        mass.enqueue.pimApi('{ q2 }');
        await mass.execute();

        expect(mass.hasFailed()).toBe(true);
        const retryResults = await mass.retry();
        expect(mass.hasFailed()).toBe(false);
        expect(Object.values(retryResults).every((r: any) => r.recovered)).toBe(true);
    });

    test('onFailure callback controls retry queuing', async () => {
        const failingCaller = vi.fn().mockRejectedValue(new Error('fail')) as unknown as ApiCaller;
        const client = createMockClient({ pimApi: failingCaller });
        const onFailure = vi.fn().mockResolvedValue(false); // don't retry

        const mass = createMassCallClient(client, { onFailure, sleeper: noopSleeper() });
        mass.enqueue.pimApi('{ q1 }');
        await mass.execute();

        expect(onFailure).toHaveBeenCalled();
        expect(mass.hasFailed()).toBe(false); // not queued for retry
    });

    test('batch size adapts: increases on success', async () => {
        const caller = createMockCaller();
        const client = createMockClient({ pimApi: caller });
        const batches: Array<{ from: number; to: number }> = [];
        const mass = createMassCallClient(client, {
            initialSpawn: 1,
            maxSpawn: 5,
            sleeper: noopSleeper(),
            onBatchDone: async (batch) => {
                batches.push(batch);
            },
        });

        for (let i = 0; i < 6; i++) {
            mass.enqueue.pimApi(`{ q${i} }`);
        }
        await mass.execute();

        // First batch: 1 item, second: 2 items, third: 3 items = 6 total
        expect(batches[0]).toEqual({ from: 0, to: 1 });
        expect(batches[1]).toEqual({ from: 1, to: 3 });
        expect(batches[2]).toEqual({ from: 3, to: 6 });
    });

    test('batch size does not exceed maxSpawn', async () => {
        const caller = createMockCaller();
        const client = createMockClient({ pimApi: caller });
        const mass = createMassCallClient(client, {
            initialSpawn: 3,
            maxSpawn: 3,
            sleeper: noopSleeper(),
        });

        for (let i = 0; i < 9; i++) {
            mass.enqueue.pimApi(`{ q${i} }`);
        }
        await mass.execute();
        // All batches should be size 3
        expect(caller).toHaveBeenCalledTimes(9);
    });

    test('batch size decreases on errors', async () => {
        let callNum = 0;
        const mixedCaller = vi.fn(async () => {
            callNum++;
            // First batch (3 items): 2 fail = more than half
            if (callNum <= 2) throw new Error('fail');
            return { ok: true };
        }) as unknown as ApiCaller;

        const client = createMockClient({ pimApi: mixedCaller });
        const changeIncrementFor = vi.fn((situation: string, current: number) => {
            if (situation === 'more-than-half-have-failed') return 1;
            if (situation === 'some-have-failed') return current - 1;
            return current + 1;
        });

        const mass = createMassCallClient(client, {
            initialSpawn: 3,
            maxSpawn: 5,
            sleeper: noopSleeper(),
            changeIncrementFor,
        });

        for (let i = 0; i < 5; i++) {
            mass.enqueue.pimApi(`{ q${i} }`);
        }
        await mass.execute();

        expect(changeIncrementFor).toHaveBeenCalled();
    });

    test('beforeRequest and afterRequest hooks are called', async () => {
        const caller = createMockCaller();
        const client = createMockClient({ pimApi: caller });
        const beforeRequest = vi.fn().mockResolvedValue(undefined);
        const afterRequest = vi.fn().mockResolvedValue(undefined);

        const mass = createMassCallClient(client, {
            beforeRequest,
            afterRequest,
            sleeper: noopSleeper(),
        });

        mass.enqueue.pimApi('{ q1 }');
        await mass.execute();

        expect(beforeRequest).toHaveBeenCalledTimes(1);
        expect(afterRequest).toHaveBeenCalledTimes(1);
    });

    test('passes through API callers from original client', () => {
        const client = createMockClient();
        const mass = createMassCallClient(client, {});

        expect(mass.catalogueApi).toBe(client.catalogueApi);
        expect(mass.pimApi).toBe(client.pimApi);
        expect(mass.discoveryApi).toBe(client.discoveryApi);
        expect(mass.nextPimApi).toBe(client.nextPimApi);
        expect(mass.shopCartApi).toBe(client.shopCartApi);
    });
});
