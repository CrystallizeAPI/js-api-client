const { CrystallizeClient } = require('../dist/index.js');

test('callCatalogueApi: Raw fetch a product name: Bamboo Chair', async () => {
    CrystallizeClient.configuration = {
        tenantIdentifier: 'furniture'
    };

    const caller = CrystallizeClient.catalogueApi;

    const query = ` query ($language: String!, $path: String!) {
                catalogue(language: $language, path: $path) {
                    ... on Product {
                    name
                    }
                }
            }`;
    const response = await caller(query, {
        "language": "en",
        "path": "/shop/chairs/bamboo-chair"
    });
    expect(response.data.catalogue.name).toBe("Bamboo Chair");

});

