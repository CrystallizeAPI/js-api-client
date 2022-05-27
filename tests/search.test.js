const { CrystallizeSearcher } = require('../dist/index.js');

test('Search Query Test', async () => {
    const nodeQuery = {
        name: true,
        path: true,
    };
    const filter = {
        type: 'PRODUCT',
    };
    const orderBy = undefined;
    const pageInfo = {};

    let count;

    count = 0;
    for await (const item of CrystallizeSearcher.search('en', nodeQuery, filter, orderBy, pageInfo, {
        total: 14,
        perPage: 5,
    })) {
        expect(item).toBeDefined();
        count++;
    }
    expect(count).toBe(14);

    count = 0;
    for await (const item of CrystallizeSearcher.search('en', nodeQuery, filter, orderBy, pageInfo, {
        total: 14,
        perPage: 10,
    })) {
        expect(item).toBeDefined();
        count++;
    }
    expect(count).toBe(14);
});
