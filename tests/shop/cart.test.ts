import { test, expect, describe, beforeAll } from 'vitest';
import { ClientInterface, createCartManager, createOrderManager } from '../../src';
import { createApiClient } from '../util';
import { defaultCartContext, CustomerInput } from '@crystallize/schema/shop';

describe('Cart Tests', () => {
    let CrystallizeClient: ClientInterface;
    let customerIdentifier = 'test-customer';
    const items = [
        {
            sku: 'bishop-marble-normal',
            name: 'Bamboo Chair',
            quantity: 2,
        },
    ];
    const customer: CustomerInput = {
        isGuest: true,
        addresses: [
            {
                type: 'billing',
                firstName: 'Test',
                lastName: 'Customer',
            },
        ],
        identifier: 'test-customer',
        firstName: 'Test',
        lastName: 'Customer',
        type: 'individual',
    };

    beforeAll(() => {
        CrystallizeClient = createApiClient();
    });

    test('Hydrate, place and fulfill a cart', async () => {
        const orderManager = createOrderManager(CrystallizeClient);
        const cartManager = createCartManager(CrystallizeClient);

        const cart = await cartManager.hydrate<{
            customer: {
                lastName: string;
            };
        }>(
            {
                context: defaultCartContext,
                customer,
                items,
            },
            {
                customer: {
                    lastName: true,
                },
            },
        );

        expect(cart).toHaveProperty('id');
        expect(cart).toHaveProperty('customer');
        expect(cart.customer).toHaveProperty('lastName');
        expect(cart.customer.lastName).toBe('Customer');

        await cartManager.place(cart.id);

        const order = await orderManager.register({
            cart: items,
            customer: {
                identifier: customerIdentifier,
                type: 'individual',
            },
        });

        await cartManager.fulfill(cart.id, order.id);
    }, 10000);

    test('Hydrate and abandon a cart', async () => {
        const cartManager = createCartManager(CrystallizeClient);

        const cart = await cartManager.hydrate({
            context: defaultCartContext,
            customer,
            items,
        });

        expect(cart).toHaveProperty('id');

        await cartManager.abandon(cart.id);
    });
});
