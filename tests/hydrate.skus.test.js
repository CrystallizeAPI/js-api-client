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
