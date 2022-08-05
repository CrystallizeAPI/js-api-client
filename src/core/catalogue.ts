import { ClientInterface, VariablesType } from './client';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import {
    CatalogueFetcherGrapqhqlOnComponent,
    CatalogueFetcherGrapqhqlOnDocument,
    CatalogueFetcherGrapqhqlOnFolder,
    CatalogueFetcherGrapqhqlOnItem,
    CatalogueFetcherGrapqhqlOnProduct,
    CatalogueFetcherGrapqhqlOnSubscriptionPlan,
    componentType,
    ComponentType,
} from '../types/catalogue';

export function createCatalogueFetcher(client: ClientInterface) {
    return <T>(query: any, variables?: VariablesType): Promise<T> => {
        return client.catalogueApi(jsonToGraphQLQuery({ query }), variables);
    };
}

export const catalogueFetcherGraphqlBuilder = {
    onItem,
    onProduct,
    onDocument,
    onFolder,
    onComponent,
    onSubscriptionPlan,
};

function onItem(onItem?: any, c?: CatalogueFetcherGrapqhqlOnItem): any {
    return {
        __typeName: 'Item',
        __typename: true,
        name: true,
        path: true,
        ...onItem,
        topics: {
            name: true,
            path: true,
            ...(c?.onTopic ? c.onTopic : {}),
        },
    };
}

function onDocument(onDocument?: any, c?: CatalogueFetcherGrapqhqlOnDocument): any {
    return {
        __typeName: 'Document',
        __typename: true,
        ...onDocument,
    };
}

function onFolder(onFolder?: any, c?: CatalogueFetcherGrapqhqlOnFolder): any {
    const children = () => {
        if (c?.onChildren) {
            return {
                chidlren: {
                    ...c.onChildren,
                },
            };
        }
        return {};
    };

    return {
        __typeName: 'Folder',
        __typename: true,
        ...onFolder,
        ...children(),
    };
}

function onProduct(onProduct?: any, c?: CatalogueFetcherGrapqhqlOnProduct): any {
    const priceVariant = () => {
        if (c?.onPriceVariant) {
            return {
                priceVariants: {
                    ...c.onPriceVariant,
                },
            };
        }
        return {};
    };

    const variants = () => {
        if (c?.onVariant) {
            return {
                variants: {
                    name: true,
                    sku: true,
                    price: true,
                    ...priceVariant(),
                    ...(c?.onVariant ? c.onVariant : {}),
                },
            };
        }
        return {};
    };

    const defaultVariant = () => {
        if (c?.onDefaultVariant) {
            return {
                defaultVariant: {
                    ...c.onDefaultVariant,
                },
            };
        }
        return {};
    };

    return {
        __typeName: 'Product',
        __typename: true,
        ...onProduct,
        vatType: {
            name: true,
            percent: true,
        },
        ...defaultVariant(),
        ...variants(),
    };
}

/**
 * Convert hyphenated string to camel cased string
 * @param id A string with potentially hyphens in Item
 * @returns A camel cased string
 */
const camelCaseHyphens = (id: string): string => id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

function onComponent(id: string, type: ComponentType, onComponent?: any, c?: CatalogueFetcherGrapqhqlOnComponent): any {
    const validType = componentType.parse(type);
    const aliasName = camelCaseHyphens(id);
    return {
        [aliasName]: {
            __aliasFor: 'component',
            __args: {
                id,
            },
            content: {
                __typename: true,
                __on: {
                    __typeName: validType,
                    ...onComponent,
                },
            },
        },
    };
}

function onSubscriptionPlan(c?: CatalogueFetcherGrapqhqlOnSubscriptionPlan): any {
    const period = (name: string) => {
        return {
            ...(c?.onPeriod ? c.onPeriod(name) : {}),
            priceVariants: {
                identifier: true,
                name: true,
                price: true,
                currency: true,
            },
            meteredVariables: {
                id: true,
                name: true,
                identifier: true,
                tierType: true,
                tiers: {
                    threshold: true,
                    priceVariants: {
                        identifier: true,
                        name: true,
                        price: true,
                        currency: true,
                    },
                },
            },
        };
    };
    return {
        subscriptionPlans: {
            identifier: true,
            name: true,
            periods: {
                id: true,
                name: true,
                initial: period('initial'),
                recurring: period('recurring'),
            },
        },
    };
}
