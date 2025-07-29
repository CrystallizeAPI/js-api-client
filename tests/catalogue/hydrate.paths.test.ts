import { test, expect } from 'vitest';
import { createProductHydrater } from '../../src';
import { createApiClient } from '../util';

test('Hydrate Paths', async () => {
    const CrystallizeClient = createApiClient({
        config: {
            tenantIdentifier: 'furniture',
        },
    });

    const hydrater = createProductHydrater(CrystallizeClient).byPaths;
    const response = await hydrater(
        [
            '/shop/bathroom-fitting/large-mounted-cabinet-in-treated-wood',
            '/shop/bathroom-fitting/mounted-bathroom-counter-with-shelf',
        ],
        'en',
    );

    expect(response.product0.path).toBe('/shop/bathroom-fitting/large-mounted-cabinet-in-treated-wood');
    expect(response.product1.path).toBe('/shop/bathroom-fitting/mounted-bathroom-counter-with-shelf');
});
