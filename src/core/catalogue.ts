import { ClientInterface } from './client';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import {
    CatalogueFetcherGrapqhqlOnComponent,
    CatalogueFetcherGrapqhqlOnDocument,
    CatalogueFetcherGrapqhqlOnFolder,
    CatalogueFetcherGrapqhqlOnItem,
    CatalogueFetcherGrapqhqlOnProduct,
    componentType,
    ComponentType
} from '../types/catalogue.types';

export function createCatalogueFetcher(client: ClientInterface) {
    return <T>(query: any): Promise<T> => {
        return client.catalogueApi(jsonToGraphQLQuery({ query: { ...query } }));
    };
}

export const catalogueFetcherGraphqlBuilder = {
    onItem,
    onProduct,
    onDocument,
    onFolder,
    onComponent
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
            ...(c?.onTopic ? c.onTopic : {})
        }
    };
}

function onDocument(onDocument?: any, c?: CatalogueFetcherGrapqhqlOnDocument): any {
    return {
        __typeName: 'Document',
        __typename: true,
        ...onDocument
    };
}

function onFolder(onFolder?: any, c?: CatalogueFetcherGrapqhqlOnFolder): any {
    const children = () => {
        if (c?.onChildren) {
            return {
                chidlren: {
                    ...c.onChildren
                }
            };
        }
        return {};
    };

    return {
        __typeName: 'Folder',
        __typename: true,
        ...onFolder,
        ...children()
    };
}

function onProduct(onProduct?: any, c?: CatalogueFetcherGrapqhqlOnProduct): any {
    const priceVariant = () => {
        if (c?.onPriceVariant) {
            return {
                priceVariants: {
                    ...c.onPriceVariant
                }
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
                    ...(c?.onVariant ? c.onVariant : {})
                }
            };
        }
        return {};
    };

    const defaultVariant = () => {
        if (c?.onDefaultVariant) {
            return {
                defaultVariant: {
                    ...c.onDefaultVariant
                }
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
            percent: true
        },
        ...defaultVariant(),
        ...variants()
    };
}

function onComponent(id: string, type: ComponentType, onComponent?: any, c?: CatalogueFetcherGrapqhqlOnComponent): any {
    const validType = componentType.parse(type);
    return {
        [id]: {
            __aliasFor: 'component',
            __args: {
                id
            },
            content: {
                __typename: true,
                __on: {
                    __typeName: validType,
                    ...onComponent
                }
            }
        }
    };
}
