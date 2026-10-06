import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from '../client/create-client.js';
import {
    CustomerInput,
    CustomerInputSchema,
    MetaInput,
    MetaInputSchema,
    OrderFromCartInput,
    OrderFromCartInputSchema,
    OrderPaymentInput,
    OrderPaymentInputSchema,
} from '@crystallize/schema/shop';
import { transformCartCustomerInput, transformOrderFromCartInput } from './helpers.js';

type WithId<R> = R & { id: string };

export type ShopOrderListOptions = {
    limit?: number;
    skip?: number;
};

export type ShopOrderMetaIntent = {
    meta: MetaInput;
    merge?: boolean;
};

/**
 * Creates an order manager for the Crystallize Shop API `/order` endpoint (checkout side: create orders from carts,
 * record payments, move orders through pipelines). For Core API orders, use `createOrderManager`.
 * The Shop API token is fetched (with the `order` scope) for you, see `createClient`.
 *
 * Every method returns the order `id` plus the fields selected with `onOrder`; type them with the generic,
 * e.g. `fetch<Order>(id, { payments: { provider: true, meta: true } })` with `Order` from `@crystallize/schema/shop`.
 * Note that `payments[].meta` is read back as a JSON object, not as the `[{ key, value }]` list you write, and that
 * `createFromCart`, `addPayments` and `setPayments` persist just after responding, so an immediate read can lag.
 *
 * @param apiClient - A Crystallize client instance created via `createClient`.
 * @returns An object with methods to `fetch`, `listByCustomer`, `createFromCart`, `addPayments`, `setPayments`, `setMeta`, `setCustomer`, `addToStage`, and `removeFromPipeline`.
 *
 * @example
 * ```ts
 * const orderManager = createShopOrderManager(client);
 * const order = await orderManager.createFromCart(cartId, {
 *   paymentStatus: 'paid',
 *   payments: [{ provider: 'stripe', transactionId: 'pi_123', amount: 100, method: 'card' }],
 * });
 * await orderManager.addToStage(order.id, 'fulfilment', 'new');
 * ```
 */
export const createShopOrderManager = (apiClient: ClientInterface) => {
    const orderOperation = async <R>(
        operation: 'query' | 'mutation',
        name: string,
        args: Record<string, unknown>,
        onOrder?: Record<string, unknown>,
    ) => {
        const graphQLQuery = { [operation]: { [name]: { __args: args, id: true, ...onOrder } } };
        const response = await apiClient.shopOrderApi<Record<string, R>>(jsonToGraphQLQuery(graphQLQuery));
        return response[name];
    };

    return {
        /** Rejects with a `JSApiClientCallError` when the order does not exist. */
        fetch: <OnOrder = unknown>(id: string, onOrder?: Record<string, unknown>) =>
            orderOperation<WithId<OnOrder>>('query', 'order', { id }, onOrder),
        listByCustomer: async <OnOrder = unknown>(
            customerIdentifier: string,
            { limit, skip }: ShopOrderListOptions = {},
            onOrder?: Record<string, unknown>,
        ) => {
            const orders = await orderOperation<WithId<OnOrder>[] | null>(
                'query',
                'orders',
                {
                    customerIdentifier,
                    ...(limit !== undefined && { limit }),
                    ...(skip !== undefined && { skip }),
                },
                onOrder,
            );
            return orders ?? [];
        },
        createFromCart: async <OnOrder = unknown>(
            cartId: string,
            intent?: OrderFromCartInput,
            onOrder?: Record<string, unknown>,
        ) => {
            const input = intent && OrderFromCartInputSchema.parse(intent);
            return orderOperation<WithId<OnOrder>>(
                'mutation',
                'createFromCart',
                { id: cartId, ...(input && { input: transformOrderFromCartInput(input) }) },
                onOrder,
            );
        },
        addPayments: async <OnOrder = unknown>(
            id: string,
            intents: OrderPaymentInput[],
            onOrder?: Record<string, unknown>,
        ) => {
            const payments = OrderPaymentInputSchema.array().parse(intents);
            return orderOperation<WithId<OnOrder>>('mutation', 'addPayments', { id, payments }, onOrder);
        },
        setPayments: async <OnOrder = unknown>(
            id: string,
            intents: OrderPaymentInput[],
            onOrder?: Record<string, unknown>,
        ) => {
            const payments = OrderPaymentInputSchema.array().parse(intents);
            return orderOperation<WithId<OnOrder>>('mutation', 'setPayments', { id, payments }, onOrder);
        },
        setMeta: async <OnOrder = unknown>(
            id: string,
            { meta, merge = true }: ShopOrderMetaIntent,
            onOrder?: Record<string, unknown>,
        ) =>
            orderOperation<WithId<OnOrder>>(
                'mutation',
                'setMeta',
                { id, meta: MetaInputSchema.parse(meta), merge },
                onOrder,
            ),
        setCustomer: async <OnOrder = unknown>(
            id: string,
            customerIntent: CustomerInput,
            onOrder?: Record<string, unknown>,
        ) => {
            const customer = CustomerInputSchema.parse(customerIntent);
            return orderOperation<WithId<OnOrder>>(
                'mutation',
                'setCustomer',
                { id, customer: transformCartCustomerInput(customer) },
                onOrder,
            );
        },
        addToStage: <OnOrder = unknown>(
            id: string,
            pipeline: string,
            stage: string,
            onOrder?: Record<string, unknown>,
        ) => orderOperation<WithId<OnOrder>>('mutation', 'addToStage', { id, pipeline, stage }, onOrder),
        removeFromPipeline: <OnOrder = unknown>(id: string, pipeline: string, onOrder?: Record<string, unknown>) =>
            orderOperation<WithId<OnOrder>>('mutation', 'removeFromPipeline', { id, pipeline }, onOrder),
    };
};
