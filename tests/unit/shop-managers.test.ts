import { describe, test, expect, vi } from 'vitest';
import type { ClientInterface } from '../../src/core/client/create-client.js';
import { createShopOrderManager } from '../../src/core/shop/create-shop-order-manager.js';
import { createShopCustomerManager } from '../../src/core/shop/create-shop-customer-manager.js';
import { createShopLock } from '../../src/core/shop/create-shop-lock.js';

const createMockClient = (data: Record<string, unknown>) => {
    const caller = vi.fn(async (_query: string) => data);
    return {
        caller,
        client: {
            shopOrderApi: caller,
            shopCustomerApi: caller,
            shopLockApi: caller,
        } as unknown as ClientInterface,
        lastQuery: () => caller.mock.calls.at(-1)![0],
    };
};

describe('createShopOrderManager', () => {
    const id = '5b2e6a8c-2d4b-4f4e-9a57-0f5c1b0c8e11';
    const order = { id };

    test('fetch', async () => {
        const { client, lastQuery } = createMockClient({ order });
        const result = await createShopOrderManager(client).fetch(id, { reference: true, payments: { meta: true } });
        expect(lastQuery()).toBe(`query { order (id: "${id}") { id reference payments { meta } } }`);
        expect(result).toEqual(order);
    });

    test('listByCustomer', async () => {
        const { client, lastQuery } = createMockClient({ orders: [order] });
        const manager = createShopOrderManager(client);
        expect(await manager.listByCustomer('john@doe.com', { limit: 5, skip: 10 }, { reference: true })).toEqual([
            order,
        ]);
        expect(lastQuery()).toBe(
            'query { orders (customerIdentifier: "john@doe.com", limit: 5, skip: 10) { id reference } }',
        );
        await manager.listByCustomer('john@doe.com');
        expect(lastQuery()).toBe('query { orders (customerIdentifier: "john@doe.com") { id } }');
    });

    test('listByCustomer returns an empty list for a null response', async () => {
        const { client } = createMockClient({ orders: null });
        expect(await createShopOrderManager(client).listByCustomer('john@doe.com')).toEqual([]);
    });

    test('createFromCart', async () => {
        const { client, lastQuery } = createMockClient({ createFromCart: order });
        const manager = createShopOrderManager(client);
        await manager.createFromCart(id);
        expect(lastQuery()).toBe(`mutation { createFromCart (id: "${id}") { id } }`);

        await manager.createFromCart(
            id,
            {
                type: 'standard',
                paymentStatus: 'paid',
                payments: [
                    {
                        provider: 'stripe',
                        transactionId: 'pi_123',
                        amount: 100,
                        method: 'card',
                        createdAt: '2026-10-06T10:00:00.000Z',
                        meta: [{ key: 'intent', value: 'pi_123' }],
                    },
                ],
                pipelines: [{ identifier: 'fulfilment', stage: 'new' }],
                stockLocationIdentifier: 'oslo',
                relatedOrderIds: ['previous'],
                additionalInformation: 'leave at the door',
            },
            { paymentStatus: true },
        );
        expect(lastQuery()).toBe(
            `mutation { createFromCart (id: "${id}", input: {type: standard, paymentStatus: paid, ` +
                `payments: [{provider: "stripe", transactionId: "pi_123", amount: 100, method: "card", ` +
                `createdAt: "2026-10-06T10:00:00.000Z", meta: [{key: "intent", value: "pi_123"}]}], ` +
                `pipelines: [{identifier: "fulfilment", stage: "new"}], stockLocationIdentifier: "oslo", ` +
                `relatedOrderIds: ["previous"], additionalInformation: "leave at the door"}) { id paymentStatus } }`,
        );
    });

    test('createFromCart validates its input', async () => {
        const { client, caller } = createMockClient({ createFromCart: order });
        await expect(
            // @ts-expect-error invalid order type
            createShopOrderManager(client).createFromCart(id, { type: 'unknown' }),
        ).rejects.toThrow();
        expect(caller).not.toHaveBeenCalled();
    });

    test.each(['addPayments', 'setPayments'] as const)('%s', async (method) => {
        const { client, lastQuery } = createMockClient({ [method]: order });
        await createShopOrderManager(client)[method](id, [{ provider: 'klarna', amount: 50 }, { method: 'cash' }], {
            payments: { provider: true },
        });
        expect(lastQuery()).toBe(
            `mutation { ${method} (id: "${id}", payments: [{provider: "klarna", amount: 50}, {method: "cash"}]) ` +
                `{ id payments { provider } } }`,
        );
    });

    test('addPayments validates its input', async () => {
        const { client, caller } = createMockClient({ addPayments: order });
        await expect(
            // @ts-expect-error amount must be a number
            createShopOrderManager(client).addPayments(id, [{ amount: '50' }]),
        ).rejects.toThrow();
        expect(caller).not.toHaveBeenCalled();
    });

    test('setMeta merges by default', async () => {
        const { client, lastQuery } = createMockClient({ setMeta: order });
        const manager = createShopOrderManager(client);
        await manager.setMeta(id, { meta: [{ key: 'source', value: 'web' }] });
        expect(lastQuery()).toBe(
            `mutation { setMeta (id: "${id}", meta: [{key: "source", value: "web"}], merge: true) { id } }`,
        );
        await manager.setMeta(id, { meta: [], merge: false });
        expect(lastQuery()).toBe(`mutation { setMeta (id: "${id}", meta: [], merge: false) { id } }`);
    });

    test('setCustomer', async () => {
        const { client, lastQuery } = createMockClient({ setCustomer: order });
        await createShopOrderManager(client).setCustomer(id, {
            isGuest: false,
            identifier: 'john@doe.com',
            type: 'individual',
            birthDate: new Date('1990-01-02T00:00:00.000Z'),
            addresses: [{ type: 'billing', city: 'Oslo' }],
        });
        expect(lastQuery()).toBe(
            `mutation { setCustomer (id: "${id}", customer: {identifier: "john@doe.com", ` +
                `birthDate: "1990-01-02T00:00:00.000Z", isGuest: false, type: individual, ` +
                `addresses: [{type: billing, city: "Oslo"}]}) { id } }`,
        );
    });

    test('addToStage', async () => {
        const { client, lastQuery } = createMockClient({ addToStage: order });
        await createShopOrderManager(client).addToStage(id, 'fulfilment', 'shipped', { pipelines: { stage: true } });
        expect(lastQuery()).toBe(
            `mutation { addToStage (id: "${id}", pipeline: "fulfilment", stage: "shipped") { id pipelines { stage } } }`,
        );
    });

    test('removeFromPipeline', async () => {
        const { client, lastQuery } = createMockClient({ removeFromPipeline: order });
        await createShopOrderManager(client).removeFromPipeline(id, 'fulfilment');
        expect(lastQuery()).toBe(`mutation { removeFromPipeline (id: "${id}", pipeline: "fulfilment") { id } }`);
    });
});

