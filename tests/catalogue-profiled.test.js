const { createClient, createCatalogueFetcher } = require('../dist/index.js');
const { VariableType } = require('json-to-graphql-query');

test('Test with Profiling 1 ', async () => {
    const variables = {
        language: 'en',
        path: '/shop/chairs/bamboo-chair',
    };

    const expectedQuery = `query ($language: String!, $path: String!) { catalogue (language: $language, path: $path) { ... on Product { name } } }`;

    let profiledQuery = {};

    const apiClient = createClient(
        {
            tenantIdentifier: 'furniture',
        },
        {
            profiling: {
                onRequest: (query, variables) => {
                    profiledQuery = {
                        ...profiledQuery,
                        onRequest: {
                            query,
                            variables,
                        },
                    };
                },
                onRequestResolved: (processingTimeMs, query, variables) => {
                    profiledQuery = {
                        ...profiledQuery,
                        onRequestResolved: {
                            processingTimeMs,
                            query,
                            variables,
                        },
                    };
                },
            },
        },
    );

    const fetcher = createCatalogueFetcher(apiClient);
    const response = await fetcher(
        {
            __variables: {
                language: 'String!',
                path: 'String!',
            },
            catalogue: {
                __args: {
                    language: new VariableType('language'),
                    path: new VariableType('path'),
                },
                __on: {
                    __typeName: 'Product',
                    name: true,
                },
            },
        },
        variables,
    );

    expect(response.catalogue.name).toBe('Bamboo Chair');
    expect(profiledQuery.onRequest.query).toBe(expectedQuery);
    expect(profiledQuery.onRequest.variables).toBe(variables);

    expect(profiledQuery.onRequestResolved.query).toBe(expectedQuery);
    expect(profiledQuery.onRequestResolved.variables).toBe(variables);
    expect(profiledQuery.onRequestResolved.processingTimeMs).toBeGreaterThan(0);
});
