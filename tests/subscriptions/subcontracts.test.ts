import { test, expect, describe, beforeAll } from 'vitest';
import { ClientInterface, createSubscriptionContractManager } from '../../src';
import { createApiClient } from '../util';
import { ZodError } from 'zod';
import { SubscriptionContractTierType } from '@crystallize/schema/pim';

const period = {
    currency: 'eur',
    price: 5010,
    meteredVariables: [
        {
            identifier: 'tissue',
            tierType: 'volume' as SubscriptionContractTierType,
            tiers: [
                { currency: 'eur', price: 0, threshold: 0 },
                { currency: 'eur', price: 0.6, threshold: 1001 },
            ],
        },
        {
            identifier: 'doctor-trip',
            tierType: 'volume' as SubscriptionContractTierType,
            tiers: [
                { currency: 'eur', price: 0, threshold: 0 },
                { currency: 'eur', price: 0.02, threshold: 1000001 },
            ],
        },
        {
            identifier: 'cry',
            tierType: 'volume' as SubscriptionContractTierType,
            tiers: [
                { currency: 'eur', price: 0, threshold: 0 },
                { currency: 'eur', price: 0.2, threshold: 1001 },
            ],
        },
    ],
};

const contract = {
    customerIdentifier: 'seb',
    addresses: [
        {
            email: 'sebastien@crystallize.com',
            firstName: 'Sebastien',
            lastName: 'Morel',
            streetNumber: '845',
            street: 'Market Street',
            street2: 'Suite 450',
            city: 'San Francisco',
            postalCode: '94122',
            state: 'California',
            country: 'United States of America',
            type: 'billing' as const,
        },
    ],
    status: {
        activeUntil: new Date(Date.now() + 2 * 3600 * 100).toISOString(),
        renewAt: new Date(Date.now() + 2 * 3600 * 100).toISOString(),
    },
    subscriptionPlan: {
        identifier: 'cold-and-flu',
        periodId: '68dac4e99df679448d2f0c4a',
        periodName: 'Monthly',
    },
    item: {
        name: 'Standard Crystal Customer, Default SKU',
        sku: 'immunization-insurance-1705957819758',
        quantity: 2,
    },
    payment: {
        provider: 'custom' as const,
        custom: {
            properties: [
                {
                    property: 'CreditCardToken',
                    value: 'X255380637944327017',
                },
            ],
        },
    },
};

describe('Subscription Contracts Tests', () => {
    let CrystallizeClient: ClientInterface;
    let customerIdentifier: string;
    let contractId: string;

    beforeAll(() => {
        CrystallizeClient = createApiClient();
        customerIdentifier = 'william.wallace' + Math.random().toString(36).substring(2, 15);
        contractId = '';
    });

    test('Test Validation, we do not even call the api here', async () => {
        const manager = createSubscriptionContractManager(CrystallizeClient);
        // it has to fail with 404 because we don't have any credentials
        try {
            const caller = manager.create;
            await caller(contract as any);
        } catch (exception) {
            expect(exception).toBeInstanceOf(ZodError);
            if (exception instanceof ZodError) {
                const firstError = exception.issues[0];
                expect(firstError.code).toBe('invalid_type');
                expect(firstError.path[0]).toBe('recurring');
            }
        }
    });

    test('Push a new Contract', async () => {
        // it has to fail with 404 because we don't have any credentials
        const manager = createSubscriptionContractManager(CrystallizeClient);
        const contractResult = await manager.create({
            ...contract,
            recurring: {
                ...period,
            },
        });
        contractId = contractResult.id;
    });

    test('Update the new Contract', async () => {
        // it has to fail with 404 because we don't have any credentials
        const manager = createSubscriptionContractManager(CrystallizeClient);
        expect(contractId).toBeDefined();
        expect(contractId).not.toBe('');
        await manager.update({
            id: contractId,
            item: {
                name: 'Standard Crystal Customer, Default SKU',
                sku: 'immunization-insurance-1705957819758',
                quantity: 42,
            },
        });
    });
});
