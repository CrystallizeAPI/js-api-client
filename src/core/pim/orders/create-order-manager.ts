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

const baseQuery = <OC, OO>(enhancements?: { onCustomer?: OC; onOrder?: OO }) => ({
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
    const update = async <OnOrder = unknown, OO = unknown>(
        intentOrder: UpdateOrderInput,
        onOrder?: OO,
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
    type PutInPipelineStageEnhancedQuery<OC, OO> = {
        onCustomer?: OC;
        onOrder?: OO;
    };
    type PutInPipelineStageDefaultOrderType<OnOrder, OnCustomer> = Required<Pick<Order, 'id' | 'reference'>> & {
        customer: Required<Pick<NonNullable<Order['customer']>, 'identifier'>> & OnCustomer;
    } & OnOrder;
    const putInPipelineStage = async <OnOrder = unknown, OnCustomer = unknown, OC = unknown, OO = unknown>(
        { id, pipelineId, stageId }: PutInPipelineStageArgs,
        enhancements?: PutInPipelineStageEnhancedQuery<OC, OO>,
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
    type RemoveFromPipelineEnhancedQuery<OC, OO> = {
        onCustomer?: OC;
        onOrder?: OO;
    };
    type RemoveFromPipelineDefaultOrderType<OnOrder, OnCustomer> = Required<Pick<Order, 'id' | 'reference'>> & {
        customer: Required<Pick<NonNullable<Order['customer']>, 'identifier'>> & OnCustomer;
    } & OnOrder;
    const removeFromPipeline = async <OnOrder = unknown, OnCustomer = unknown, OC = unknown, OO = unknown>(
        { id, pipelineId }: RemoveFromPipelineArgs,
        enhancements?: RemoveFromPipelineEnhancedQuery<OC, OO>,
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
    type SetPaymentsEnhancedQuery<OC, OP, OO> = {
        onCustomer?: OC;
        onPayment?: OP;
        onOrder?: OO;
    };
    type SetPaymentsDefaultOrderType<OnPayment, OnOrder, OnCustomer> = Required<Pick<Order, 'id' | 'reference'>> & {
        customer: Required<Pick<NonNullable<Order['customer']>, 'identifier'>> & OnCustomer;
        payment: Array<Pick<NonNullable<Order['payment']>[number], 'provider'> & OnPayment>;
    } & OnOrder;
    const setPayments = async <
        OnCustomer = unknown,
        OnPayment = unknown,
        OnOrder = unknown,
        OC = unknown,
        OP = unknown,
        OO = unknown,
    >(
        id: string,
        payments: UpdateOrderInput['payment'],
        enhancements?: SetPaymentsEnhancedQuery<OC, OP, OO>,
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
