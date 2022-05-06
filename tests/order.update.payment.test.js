const { CrystallizeCreateOrderPaymentUpdater } = require('../dist/index.js');

test('pimAPi: Update Order Payment: Test Validation', async () => {
    // it has to fail with 404 because we don't have any credentials
    try {
        const caller = CrystallizeCreateOrderPaymentUpdater;
        const result = await caller('624b2fca14fa92fb50f0b8dd', {
            payment: [
                {
                    provider: 'custom2',
                    custom: {
                        properties: [
                            {
                                property: 'payment_method',
                                value: 'Plopix Coin',
                            },
                            {
                                property: 'amount',
                                value: '112358',
                            },
                        ],
                    },
                },
                {
                    provider: 'custom',
                    custom: {
                        properties: [
                            {
                                property: 'payment_method',
                                value: 'Plopix Coin 2',
                            },
                            {
                                property: 'amount',
                                value: '90',
                            },
                        ],
                    },
                },
            ],
        });
    } catch (exception) {
        expect(exception.errors[0].code).toBe('invalid_enum_value');
    }
});

test('pimAPi: Update Order Payment', async () => {
    // it has to fail with 404 because we don't have any credentials
    try {
        const caller = CrystallizeCreateOrderPaymentUpdater;
        const result = await caller('624b2fca14fa92fb50f0b8dd', {
            payment: [
                {
                    provider: 'custom',
                    custom: {
                        properties: [
                            {
                                property: 'payment_method',
                                value: 'Plopix Coin',
                            },
                            {
                                property: 'amountt',
                                value: '112358',
                            },
                        ],
                    },
                },
                {
                    provider: 'custom',
                    custom: {
                        properties: [
                            {
                                property: 'payment_method',
                                value: 'Plopix Coin 2',
                            },
                            {
                                property: 'amountt',
                                value: '90',
                            },
                        ],
                    },
                },
            ],
        });
    } catch (exception) {
        expect(exception.code).toBe(403);
    }
});
