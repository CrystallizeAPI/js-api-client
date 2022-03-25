const { createClient } = require('../dist/index.js');

test('callCatalogueApi: Raw fetch a product name: Bamboo Chair', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture'
    });

    const caller = CrystallizeClient.catalogueApi;

    const query = ` query ($language: String!, $path: String!) {
                catalogue(language: $language, path: $path) {
                    ... on Product {
                    name
                    }
                }
            }`;
    const response = await caller(query, {
        language: 'en',
        path: '/shop/chairs/bamboo-chair'
    });
    expect(response.catalogue.name).toBe('Bamboo Chair');
});

test('callCatalogueApi: Raw fetch Error', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture'
    });

    const caller = CrystallizeClient.catalogueApi;

    const query = ` query ($langeuage: String!, $path: String!) {
                catalogue(language: $language, path: $path) {
                    ... on Product {
                    name
                    }
                }
            }`;
    const response = await caller(query, {
        language: 'en',
        path: '/shop/chairs/bamboo-chair'
    });
    expect(response.length).toBeGreaterThanOrEqual(1);
});
