import { test, expect, describe, beforeAll } from 'vitest';
import { createCatalogueFetcher, ClientInterface } from '../../src';
import { VariableType } from 'json-to-graphql-query';
import { createApiClient } from '../util';

describe('Client Test with with Profiling on Furniture', () => {
    let apiClient: ClientInterface;
    let profiledQuery: any = {};
    beforeAll(() => {
        apiClient = createApiClient({
            config: {
                tenantIdentifier: 'furniture',
            },
            options: {
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
                    onRequestResolved: ({ resolutionTimeMs, serverTimeMs }, query, variables) => {
                        profiledQuery = {
                            ...profiledQuery,
                            onRequestResolved: {
                                resolutionTimeMs,
                                serverTimeMs,
                                query,
                                variables,
                            },
                        };
                    },
                },
            },
        });
    });

    test('Test with Profiling 1 ', async () => {
        const variables = {
            language: 'en',
            path: '/shop/chairs/bamboo-chair',
        };

        const expectedQuery = `query ($language: String!, $path: String!) { catalogue (language: $language, path: $path) { ... on Product { name } } }`;
        const fetcher = createCatalogueFetcher(apiClient);
        const response = await fetcher<any>(
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
        expect(profiledQuery.onRequestResolved.resolutionTimeMs).toBeGreaterThan(0);
        expect(profiledQuery.onRequestResolved.serverTimeMs).toBeGreaterThan(0);
    });
});
