const { CrystallizeOrderPusher } = require('../dist/index.js');

test('orderAPi: Test Validation', async () => {
    // it has to fail with 404 because we don't have any credentials
    try {
        const caller = CrystallizeOrderPusher;
        await caller({
            customer: {
                firstName2: 'William',
                lastName: 'Wallace',
            },
            cart: [
                {
                    sku: '123',
                    name: 'Bamboo Chair',
                    quantity: 3,
                },
            ],
        });
    } catch (exception) {
        expect(exception.errors[0].code).toBe('unrecognized_keys');
    }
});

test('orderAPi: Push a new Order', async () => {
    // it has to fail with 404 because we don't have any credentials
    try {
        const caller = CrystallizeOrderPusher;
        await caller({
            customer: {
                firstName: 'William',
                lastName: 'Wallace',
            },
            cart: [
                {
                    sku: '123',
                    name: 'Bamboo Chair',
                    quantity: 3,
                },
            ],
        });
    } catch (exception) {
        expect(exception.code).toBe(404);
    }
});
