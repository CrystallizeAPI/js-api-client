import { test, expect } from 'vitest';
import { createSearcher, createClient } from '../src';

test('Search Query Test', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture',
    });

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
    //@ts-ignore
    for await (const item of createSearcher(CrystallizeClient).search('en', nodeQuery, filter, orderBy, pageInfo, {
        total: 14,
        perPage: 5,
    })) {
        expect(item).toBeDefined();
        count++;
    }
    expect(count).toBe(14);

    count = 0;
    //@ts-ignore
    for await (const item of createSearcher(CrystallizeClient).search('en', nodeQuery, filter, orderBy, pageInfo, {
        total: 14,
        perPage: 10,
    })) {
        expect(item).toBeDefined();
        count++;
    }
    expect(count).toBe(14);
});
