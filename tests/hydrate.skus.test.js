const { createClient, createProductHydrater } = require('../dist/index.js');

test('Hydrate Skus', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture',
    });

    const hydrater = createProductHydrater(CrystallizeClient).bySkus;
    const response = await hydrater(['b-1628520141076', 'b-1628514494819'], 'en');

    expect(response.product0.path).toBe('/shop/bathroom-fitting/large-mounted-cabinet-in-treated-wood');
    expect(response.product1.path).toBe('/shop/bathroom-fitting/mounted-bathroom-counter-with-shelf');
});

test('Hydrate Skus by using the sync API, should failed with no credentials', async () => {
    try {
        const CrystallizeClient = createClient({
            tenantIdentifier: 'furniture',
            tenantId: '5e662ccf734ba3f6151ee528',
            // accessTokenId: process.env.CRYSTALLIZE_ACCESS_TOKEN_ID,
            // accessTokenSecret: process.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET,
        });

        const hydrater = createProductHydrater(CrystallizeClient, { useSyncApiForSKUs: true }).bySkus;
        await hydrater(['b-1628520141076', 'b-1628514494819'], 'en');
    } catch (exception) {
        expect(exception.code).toBe(403);
    }
});
