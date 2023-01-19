import { ClientInterface } from './client';
import {
    CreateOrderInputRequest,
    createOrderInputRequest,
    Order,
    OrderCreatedConfirmation,
    OrderUpdatedConfirmation,
    updateOrderInputRequest,
    UpdateOrderInputRequest,
} from '../types/order';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';

function buildQuery(onCustomer?: any, onOrderItem?: any, extraQuery?: any) {
    return {
        id: true,
        createdAt: true,
        updatedAt: true,
        customer: {
            identifier: true,
            ...(onCustomer !== undefined ? onCustomer : {}),
        },
        cart: {
            name: true,
            sku: true,
            imageUrl: true,
            quantity: true,
            ...(onOrderItem !== undefined ? onOrderItem : {}),
            price: {
                gross: true,
                net: true,
                discounts: {
                    percent: true,
                },
            },
        },
        total: {
            gross: true,
            net: true,
            currency: true,
            discounts: {
                percent: true,
            },
            tax: {
                name: true,
                percent: true,
            },
        },
        ...(extraQuery !== undefined ? extraQuery : {}),
    };
}

export function createOrderFetcher(apiClient: ClientInterface) {
    // we don't provide the current cursor for each Order.
    const fetchPaginatedOrdersByCustomerIdentifier = async (
        customerIdentifier: string,
        extraQueryArgs?: any,
        onCustomer?: any,
        onOrderItem?: any,
        extraQuery?: any,
    ): Promise<{
        pageInfo: {
            hasNextPage: boolean;
            hasPreviousPage: boolean;
            startCursor: string;
            endCursor: string;
            totalNodes: number;
        };
        orders: Order[];
    }> => {
        const orderApi = apiClient.orderApi;
        const query = {
            orders: {
                getAll: {
                    __args: {
                        customerIdentifier: customerIdentifier,
                        ...(extraQueryArgs !== undefined ? extraQueryArgs : {}),
                    },
                    pageInfo: {
                        hasPreviousPage: true,
                        hasNextPage: true,
                        startCursor: true,
                        endCursor: true,
                        totalNodes: true,
                    },
                    edges: {
                        cursor: true,
                        node: buildQuery(onCustomer, onOrderItem, extraQuery),
                    },
                },
            },
        };
        const response = await orderApi(jsonToGraphQLQuery({ query }));
        return {
            pageInfo: response.orders.getAll.pageInfo,
            orders: response.orders.getAll?.edges?.map((edge: any) => edge.node) || [],
        };
    };

    const fetchOrderById = async (
        orderId: string,
        onCustomer?: any,
        onOrderItem?: any,
        extraQuery?: any,
    ): Promise<Order> => {
        const orderApi = apiClient.orderApi;
        const query = {
            orders: {
                get: {
                    __args: {
                        id: orderId,
                    },
                    id: true,
                    createdAt: true,
                    updatedAt: true,
                    customer: {
                        identifier: true,
                        ...(onCustomer !== undefined ? onCustomer : {}),
                    },
                    cart: {
                        name: true,
                        sku: true,
                        imageUrl: true,
                        quantity: true,
                        ...(onOrderItem !== undefined ? onOrderItem : {}),
                        price: {
                            gross: true,
                            net: true,
                            discounts: {
                                percent: true,
                            },
                        },
                    },
                    total: {
                        gross: true,
                        net: true,
                        currency: true,
                        discounts: {
                            percent: true,
                        },
                        tax: {
                            name: true,
                            percent: true,
                        },
                    },
                    ...(extraQuery !== undefined ? extraQuery : {}),
                },
            },
        };
        return (await orderApi(jsonToGraphQLQuery({ query })))?.orders?.get;
    };

    return {
        byId: fetchOrderById,
        byCustomerIdentifier: fetchPaginatedOrdersByCustomerIdentifier,
    };
}

function convertDates(intent: CreateOrderInputRequest | UpdateOrderInputRequest) {
    if (!intent.cart) {
        return {
            ...intent,
        };
    }
    return {
        ...intent,
        cart: intent.cart.map((item) => {
            if (!item.subscription) {
                return {
                    ...item,
                };
            }
            return {
                ...item,
                subscription: {
                    ...item.subscription,
                    start: item.subscription.start?.toISOString(),
                    end: item.subscription.end?.toISOString(),
                },
            };
        }),
    };
}

export function createOrderPusher(apiClient: ClientInterface) {
    return async function pushOrder(intentOrder: CreateOrderInputRequest): Promise<OrderCreatedConfirmation> {
        const intent = createOrderInputRequest.parse(intentOrder);
        const orderApi = apiClient.orderApi;

        const mutation = {
            mutation: {
                orders: {
                    create: {
                        __args: {
                            input: {
                                ...convertDates(intent),
                                createdAt: intent.createdAt?.toISOString() ?? new Date().toISOString(),
                            },
                        },
                        id: true,
                        createdAt: true,
                    },
                },
            },
        };
        const confirmation = await orderApi(jsonToGraphQLQuery(mutation));
        return {
            id: confirmation.orders.create.id,
            createdAt: confirmation.orders.create.createdAt,
        };
    };
}

export function createOrderPaymentUpdater(apiClient: ClientInterface) {
    return async function updaptePaymentOrder(
        orderId: string,
        intentOrder: UpdateOrderInputRequest,
    ): Promise<OrderUpdatedConfirmation> {
        const intent = updateOrderInputRequest.parse(intentOrder);
        const pimApi = apiClient.pimApi;
        const mutation = {
            mutation: {
                order: {
                    update: {
                        __args: {
                            id: orderId,
                            input: convertDates(intent),
                        },
                        id: true,
                        updatedAt: true,
                    },
                },
            },
        };
        const confirmation = await pimApi(jsonToGraphQLQuery(mutation));
        return {
            id: confirmation.order.update.id,
            updatedAt: confirmation.order.update.updatedAt,
        };
    };
}
