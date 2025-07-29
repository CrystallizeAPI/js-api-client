import { test, expect, describe, beforeAll } from 'vitest';
import { ClientInterface, createCustomerGroupManager, createCustomerManager } from '../../src';
import { createApiClient } from '../util';

describe('Customer Group Manager', () => {
    let apiClient: ClientInterface;
    let customerGroupIdentifier: string;
    beforeAll(() => {
        apiClient = createApiClient();
        customerGroupIdentifier = 'CustomerGroup' + Math.random().toString(36).substring(2, 15);
    });

    test('Test Creating a Customer Group', async () => {
        const manager = createCustomerGroupManager(apiClient);
        const results = await manager.create<{ name: string }>(
            {
                identifier: customerGroupIdentifier,
                name: 'Test Group',
            },
            {
                name: true,
            },
        );
        expect(results).toHaveProperty('identifier');
        expect(results).toHaveProperty('name');
        expect(results.identifier).toBe(customerGroupIdentifier);
        expect(results.name).toBe('Test Group');
    });

    test('Test Updating a Customer Group', async () => {
        const manager = createCustomerGroupManager(apiClient);
        const results = await manager.update<{ name: string }>(
            {
                identifier: customerGroupIdentifier,
                name: 'Test Group2',
            },
            {
                name: true,
            },
        );
        expect(results).toHaveProperty('identifier');
        expect(results).toHaveProperty('name');
        expect(results.identifier).toBe(customerGroupIdentifier);
        expect(results.name).toBe('Test Group2');
    });
});
