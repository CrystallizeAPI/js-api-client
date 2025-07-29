import { test, expect, describe, beforeAll } from 'vitest';
import { ClientInterface, createCustomerManager } from '../../src';
import { createApiClient } from '../util';

describe('Customer Manager', () => {
    let apiClient: ClientInterface;
    let customerIdentifier: string;
    beforeAll(() => {
        apiClient = createApiClient();
        customerIdentifier = 'john.doe' + Math.random().toString(36).substring(2, 15);
    });

    test('Test Creating a Customer', async () => {
        const manager = createCustomerManager(apiClient);
        const results = await manager.create<{ firstName: string; lastName: string; email: string }>(
            {
                firstName: 'John',
                lastName: 'Doe',
                identifier: customerIdentifier,
                email: 'plop@asdasd.com',
                type: 'individual',
            },
            {
                firstName: true,
                lastName: true,
                email: true,
            },
        );
        expect(results).toHaveProperty('identifier');
        expect(results.identifier).toBe(customerIdentifier);
        expect(results.firstName).toBe('John');
        expect(results.lastName).toBe('Doe');
    });

    test('Test Updating a Customer', async () => {
        const manager = createCustomerManager(apiClient);
        // todo reuse the type
        const results = await manager.update<{ firstName: string; lastName: string; email: string }>(
            {
                firstName: 'John2',
                lastName: 'Doe',
                identifier: customerIdentifier,
                email: 'plop@asdasd.com',
            },
            {
                firstName: true,
                lastName: true,
                email: true,
            },
        );
        expect(results).toHaveProperty('identifier');
        expect(results.identifier).toBe(customerIdentifier);
        expect(results.firstName).toBe('John2');
        expect(results.lastName).toBe('Doe');
    });

    test('Test Updating a Customer FULL', async () => {
        const manager = createCustomerManager(apiClient);
        // todo reuse the type
        const results = await manager.update({
            firstName: 'John2',
            lastName: 'Doe',
            identifier: customerIdentifier,
            email: 'plop@asdasd.com',
        });
        expect(results).toHaveProperty('identifier');
        expect(results.identifier).toBe(customerIdentifier);
        // expect(results.firstName).toBe('John2');
        // expect(results.lastName).toBe('Doe');
    });
});
