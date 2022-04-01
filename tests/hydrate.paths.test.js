const {
    createClient,
    createProductHydraterByPaths
} = require('../dist/index.js');

test('Hydrate Paths', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture'
    });

    const hydrater = createProductHydraterByPaths(CrystallizeClient);
    const response = await hydrater(
        [
            '/shop/bathroom-fitting/large-mounted-cabinet-in-treated-wood',
            '/shop/bathroom-fitting/mounted-bathroom-counter-with-shelf'
        ],
        'en'
    );

    expect(response.product0.path).toBe(
        '/shop/bathroom-fitting/large-mounted-cabinet-in-treated-wood'
    );
    expect(response.product1.path).toBe(
        '/shop/bathroom-fitting/mounted-bathroom-counter-with-shelf'
    );
});
