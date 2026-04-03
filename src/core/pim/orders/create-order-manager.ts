import {
    Order,
    RegisterOrderInput,
    RegisterOrderInputSchema,
    UpdateOrderInput,
    UpdateOrderInputSchema,
} from '@crystallize/schema/pim';
import { ClientInterface } from '../../client/create-client.js';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { transformOrderInput } from './helpers.js';

const baseQuery = <CustomerExtra, OrderExtra>(enhancements?: { onCustomer?: CustomerExtra; onOrder?: OrderExtra }) => ({
    __on: [
        {
            __typeName: 'Order',
            id: true,
            customer: {
                identifier: true,
                ...enhancements?.onCustomer,
            },
            ...enhancements?.onOrder,
        },
        {
            __typeName: 'BasicError',
            errorName: true,
            message: true,
        },
    ],
});

/**
 * Creates an order manager for registering, updating, and managing orders via the Crystallize PIM API.
 * Requires PIM API credentials (accessTokenId/accessTokenSecret) in the client configuration.
 *
 * @param apiClient - A Crystallize client instance created via `createClient` with PIM credentials.
 * @returns An object with methods to `register`, `update`, `setPayments`, `putInPipelineStage`, and `removeFromPipeline`.
 *
 * @example
 * ```ts
 * const orderManager = createOrderManager(client);
 * const { id, createdAt } = await orderManager.register({
 *   customer: { identifier: 'customer@example.com' },
 *   cart: [{ sku: 'SKU-001', name: 'My Product', quantity: 1 }],
 *   total: { gross: 100, net: 80, currency: 'USD' },
 * });
 * ```
 */
