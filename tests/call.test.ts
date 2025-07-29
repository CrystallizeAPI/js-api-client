import { test, expect } from 'vitest';
import { createClient } from '../src';

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
    const response = await caller<{ catalogue: { name: string } }>(query, {
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
        await caller(query, {
            language: 'en',
            path: '/shop/chairs/bamboo-chair',
        });
    } catch (exception) {
        expect(exception.code).toBe(400);
        expect(exception.statusText).toBe('Bad Request');
    }
});

test('callDiscoApi: Raw fetch ', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'furnitut',
    });

    const caller = CrystallizeClient.discoveryApi;

    const query = `query { 
        browse {
            product(
                path:"/products/coffee/guadalupe-collective"      
            ) {
                hits {
                    path
                    name
                    description
                }
            }
        }
    }`;
    const response = await caller<{ browse: { product: { hits: { path: string }[] } } }>(query);

    expect(response.browse.product.hits[0].path).toBe('/products/coffee/guadalupe-collective');
});
