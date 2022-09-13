const { createClient } = require('../dist/index.js');

test('callCatalogueApi: Raw fetch a product name: Bamboo Chair', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture',
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
        path: '/shop/chairs/bamboo-chair',
    });
    expect(response.catalogue.name).toBe('Bamboo Chair');
});

test('callCatalogueApi DEV: Raw fetch a product name: Bamboo Chair', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture',
        origin: '-dev.crystallize.digital',
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
        path: '/shop/chairs/bamboo-chair',
    });
    expect(response.catalogue.name).toBe('Bamboo Chair');
});

test('callCatalogueApi: Raw fetch Error', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture',
    });

    const caller = CrystallizeClient.catalogueApi;

    const query = ` query ($langeuage: String!, $path: String!) {
                catalogue(language: $language, path: $path) {
                    ... on Product {
                    name
                    }
                }
            }`;

    try {
        const response = await caller(query, {
            language: 'en',
            path: '/shop/chairs/bamboo-chair',
        });
    } catch (exception) {
        expect(exception.code).toBe(400);
        expect(exception.statusText).toBe('Bad Request');
    }
});

test('callSearchApi: Raw fetch Skus', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furniture',
    });

    const caller = CrystallizeClient.searchApi;

    const query = `query GET_PRODUCTS_BY_SKU ($skus: [String!], $after: String, $language: String!) {
            search (
              after: $after
              language: $language
              filter: {
                include: {
                  skus: $skus
                }
              }
            ) {
              pageInfo {
                endCursor
                hasNextPage
              }
              edges {
                node {
                  path
                }
              }
            }
          }`;
    const response = await caller(query, {
        skus: ['b-1628520141076'],
        language: 'en',
    });

    expect(response.search.edges[0].node.path).toBe('/shop/bathroom-fitting/large-mounted-cabinet-in-treated-wood');
});
