import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from './client';
import { Customer } from '../types/customer';

type Deps = {
    apiClient: ClientInterface;
};

export const placeCart = async (cartId: string, { apiClient }: Deps, extraQuery?: any): Promise<void> => {
    try {
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
    } catch (exception: any) {
        console.error(`Failed to place cart ${cartId}`, exception.message);
    }
};

export const addSkuItem = async (
    cartId: string,
    sku: string,
    quantity: number,
    { apiClient }: Deps,
    extraQuery?: any,
) => {
    try {
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
    } catch (exception: any) {
        console.error(`Failed to add sku item for cart ${cartId}`, exception.message);
    }
};

export const removeCartItem = async (
    cartId: string,
    sku: string,
    quantity: number,
    { apiClient }: Deps,
    extraQuery?: any,
) => {
    try {
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
    } catch (exception: any) {
        console.error(`Failed to remove from cart ${cartId}`, exception.message);
    }
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
): Promise<void> => {
    try {
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
    } catch (exception: any) {
        console.error(`Failed to set meta for ${cartId}`, exception.message);
    }
};

export const setCartCustomer = async (
    cartId: string,
    customer: Customer,
    isGuest: boolean,
    { apiClient }: Deps,
    extraQuery?: any,
): Promise<void> => {
    try {
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
    } catch (exception: any) {
        console.error('Failed to update customer', exception.message);
    }
};
