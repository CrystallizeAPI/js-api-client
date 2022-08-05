const { CrystallizeSubscriptionContractManager } = require('../dist/index.js');

const period = {
    currency: 'eur',
    price: 5010,
    meteredVariables: [
        {
            id: '62eaf0535978d060e4604c84',
            tierType: 'volume',
            tiers: [
                { currency: 'eur', price: 0, threshold: 0 },
                { currency: 'eur', price: 0.6, threshold: 1001 },
            ],
        },
        {
            id: '62eaf0535978d060e4604c85',
            tierType: 'volume',
            tiers: [
                { currency: 'eur', price: 0, threshold: 0 },
                { currency: 'eur', price: 0.02, threshold: 1000001 },
            ],
        },
        {
            id: '62eaf0535978d060e4604c86',
            tierType: 'volume',
            tiers: [
                { currency: 'eur', price: 0, threshold: 0 },
                { currency: 'eur', price: 0.2, threshold: 1001 },
            ],
        },
        {
            id: '62eaf0535978d060e4604c87',
            tierType: 'volume',
            tiers: [
                { currency: 'eur', price: 0, threshold: 0 },
                { currency: 'eur', price: 0.000008, threshold: 1000001 },
            ],
        },
        {
            id: '62eaf0535978d060e4604c88',
            tierType: 'volume',
            tiers: [{ currency: 'eur', price: 250, threshold: 0 }],
        },
    ],
};

const contract = {
    customerIdentifier: 'sebastien@crystallize.com',
    tenantId: '62eaee71f050cc86e5ded7ad',
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
            type: 'billing',
        },
    ],
    status: {
        activeUntil: new Date(),
        currency: 'eur',
        price: 999.666,
        renewAt: new Date(),
    },
    subscriptionPlan: {
        identifier: 'crystal-customer',
        periodId: '62eaf0535978d060e4604c83',
    },
    item: {
        name: 'Standard Crystal Customer, Default SKU',
        sku: 'standard-crystal-customer-1659564197202',
    },
    payment: {
        provider: 'custom',
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

test('pimAPi: Test Validation', async () => {
    // it has to fail with 404 because we don't have any credentials
    try {
        const caller = CrystallizeSubscriptionContractManager.create;
        await caller({
            ...contract,
            initial2: {
                ...period,
            },
        });
    } catch (exception) {
        expect(exception.errors[0].code).toBe('unrecognized_keys');
    }
});

test('pimAPi Push a new Contract', async () => {
    // it has to fail with 404 because we don't have any credentials
    try {
        const caller = CrystallizeSubscriptionContractManager.create;
        await caller({
            ...contract,
            initial: {
                ...period,
            },
            recurring: {
                ...period,
            },
        });
    } catch (exception) {
        expect(exception.code).toBe(403);
    }
});

test('pimAPi Push a new Contract', async () => {
    // it has to fail with 404 because we don't have any credentials
    try {
        const caller = CrystallizeSubscriptionContractManager.update;
        await caller('62ed5f695978d060e4604c99', {
            status: {
                price: 12345567,
            },
        });
    } catch (exception) {
        expect(exception.code).toBe(403);
    }
});
