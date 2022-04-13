const { CrystallizeOrderFetcherById, CrystallizeOrderFetcherByCustomerIdentifier } = require('../dist/index.js');

test('Oder By ID', async () => {
    const fetcher = CrystallizeOrderFetcherById;
    try {
        // it has to fail with 404 because we don't have any credentials
        const order = await fetcher('62557a65be73e0f09258ef69');
        expect(order.cart[0].name).toBe('sofa');
    } catch (exception) {
        expect(exception.code).toBe(404);
    }
});

test('Oder By Customer ID', async () => {
    const fetcher = CrystallizeOrderFetcherByCustomerIdentifier;
    try {
        // it has to fail with 404 because we don't have any credentials
        const pagination = await fetcher('GillesC.');
        expect(pagination.orders[0].cart[0].name).toBe('iteasadadsdm1');
        expect(pagination.orders[1].cart[0].name).toBe('item1');
        expect(pagination.orders[1].cart[0].quantity).toBe(1);
    } catch (exception) {
        expect(exception.code).toBe(404);
    }
});
