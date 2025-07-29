import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from '../client/create-client.js';

export type ProductHydrater = (
    items: string[],
    language: string,
    extraQuery?: any,
    perProduct?: (item: string, index: number) => any,
    perVariant?: (item: string, index: number) => any,
) => Promise<any>;

export type ProductHydraterOptions = {
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
        const query = {
            productVariants: {
                __args: {
                    skus,
                    language,
                },
                product: {
                    path: true,
                },
            },
        };
        const response = await client.catalogueApi<{ productVariants: { product: { path: string } }[] }>(
            jsonToGraphQLQuery({ query }),
        );
        response.productVariants.forEach((variant) => {
            if (variant.product && variant.product.path) {
                pathsSet.add(variant.product.path);
            }
        });
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
