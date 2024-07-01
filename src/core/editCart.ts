import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from './client.js';
import { Customer } from '../types/customer.js';

type Deps = {
    apiClient: ClientInterface;
};

export const placeCart = async (cartId: string, { apiClient }: Deps, extraQuery?: any) => {
    const mutation = {
        place: {
            __args: {
                id: cartId,
            },
            id: true,
            ...extraQuery,
        },
    };
    const response = await apiClient.shopCartApi(jsonToGraphQLQuery({ mutation }));
    return response.place;
};

export const addSkuItem = async (
    cartId: string,
    sku: string,
    quantity: number,
    { apiClient }: Deps,
    extraQuery?: any,
) => {
    const mutation = {
        addSkuItem: {
            __args: {
                id: cartId,
                input: {
                    sku,
                    quantity,
                },
            },
            id: true,
            ...extraQuery,
        },
    };
    const response = await apiClient.shopCartApi(jsonToGraphQLQuery({ mutation }));
    return response.addSkuItem;
};

export const removeCartItem = async (
    cartId: string,
    sku: string,
    quantity: number,
    { apiClient }: Deps,
    extraQuery?: any,
) => {
    const mutation = {
        removeCartItem: {
            __args: {
                id: cartId,
                sku,
                quantity,
            },
            id: true,
            ...extraQuery,
        },
    };
    const response = await apiClient.shopCartApi(jsonToGraphQLQuery({ mutation }));
    return response.removeCartItem;
};

export const setCartMeta = async (
    cartId: string,
    meta: Array<{
        key: string;
        value: string;
    }>,
    merge: Boolean,
    { apiClient }: Deps,
    extraQuery?: any,
) => {
    const mutation = {
        setMeta: {
            __args: {
                id: cartId,
                merge,
                meta,
            },
            id: true,
            ...extraQuery,
        },
    };
    const response = await apiClient.shopCartApi(jsonToGraphQLQuery({ mutation }));
    return response.setMeta;
};

export const setCartCustomer = async (
    cartId: string,
    customer: Customer,
    isGuest: boolean,
    { apiClient }: Deps,
    extraQuery?: any,
) => {
    const mutation = {
        setCustomer: {
            __args: {
                id: cartId,
                input: {
                    isGuest,
                    ...customer,
                },
            },
            id: true,
            ...extraQuery,
        },
    };
    const response = await apiClient.shopCartApi(jsonToGraphQLQuery({ mutation }));
    return response.setCustomer;
};
