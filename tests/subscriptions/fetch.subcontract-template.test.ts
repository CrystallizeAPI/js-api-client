import { beforeAll, describe, expect, test } from 'vitest';
import { ClientInterface, createSubscriptionContractManager } from '../../src';
import { createApiClient } from '../util';

describe('Test getting a template', async () => {
    let CrystallizeClient: ClientInterface;

    beforeAll(() => {
        CrystallizeClient = createApiClient();
    });

    test('Create a Subscription Contract Template based on a Variant Identity', async () => {
        const manager = createSubscriptionContractManager(CrystallizeClient);

        const template = await manager.createTemplateBasedOnVariantIdentity(
            '/subscriptions/immunization-insurance',
            'immunization-insurance-1705957819758',
            'cold-and-flu',
            '68dac4e99df679448d2f0c4a',
            'default',
            'en',
        );
        expect(template).toHaveProperty('item');
        expect(template).toHaveProperty('subscriptionPlan');
        expect(template).toHaveProperty('recurring');

        expect(template.item.sku).toBe('immunization-insurance-1705957819758');
        expect(template.recurring.price).toBe(42);
        expect(template.recurring.meteredVariables).toHaveLength(3);
    });
});
