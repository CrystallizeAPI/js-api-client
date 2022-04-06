import { ClientInterface } from './client';
import {
    CreateOrderInputRequest,
    createOrderInputRequest,
    OrderCreatedConfirmation,
    OrderUpdatedConfirmation,
    updateOrderInputRequest,
    UpdateOrderInputRequest
} from '../types/order.types';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';

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
                                ...intent
                            }
                        },
                        id: true,
                        createdAt: true
                    }
                }
            }
        };
        const confirmation = await orderApi(jsonToGraphQLQuery(mutation));
        return {
            id: confirmation.orders.create.id,
            createdAt: confirmation.orders.create.createdAt
        };
    };
}

export function createOrderPaymentUpdater(apiClient: ClientInterface) {
    return async function updaptePaymentOrder(
        orderId: string,
        intentOrder: UpdateOrderInputRequest
    ): Promise<OrderUpdatedConfirmation> {
        const intent = updateOrderInputRequest.parse(intentOrder);
        const pimApi = apiClient.pimApi;
        const mutation = {
            mutation: {
                order: {
                    update: {
                        __args: {
                            id: orderId,
                            input: {
                                ...intent
                            }
                        },
                        id: true,
                        updatedAt: true
                    }
                }
            }
        };
        const confirmation = await pimApi(jsonToGraphQLQuery(mutation));
        return {
            id: confirmation.order.update.id,
            updatedAt: confirmation.order.update.updatedAt
        };
    };
}