describe('createShopCustomerManager', () => {
    const customer = { identifier: 'john@doe.com' };

    test('fetch', async () => {
        const { client, lastQuery } = createMockClient({ customer });
        const result = await createShopCustomerManager(client).fetch('john@doe.com', { email: true, meta: true });
        expect(lastQuery()).toBe('query { customer (identifier: "john@doe.com") { identifier email meta } }');
        expect(result).toEqual(customer);
    });

    test('upsert', async () => {
        const { client, lastQuery } = createMockClient({ customer });
        await createShopCustomerManager(client).upsert({
            identifier: 'john@doe.com',
            firstName: 'John',
            type: 'organization',
            externalReferences: [{ key: 'erp', value: '42' }],
            addresses: [{ type: 'delivery', street: 'Main St 1' }, { city: 'Oslo' }],
        });
        expect(lastQuery()).toBe(
            'mutation { customer (input: {identifier: "john@doe.com", firstName: "John", type: organization, ' +
                'externalReferences: [{key: "erp", value: "42"}], ' +
                'addresses: [{type: delivery, street: "Main St 1"}, {city: "Oslo"}]}) { identifier } }',
        );
    });

    test('upsert rejects the cart-only isGuest flag', async () => {
        const { client, caller } = createMockClient({ customer });
        await expect(
            // @ts-expect-error isGuest does not exist on the Shop API /customer input
            createShopCustomerManager(client).upsert({ identifier: 'john@doe.com', isGuest: true }),
        ).rejects.toThrow();
        expect(caller).not.toHaveBeenCalled();
    });

    test('addAddress', async () => {
        const { client, lastQuery } = createMockClient({ addAddress: customer });
        await createShopCustomerManager(client).addAddress('john@doe.com', {
            type: 'billing',
            city: 'Oslo',
            meta: [{ key: 'door', value: 'B' }],
        });
        expect(lastQuery()).toBe(
            'mutation { addAddress (identifier: "john@doe.com", input: {type: billing, city: "Oslo", ' +
                'meta: [{key: "door", value: "B"}]}) { identifier } }',
        );
    });

    test('setAddress', async () => {
        const { client, lastQuery } = createMockClient({ setAddress: customer });
        await createShopCustomerManager(client).setAddress(
            'john@doe.com',
            1,
            { city: 'Bergen' },
            { addresses: { city: true } },
        );
        expect(lastQuery()).toBe(
            'mutation { setAddress (identifier: "john@doe.com", index: 1, input: {city: "Bergen"}) ' +
                '{ identifier addresses { city } } }',
        );
    });

    test('removeAddress', async () => {
        const { client, lastQuery } = createMockClient({ removeAddress: customer });
        await createShopCustomerManager(client).removeAddress('john@doe.com', 0);
        expect(lastQuery()).toBe('mutation { removeAddress (identifier: "john@doe.com", index: 0) { identifier } }');
    });

    test('setMeta merges by default', async () => {
        const { client, lastQuery } = createMockClient({ setMeta: customer });
        await createShopCustomerManager(client).setMeta('john@doe.com', { meta: [{ key: 'tier', value: 'gold' }] });
        expect(lastQuery()).toBe(
            'mutation { setMeta (identifier: "john@doe.com", meta: [{key: "tier", value: "gold"}], merge: true) ' +
                '{ identifier } }',
        );
    });
});

describe('createShopLock', () => {
    test('acquire defaults to a 60 seconds ttl', async () => {
        const { client, lastQuery } = createMockClient({ acquire: true });
        const lock = createShopLock(client);
        expect(await lock.acquire('cart-1')).toBe(true);
        expect(lastQuery()).toBe('mutation { acquire (key: "cart-1", ttl: 60) }');
        await lock.acquire('cart-1', 5);
        expect(lastQuery()).toBe('mutation { acquire (key: "cart-1", ttl: 5) }');
    });

    test('acquire resolves false when the lock is held', async () => {
        const { client } = createMockClient({ acquire: false });
        expect(await createShopLock(client).acquire('cart-1')).toBe(false);
    });

    test('release', async () => {
        const { client, lastQuery } = createMockClient({ release: true });
        expect(await createShopLock(client).release('cart-1')).toBe(true);
        expect(lastQuery()).toBe('mutation { release (key: "cart-1") }');
    });
});
