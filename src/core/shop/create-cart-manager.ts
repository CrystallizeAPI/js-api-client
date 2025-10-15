import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from '../client/create-client.js';
import {
    CartInput,
    CartInputSchema,
    CartSkuItemInput,
    CartSkuItemInputSchema,
    CustomerInput,
    CustomerInputSchema,
    MetaInput,
} from '@crystallize/schema/shop';
import { transformCartCustomerInput, transformCartInput } from './helpers.js';

type WithId<R> = R & { id: string };

export const createCartManager = (apiClient: ClientInterface) => {
    const place = async <OnCart, OC = unknown>(id: string, onCart?: OC) => {
        const mutation = {
            place: {
                __args: {
                    id,
                },
                id: true,
                ...onCart,
            },
        };
        const response = await apiClient.shopCartApi<{ place: WithId<OnCart> }>(jsonToGraphQLQuery({ mutation }));
        return response.place;
    };

    const abandon = async <OnCart, OC = unknown>(id: string, onCart?: OC) => {
        const mutation = {
            abandon: {
                __args: {
                    id,
                },
                id: true,
                ...onCart,
            },
        };
        const response = await apiClient.shopCartApi<{ abandon: WithId<OnCart> }>(jsonToGraphQLQuery({ mutation }));
        return response.abandon;
    };

    const fulfill = async <OnCart, OC = unknown>(id: string, orderId: string, onCart?: OC) => {
        const mutation = {
            fulfill: {
                __args: {
                    id,
                    orderId,
                },
                id: true,
                ...onCart,
            },
        };
        const response = await apiClient.shopCartApi<{ fulfill: WithId<OnCart> }>(jsonToGraphQLQuery({ mutation }));
        return response.fulfill;
    };

    const addSkuItem = async <OnCart, OC = unknown>(id: string, intent: CartSkuItemInput, onCart?: OC) => {
        const input = CartSkuItemInputSchema.parse(intent);
        const mutation = {
            addSkuItem: {
                __args: {
                    id,
                    input,
                },
                id: true,
                ...onCart,
            },
        };
        const response = await apiClient.shopCartApi<{ addSkuItem: WithId<OnCart> }>(jsonToGraphQLQuery({ mutation }));
        return response.addSkuItem;
    };

    const removeItem = async <OnCart, OC = unknown>(
        id: string,
        { sku, quantity }: { sku: string; quantity: number },
        onCart?: OC,
    ) => {
        const mutation = {
            removeCartItem: {
                __args: {
                    id,
                    sku,
                    quantity,
                },
                id: true,
                ...onCart,
            },
        };
        const response = await apiClient.shopCartApi<{
            removeCartItem: WithId<OnCart>;
        }>(jsonToGraphQLQuery({ mutation }));
        return response.removeCartItem;
    };

    type MetaIntent = {
        meta: MetaInput;
        merge: boolean;
    };
    const setMeta = async <OnCart, OC = unknown>(id: string, { meta, merge }: MetaIntent, onCart?: OC) => {
        const mutation = {
            setMeta: {
                __args: {
                    id,
                    merge,
                    meta,
                },
                id: true,
                ...onCart,
            },
        };
        const response = await apiClient.shopCartApi<{
            setMeta: WithId<OnCart>;
        }>(jsonToGraphQLQuery({ mutation }));
        return response.setMeta;
    };

    const setCustomer = async <OnCart, OC = unknown>(id: string, customerIntent: CustomerInput, onCart?: OC) => {
        const input = CustomerInputSchema.parse(customerIntent);
        const mutation = {
            setCustomer: {
                __args: {
                    id,
                    input: transformCartCustomerInput(input),
                },
                id: true,
                ...onCart,
            },
        };
        const response = await apiClient.shopCartApi<{
            setCustomer: WithId<OnCart>;
        }>(jsonToGraphQLQuery({ mutation }));
        return response.setCustomer;
    };

    const hydrate = async <OnCart, OC = unknown>(intent: CartInput, onCart?: OC) => {
        const input = CartInputSchema.parse(intent);
        const mutation = {
            hydrate: {
                __args: {
                    input: transformCartInput(input),
                },
                id: true,
                ...onCart,
            },
        };
        const response = await apiClient.shopCartApi<{ hydrate: WithId<OnCart> }>(jsonToGraphQLQuery({ mutation }));
        return response.hydrate;
    };

    return {
        hydrate,
        place,
        fulfill,
        abandon,
        addSkuItem,
        removeItem,
        setMeta,
        setCustomer,
    };
};
