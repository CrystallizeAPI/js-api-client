import { ClientInterface } from './client';
import {
    CreateOrderInputRequest,
    createOrderInputRequest,
    OrderConfirmation
} from './order.types';
import { jsonToGraphQLQuery, VariableType } from 'json-to-graphql-query';

export function createOrderPusher(apiClient: ClientInterface) {
    return async function pushOrder(
        intentOrder: CreateOrderInputRequest
    ): Promise<OrderConfirmation> {
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
        const orderConfirmation = await orderApi(jsonToGraphQLQuery(mutation));
        return {
            id: orderConfirmation.orders.create.id,
            createdAt: orderConfirmation.orders.create.createdAt
        };
    };
}
