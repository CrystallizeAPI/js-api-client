import { jsonToGraphQLQuery } from 'json-to-graphql-query';

import { ClientInterface } from '../client/create-client.js';
import { VariablesType } from '../client/create-api-caller.js';
import { ComponentContentType } from '@crystallize/schema/catalogue';

export type CatalogueFetcherGrapqhqlOnItem<OT = unknown> = {
    onTopic?: OT;
};

export type CatalogueFetcherGrapqhqlOnProduct<ODV = unknown, OV = unknown, OPV = unknown> = {
    onDefaultVariant?: ODV;
    onVariant?: OV;
    onPriceVariant?: OPV;
};

export type CatalogueFetcherGrapqhqlOnSubscriptionPlan = {
    onPeriod: (name: string) => object;
};

export type CatalogueFetcherGrapqhqlOnFolder<OC = unknown> = {
    onChildren?: OC;
};

export const createCatalogueFetcher = (client: ClientInterface) => {
    return <T = unknown>(query: object, variables?: VariablesType): Promise<T> => {
        return client.catalogueApi<T>(jsonToGraphQLQuery({ query }), variables);
    };
};

export const catalogueFetcherGraphqlBuilder = {
    onItem,
    onProduct,
    onDocument,
    onFolder,
    onComponent,
    onSubscriptionPlan,
};

function onItem<OC = unknown>(onItem?: OC, c?: CatalogueFetcherGrapqhqlOnItem): object {
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

function onDocument<OD = unknown>(onDocument?: OD): object {
    return {
        __typeName: 'Document',
        __typename: true,
        ...onDocument,
    };
}

function onFolder<OF = unknown>(onFolder?: OF, c?: CatalogueFetcherGrapqhqlOnFolder): object {
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

function onProduct<OP = unknown>(onProduct?: OP, c?: CatalogueFetcherGrapqhqlOnProduct): object {
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

const camelCaseHyphens = (id: string): string => id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

function onComponent<OC = unknown>(id: string, type: ComponentContentType, onComponent?: OC): object {
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
                    __typeName: type,
                    ...onComponent,
                },
            },
        },
    };
}

function onSubscriptionPlan(c?: CatalogueFetcherGrapqhqlOnSubscriptionPlan): object {
    const period = (name: string) => {
        return {
            ...(c?.onPeriod ? c.onPeriod(name) : {}),
            period: true,
            unit: true,
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
