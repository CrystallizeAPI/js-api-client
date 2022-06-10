import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from './client';

export type ProductHydrater = (
    items: string[],
    language: string,
    extraQuery?: any,
    perProduct?: (item: string, index: number) => any,
    perVariant?: (item: string, index: number) => any,
) => Promise<any>;

function byPaths(client: ClientInterface): ProductHydrater {
    return <T>(
        paths: string[],
        language: string,
        extraQuery?: any,
        perProduct?: (path: string, index: number) => any,
        perVariant?: (path: string, index: number) => any,
    ): Promise<T> => {
        const productListQuery = paths.reduce((acc, path: string, index: number) => {
            acc[`product${index}`] = {
                __aliasFor: 'catalogue',
                __args: { path, language },
                name: true,
                path: true,
                __on: {
                    __typeName: 'Product',
                    vatType: {
                        name: true,
                        percent: true,
                    },
                    variants: {
                        sku: true,
                        name: true,
                        attributes: {
                            attribute: true,
                            value: true,
                        },
                        priceVariants: {
                            name: true,
                            price: true,
                            identifier: true,
                            currency: true,
                        },
                        ...(perVariant !== undefined ? perVariant(path, index) : {}),
                    },
                    ...(perProduct !== undefined ? perProduct(path, index) : {}),
                },
            };
            return acc;
        }, {} as any);

        const query = {
            ...{ ...productListQuery },
            ...(extraQuery !== undefined ? extraQuery : {}),
        };

        const fetch = client.catalogueApi;
        return fetch(jsonToGraphQLQuery({ query }));
    };
}

function bySkus(client: ClientInterface): ProductHydrater {
    async function getPathForSkus(skus: string[], language: string): Promise<string[]> {
        const search = client.searchApi;
        const pathsSet = new Set<string>();
        let searchAfterCursor: any;
        async function getNextSearchPage() {
            const searchAPIResponse = await search(
                `query GET_PRODUCTS_BY_SKU ($skus: [String!], $after: String, $language: String!) {
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
                }`,
                {
                    skus: skus,
                    after: searchAfterCursor,
                    language,
                },
            );

            const { edges, pageInfo } = searchAPIResponse.search || {};

            edges?.forEach((edge: any) => pathsSet.add(edge.node.path));

            if (pageInfo?.hasNextPage) {
                searchAfterCursor = pageInfo.endCursor;
                await getNextSearchPage();
            }
        }

        await getNextSearchPage();

        return Array.from(pathsSet);
    }
    return async <T>(
        skus: string[],
        language: string,
        extraQuery?: any,
        perProduct?: (item: string, index: number) => any,
        perVariant?: (item: string, index: number) => any,
    ): Promise<T> => {
        const paths = await getPathForSkus(skus, language);
        if (paths.length === 0) {
            const empty = skus.reduce((acc, sku, index) => {
                acc[`product${index}`] = {};
                return acc;
            }, {} as any);

            return empty as any;
        }
        return byPaths(client)(paths, language, extraQuery, perProduct, perVariant);
    };
}

export function createProductHydrater(client: ClientInterface): {
    byPaths: ProductHydrater;
    bySkus: ProductHydrater;
} {
    return {
        byPaths: byPaths(client),
        bySkus: bySkus(client),
    };
}
