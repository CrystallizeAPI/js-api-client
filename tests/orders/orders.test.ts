import { test, expect, describe, beforeAll } from 'vitest';
import { ClientInterface, createOrderFetcher, createOrderManager } from '../../src';
import { Order } from '@crystallize/schema/pim';
import { createApiClient } from '../util';

describe('Orders Tests', () => {
    let CrystallizeClient: ClientInterface;
    let customerIdentifier: string;
    let lastOrderIdA: string;
    let lastOrderIdB: string;

    beforeAll(() => {
        CrystallizeClient = createApiClient();
        customerIdentifier = 'william.wallace' + Math.random().toString(36).substring(2, 15);
        lastOrderIdA = '';
        lastOrderIdB = '';
    });

    test('Push 2 new Orders', async () => {
        const orderManager = createOrderManager(CrystallizeClient);

        const results = await orderManager.register({
            customer: {
                identifier: customerIdentifier,
                firstName: 'William',
                lastName: 'Wallace',
                type: 'individual',
            },
            cart: [
                {
                    sku: '123',
                    name: 'Bamboo Chair',
                    quantity: 3,
                },
            ],
            pipelines: [
                {
                    pipelineId: '6890cae4b4f0d611f2b6ff7f',
                    stageId: '6890cae4b4f0d611f2b6ff7d',
                },
            ],
        });
        expect(results).toHaveProperty('id');
        lastOrderIdA = results.id;

        const results2 = await orderManager.register({
            customer: {
                identifier: customerIdentifier,
                firstName: 'William-2',
                lastName: 'Wallace-2',
                type: 'individual',
            },
            cart: [
                {
                    sku: '123',
                    name: 'Bamboo Chair 2',
                    quantity: 32,
                },
            ],
            pipelines: [
                {
                    pipelineId: '6890cae4b4f0d611f2b6ff7f',
                    stageId: '6890cae4b4f0d611f2b6ff7e',
                },
            ],
        });
        expect(results2).toHaveProperty('id');
        lastOrderIdB = results2.id;
    });

    test('Get By ID', async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // wait for the orders to be created
        const fetcher = createOrderFetcher(CrystallizeClient).byId;
        const orderA = await fetcher(lastOrderIdA);
        expect(orderA).not.toBeNull();
        if (orderA) {
            expect(orderA.id).toBe(lastOrderIdA);
            expect(orderA.cart[0].name).toBe('Bamboo Chair');
        }
        const orderB = await fetcher(lastOrderIdB);
        expect(orderB).not.toBeNull();
        if (orderB) {
            expect(orderB.id).toBe(lastOrderIdB);
            expect(orderB.cart[0].name).toBe('Bamboo Chair 2');
        }
    });

    test('Oder By Customer ID', async () => {
        const fetcher = createOrderFetcher(CrystallizeClient).byCustomerIdentifier;
        const pagination = await fetcher(customerIdentifier);
        expect(pagination.pageInfo.endCursor).toBeDefined();
        const orderA = pagination.orders.find((order) => order.id === lastOrderIdA);
        expect(orderA).toBeDefined();
        const orderB = pagination.orders.find((order) => order.id === lastOrderIdB);
        expect(orderB).toBeDefined();

        if (orderA && orderB) {
            expect(orderA.cart[0].name).toBe('Bamboo Chair');
            expect(orderB.cart[0].name).toBe('Bamboo Chair 2');
            expect(orderB.cart[0].quantity).toBe(32);
        }
    });

    test('Put in Pipeline Stage', async () => {
        const orderManager = createOrderManager(CrystallizeClient);
        const results = await orderManager.putInPipelineStage<{ firstName: string }>(
            {
                id: lastOrderIdA,
                pipelineId: '6890cae4b4f0d611f2b6ff7f',
                stageId: '6890cae4b4f0d611f2b6ff7c',
            },
            {
                onCustomer: {
                    firstName: true,
                    lastName: true,
                },
                onOrder: {
                    reference: true,
                },
            },
        );
        expect(results).toHaveProperty('id');

        const fetcher = createOrderFetcher(CrystallizeClient).byId;
        const orderA = await fetcher<unknown, unknown, Order['customer']>(lastOrderIdA, {
            onCustomer: {
                firstName: true,
                lastName: true,
            },
        });
        expect(orderA).not.toBeNull();
        if (orderA) {
            expect(orderA.id).toBe(lastOrderIdA);
            expect(orderA.cart[0].name).toBe('Bamboo Chair');
            expect(orderA.customer.firstName).toBe('William');
            expect(orderA.customer.lastName).toBe('Wallace');
            expect(orderA.reference).toBeDefined();
        }
    });

    test('Setting Payments', async () => {
        const orderManager = createOrderManager(CrystallizeClient);

        const results = await orderManager.setPayments(lastOrderIdB, [
            {
                provider: 'cash',
                cash: {
                    cash: '42',
                },
            },
            {
                provider: 'klarna',
                klarna: {
                    id: '1234',
                    merchantReference1: '1234',
                    merchantReference2: '1234',
                },
            },
        ]);

        expect(results).toHaveProperty('id');
        expect(results).toHaveProperty('payment');
        expect(results.payment[0].provider).toBe('cash');
        expect(results.payment[1].provider).toBe('klarna');
    });

    test('Updating order', async () => {
        const orderManager = createOrderManager(CrystallizeClient);

        const results = await orderManager.update<{
            payment: { provider: string }[]; // reuse the type from Schema @todo
            customer: {
                type: unknown;
            };
        }>(
            {
                id: lastOrderIdB,
                customer: {
                    identifier: customerIdentifier,
                    firstName: 'William-2 Updated',
                    lastName: 'Wallace-2 Updated',
                    type: 'individual',
                    addresses: [
                        {
                            type: 'billing',
                            firstName: 'William-2 Updated',
                            lastName: 'Wallace-2 Updated',
                        },
                    ],
                },
                cart: [
                    {
                        sku: '123',
                        name: 'Bamboo Chair 2 Updated',
                        quantity: 42,
                    },
                ],
                payment: [
                    {
                        provider: 'stripe',
                        stripe: {
                            customerId: 'cus_1234',
                            paymentMethodId: 'pm_1234',
                        },
                    },
                ],
            },
            {
                customer: {
                    type: true,
                },
                payment: {
                    provider: true,
                },
            },
        );

        expect(results).toHaveProperty('id');
        expect(results).toHaveProperty('reference');
        expect(results).toHaveProperty('payment');
        expect(results).toHaveProperty('customer');
        expect(results.payment[0].provider).toBe('stripe');
        expect(results.payment[1]).toBeUndefined();
    });
});
