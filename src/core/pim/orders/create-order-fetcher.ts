import { Order } from '@crystallize/schema/pim';
import { ClientInterface } from '../../client/create-client.js';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';

type OrderCart = NonNullable<Order['cart']>[number];

export type DefaultOrderType<OnOrder = unknown, OnOrderItem = unknown, OnCustomer = unknown> = Required<
    Pick<Order, 'id' | 'reference' | 'createdAt' | 'updatedAt'>
> & {
    customer: Required<Pick<NonNullable<Order['customer']>, 'identifier'>> & OnCustomer;
    cart: Array<
        {
            name: OrderCart['name'];
            sku: OrderCart['sku'];
            imageUrl: OrderCart['imageUrl'];
            quantity: NonNullable<OrderCart['quantity']>;
            price: NonNullable<OrderCart['price']>;
        } & OnOrderItem
    >;
    total: NonNullable<Order['total']>;
} & OnOrder;

const buildBaseQuery = <OrderExtra, OrderItemExtra, CustomerExtra>(
    onOrder?: OrderExtra,
    onOrderItem?: OrderItemExtra,
    onCustomer?: CustomerExtra,
) => {
    const priceQuery = {
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
    };
    return {
        id: true,
        reference: true,
        createdAt: true,
        updatedAt: true,
        customer: {
            identifier: true,
            ...onCustomer,
        },
        cart: {
            name: true,
            sku: true,
            imageUrl: true,
            quantity: true,
            price: priceQuery,
            ...onOrderItem,
        },
        total: priceQuery,
        ...onOrder,
    };
};

type PageInfo = {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
};

type EnhanceQuery<OrderExtra = unknown, OrderItemExtra = unknown, CustomerExtra = unknown> = {
    onOrder?: OrderExtra;
    onOrderItem?: OrderItemExtra;
    onCustomer?: CustomerExtra;
};

/**
 * Creates an order fetcher for retrieving orders from the Crystallize PIM API.
 * Requires PIM API credentials (accessTokenId/accessTokenSecret) in the client configuration.
 *
 * @param apiClient - A Crystallize client instance created via `createClient` with PIM credentials.
 * @returns An object with `byId` and `byCustomerIdentifier` methods for fetching orders.
 *
 * @example
 * ```ts
 * const orderFetcher = createOrderFetcher(client);
 * const order = await orderFetcher.byId('order-id-123');
 * const { orders, pageInfo } = await orderFetcher.byCustomerIdentifier('customer@example.com');
 * ```
 */
export function createOrderFetcher(apiClient: ClientInterface) {
    const fetchPaginatedByCustomerIdentifier = async <
        OnOrder = unknown,
        OnOrderItem = unknown,
        OnCustomer = unknown,
        EA extends Record<string, unknown> = Record<string, unknown>,
        CustomerExtra = unknown,
        OrderItemExtra = unknown,
        OrderExtra = unknown,
    >(
        customerIdentifier: string,
        extraArgs?: EA & { filter?: Record<string, unknown> & { customer?: Record<string, unknown> } },
        enhancements?: EnhanceQuery<OrderExtra, OrderItemExtra, CustomerExtra>,
    ): Promise<{
        pageInfo: PageInfo;
        orders: Array<DefaultOrderType<OnOrder, OnOrderItem, OnCustomer>>;
    }> => {
        const { filter, ...extraArgsRest } = extraArgs || {};
        const { customer, ...extra } = filter || {};
        const query = {
            orders: {
                __args: {
                    filter: {
                        customer: {
                            identifier: customerIdentifier,
                            ...customer,
                        },
                        ...extra,
                    },
                    ...extraArgsRest,
                },
                __on: [
                    {
                        __typeName: 'OrderConnection',
                        pageInfo: {
                            hasPreviousPage: true,
                            hasNextPage: true,
                            startCursor: true,
                            endCursor: true,
                        },
                        edges: {
                            node: buildBaseQuery(
                                enhancements?.onOrder,
                                enhancements?.onOrderItem,
                                enhancements?.onCustomer,
                            ),
                        },
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
            orders: {
                pageInfo: PageInfo;
                edges?: Array<{
                    node: DefaultOrderType<OnOrder, OnOrderItem, OnCustomer>;
                }>;
            };
        }>(jsonToGraphQLQuery({ query }));
        return {
            pageInfo: response.orders.pageInfo,
            orders: response.orders?.edges?.map((edge) => edge.node) || [],
        };
    };

    const fetchById = async <
        OnOrder = unknown,
        OnOrderItem = unknown,
        OnCustomer = unknown,
        CustomerExtra = unknown,
        OrderItemExtra = unknown,
        OrderExtra = unknown,
    >(
        id: string,
        enhancements?: EnhanceQuery<OrderExtra, OrderItemExtra, CustomerExtra>,
    ): Promise<DefaultOrderType<OnOrder, OnOrderItem, OnCustomer> | null> => {
        const query = {
            order: {
                __args: {
                    id,
                },
                __on: [
                    {
                        __typeName: 'Order',
                        ...buildBaseQuery(enhancements?.onOrder, enhancements?.onOrderItem, enhancements?.onCustomer),
                    },
                    {
                        __typeName: 'BasicError',
                        errorName: true,
                        message: true,
                    },
                ],
            },
        };
        return (
            await apiClient.nextPimApi<{ order: DefaultOrderType<OnOrder, OnOrderItem, OnCustomer> }>(
                jsonToGraphQLQuery({ query }),
            )
        ).order;
    };

    return {
        byId: fetchById,
        byCustomerIdentifier: fetchPaginatedByCustomerIdentifier,
    };
}