export const createOrderManager = (apiClient: ClientInterface) => {
    const register = async (intentOrder: RegisterOrderInput) => {
        const intent = RegisterOrderInputSchema.parse(intentOrder);
        const mutation = {
            registerOrder: {
                __args: {
                    input: transformOrderInput(intent),
                },
                __on: [
                    {
                        __typeName: 'OrderConfirmation',
                        id: true,
                        createdAt: true,
                    },
                    {
                        __typeName: 'BasicError',
                        errorName: true,
                        message: true,
                    },
                ],
            },
        };
        const confirmation = await apiClient.nextPimApi<{
            registerOrder: {
                id: string;
                createdAt: string;
            };
        }>(jsonToGraphQLQuery({ mutation }));
        return {
            id: confirmation.registerOrder.id,
            createdAt: confirmation.registerOrder.createdAt,
        };
    };

    // ---
    const update = async <OnOrder = unknown, OrderExtra = unknown>(
        intentOrder: UpdateOrderInput,
        onOrder?: OrderExtra,
    ): Promise<Required<Pick<Order, 'id' | 'reference'>> & OnOrder> => {
        const { id, ...input } = UpdateOrderInputSchema.parse(intentOrder);
        const mutation = {
            updateOrder: {
                __args: {
                    id,
                    input: transformOrderInput(input),
                },
                __on: [
                    {
                        __typeName: 'Order',
                        id: true,
                        reference: true,
                        ...onOrder,
                    },
                    {
                        __typeName: 'BasicError',
                        errorName: true,
                        message: true,
                    },
                ],
            },
        };
        const response = await apiClient.nextPimApi<{
            updateOrder: Required<Pick<Order, 'id' | 'reference'>> & OnOrder;
        }>(jsonToGraphQLQuery({ mutation }));
        return response.updateOrder;
    };

    // ---
    type PutInPipelineStageArgs = {
        id: string;
        pipelineId: string;
        stageId: string;
    };
    type PutInPipelineStageEnhancedQuery<CustomerExtra, OrderExtra> = {
        onCustomer?: CustomerExtra;
        onOrder?: OrderExtra;
    };
    type PutInPipelineStageDefaultOrderType<OnOrder, OnCustomer> = Required<Pick<Order, 'id' | 'reference'>> & {
        customer: Required<Pick<NonNullable<Order['customer']>, 'identifier'>> & OnCustomer;
    } & OnOrder;
    const putInPipelineStage = async <
        OnOrder = unknown,
        OnCustomer = unknown,
        CustomerExtra = unknown,
        OrderExtra = unknown,
    >(
        { id, pipelineId, stageId }: PutInPipelineStageArgs,
        enhancements?: PutInPipelineStageEnhancedQuery<CustomerExtra, OrderExtra>,
    ): Promise<PutInPipelineStageDefaultOrderType<OnOrder, OnCustomer>> => {
        const mutation = {
            updateOrderPipelineStage: {
                __args: {
                    orderId: id,
                    pipelineId: pipelineId,
                    stageId: stageId,
                },
                ...baseQuery(enhancements),
            },
        };
        const response = await apiClient.nextPimApi<{
            updateOrderPipelineStage: PutInPipelineStageDefaultOrderType<OnOrder, OnCustomer>;
        }>(jsonToGraphQLQuery({ mutation }));
        return response.updateOrderPipelineStage;
    };

    // ---
    type RemoveFromPipelineArgs = {
        id: string;
        pipelineId: string;
    };
    type RemoveFromPipelineEnhancedQuery<CustomerExtra, OrderExtra> = {
        onCustomer?: CustomerExtra;
        onOrder?: OrderExtra;
    };
    type RemoveFromPipelineDefaultOrderType<OnOrder, OnCustomer> = Required<Pick<Order, 'id' | 'reference'>> & {
        customer: Required<Pick<NonNullable<Order['customer']>, 'identifier'>> & OnCustomer;
    } & OnOrder;
    const removeFromPipeline = async <
        OnOrder = unknown,
        OnCustomer = unknown,
        CustomerExtra = unknown,
        OrderExtra = unknown,
    >(
        { id, pipelineId }: RemoveFromPipelineArgs,
        enhancements?: RemoveFromPipelineEnhancedQuery<CustomerExtra, OrderExtra>,
    ): Promise<RemoveFromPipelineDefaultOrderType<OnOrder, OnCustomer>> => {
        const mutation = {
            deleteOrderPipeline: {
                __args: {
                    orderId: id,
                    pipelineId: pipelineId,
                },
                ...baseQuery(enhancements),
            },
        };
        const response = await apiClient.nextPimApi<{
            deleteOrderPipeline: RemoveFromPipelineDefaultOrderType<OnOrder, OnCustomer>;
        }>(jsonToGraphQLQuery({ mutation }));
        return response.deleteOrderPipeline;
    };

    // ---
    type SetPaymentsEnhancedQuery<CustomerExtra, PaymentExtra, OrderExtra> = {
        onCustomer?: CustomerExtra;
        onPayment?: PaymentExtra;
        onOrder?: OrderExtra;
    };
    type SetPaymentsDefaultOrderType<OnPayment, OnOrder, OnCustomer> = Required<Pick<Order, 'id' | 'reference'>> & {
        customer: Required<Pick<NonNullable<Order['customer']>, 'identifier'>> & OnCustomer;
        payment: Array<Pick<NonNullable<Order['payment']>[number], 'provider'> & OnPayment>;
    } & OnOrder;
    const setPayments = async <
        OnCustomer = unknown,
        OnPayment = unknown,
        OnOrder = unknown,
        CustomerExtra = unknown,
        PaymentExtra = unknown,
        OrderExtra = unknown,
    >(
        id: string,
        payments: UpdateOrderInput['payment'],
        enhancements?: SetPaymentsEnhancedQuery<CustomerExtra, PaymentExtra, OrderExtra>,
    ): Promise<SetPaymentsDefaultOrderType<OnPayment, OnOrder, OnCustomer>> => {
        const paymentSchema = UpdateOrderInputSchema.shape.payment;
        const input = paymentSchema.parse(payments);
        const mutation = {
            updateOrder: {
                __args: {
                    id,
                    input: transformOrderInput({
                        payment: input,
                    }),
                },
                __on: [
                    {
                        __typeName: 'Order',
                        id: true,
                        customer: {
                            identifier: true,
                            ...enhancements?.onCustomer,
                        },
                        payment: {
                            provider: true,
                            ...enhancements?.onPayment,
                        },
                        ...enhancements?.onOrder,
                    },
                    {
                        __typeName: 'BasicError',
                        errorName: true,
                        message: true,
                    },
                ],
            },
        };
        const response = await apiClient.nextPimApi<{
            updateOrder: SetPaymentsDefaultOrderType<OnPayment, OnOrder, OnCustomer>;
        }>(jsonToGraphQLQuery({ mutation }));
        return response.updateOrder;
    };

    // ---
    return {
        register,
        update,
        setPayments,
        removeFromPipeline,
        putInPipelineStage,
    };
};
