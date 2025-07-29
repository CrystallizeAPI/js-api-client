import { test, expect, describe, beforeAll } from 'vitest';
import { ClientInterface, createCartManager, createOrderFetcher, createOrderManager } from '../../src';
import { createApiClient } from '../util';
import { AddressType, defaultCartContext } from '@crystallize/schema/shop';

describe('Cart Tests', () => {
    let CrystallizeClient: ClientInterface;
    let cartId: string;

    beforeAll(() => {
        CrystallizeClient = createApiClient();
    });

    test('Hydrate a Cart', async () => {
        const cartManager = createCartManager(CrystallizeClient);
        const cart = await cartManager.hydrate<{
            customer: {
                lastName: string;
            };
        }>(
            {
                context: defaultCartContext,
                customer: {
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
                },
                items: [
                    {
                        sku: 'bishop-marble-normal',
                        quantity: 2,
                    },
                ],
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
    });
});
