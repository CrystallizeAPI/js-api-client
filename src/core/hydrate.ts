import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from './client';

export type ProductHydrater = (
    items: string[],
    language: string,
    extraQuery?: any,
    perProduct?: (item: string, index: number) => any,
    perVariant?: (item: string, index: number) => any,
) => Promise<any>;

export type ProductHydraterOptions = {
    useSyncApiForSKUs?: boolean;
    marketIdentifiers?: string[];
    priceList?: string;
    priceForEveryone?: boolean;
};

const priceListBlock = {
    startDate: true,
    endDate: true,
    price: true,
    identifier: true,
    modifier: true,
    modifierType: true,
};

function byPaths(client: ClientInterface, options?: ProductHydraterOptions): ProductHydrater {
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
                            ...(options?.priceForEveryone === true
                                ? {
                                      priceForEveryone: priceListBlock,
                                  }
                                : {}),
                            ...(options?.priceList
                                ? {
                                      priceList: {
                                          __args: { identifier: options.priceList },
                                          ...priceListBlock,
                                      },
                                  }
                                : {}),
                            ...(options?.marketIdentifiers
                                ? {
                                      priceFor: {
                                          __args: { marketIdentifiers: options.marketIdentifiers },
                                          ...priceListBlock,
                                      },
                                  }
                                : {}),
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

function bySkus(client: ClientInterface, options?: ProductHydraterOptions): ProductHydrater {
    async function getPathForSkus(skus: string[], language: string): Promise<string[]> {
        const pathsSet = new Set<string>();

        let afterCursor: any;
        async function getNextPage() {
            if (options?.useSyncApiForSKUs) {
                const pimAPIResponse = await client.pimApi(
                    `query GET_PRODUCTS_BY_SKU (
                        $skus: [String!]
                        $language: String!
                        $tenantId: ID!
                        ) {
                        product {
                            getVariants(skus: $skus, language: $language, tenantId: $tenantId) {
                                sku
                                product {
                                    tree {
                                        path
                                    }
                                }
                            }
                        }
                    }`,
                    {
                        skus: skus,
                        language,
                        tenantId: client.config.tenantId,
                    },
                );

                skus.forEach((sku) => {
                    const match = pimAPIResponse.product.getVariants.find((v: any) => v.sku === sku);
                    if (match) {
                        pathsSet.add(match.product.tree.path);
                    }
                });
            } else {
                const searchAPIResponse = await client.searchApi(
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
                        after: afterCursor,
                        language,
                    },
                );

                const { edges, pageInfo } = searchAPIResponse.search || {};

                edges?.forEach((edge: any) => pathsSet.add(edge.node.path));

                if (pageInfo?.hasNextPage) {
                    afterCursor = pageInfo.endCursor;
                    await getNextPage();
                }
            }
        }

        await getNextPage();

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
        return byPaths(client, options)(paths, language, extraQuery, perProduct, perVariant);
    };
}

export function createProductHydrater(client: ClientInterface, options?: ProductHydraterOptions) {
    return {
        byPaths: byPaths(client, options),
        bySkus: bySkus(client, options),
    };
}
