const { CrystallizeOrderFetcherById } = require('../dist/index.js');

test('Hydrate Paths', async () => {
    const fetcher = CrystallizeOrderFetcherById;
    const order = await fetcher('62557a65be73e0f09258ef69');
    console.log(order);
    // const hydrater = createProductHydraterByPaths(CrystallizeClient);
    // const response = await hydrater(
    //     [
    //         '/shop/bathroom-fitting/large-mounted-cabinet-in-treated-wood',
    //         '/shop/bathroom-fitting/mounted-bathroom-counter-with-shelf'
    //     ],
    //     'en'
    // );

    // expect(response.product0.path).toBe('/shop/bathroom-fitting/large-mounted-cabinet-in-treated-wood');
    // expect(response.product1.path).toBe('/shop/bathroom-fitting/mounted-bathroom-counter-with-shelf');
});
