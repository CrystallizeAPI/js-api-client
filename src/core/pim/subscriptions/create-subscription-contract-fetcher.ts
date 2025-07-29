import { SubscriptionContract } from '@crystallize/schema/pim';
import { ClientInterface } from '../../client/create-client.js';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';

type DefaultSubscriptionContractType<OnSubscriptionContract, OnCustomer> = Required<
    Pick<
        SubscriptionContract,
        | 'id'
        | 'subscriptionPlan'
        | 'item'
        | 'initial'
        | 'recurring'
        | 'status'
        | 'meta'
        | 'addresses'
        | 'customerIdentifier'
    >
> & {
    customer: Required<Pick<NonNullable<SubscriptionContract['customer']>, 'identifier'>> & OnCustomer;
} & OnSubscriptionContract;

const buildBaseQuery = <OC, OSC>(onSubscriptionContract?: OSC, onCustomer?: OC) => {
    const phaseQuery = {
        period: true,
        unit: true,
        price: true,
        currency: true,
        meteredVariables: {
            id: true,
            name: true,
            identifier: true,
            unit: true,
            tierType: true,
            tiers: {
                currency: true,
                threshold: true,
                price: true,
            },
        },
        productVariants: {
            sku: true,
            quantity: true,
            name: true,
            imageUrl: true,
            meta: {
                key: true,
                value: true,
            },
        },
    };
    return {
        id: true,
        subscriptionPlan: {
            identifier: true,
            periodId: true,
        },
        item: {
            name: true,
            sku: true,
            imageUrl: true,
            quantity: true,
            meta: {
                key: true,
                value: true,
            },
        },
        initial: phaseQuery,
        recurring: phaseQuery,
        status: {
            activateAt: true,
            activeUntil: true,
            renewAt: true,
            state: true,
            phase: phaseQuery,
        },
        meta: {
            key: true,
            value: true,
        },
        addresses: {
            type: true,
            lastName: true,
            firstName: true,
            email: true,
            middleName: true,
            street: true,
            street2: true,
            city: true,
            country: true,
            state: true,
            postalCode: true,
            phone: true,
            streetNumber: true,
        },
        customerIdentifier: true,
        customer: {
            identifier: true,
            ...onCustomer,
        },
        ...onSubscriptionContract,
    };
};

type PageInfo = {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
};

type EnhanceQuery<OSC = unknown, OC = unknown> = {
    onSubscriptionContract?: OSC;
    onCustomer?: OC;
};

export const createSubscriptionContractFetcher = (apiClient: ClientInterface) => {
    const fetchById = async <OnSubscriptionContract = unknown, OnCustomer = unknown, OSC = unknown, OC = unknown>(
        id: string,
        enhancements?: EnhanceQuery<OSC, OC>,
    ): Promise<DefaultSubscriptionContractType<OnSubscriptionContract, OnCustomer> | null> => {
        const query = {
            subscriptionContract: {
                __args: {
                    id,
                },
                __on: [
                    {
                        __typeName: 'SubscriptionContractAggregate',
                        ...buildBaseQuery(enhancements?.onSubscriptionContract, enhancements?.onCustomer),
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
            await apiClient.nextPimApi<{
                subscriptionContract: DefaultSubscriptionContractType<OnSubscriptionContract, OnCustomer>;
            }>(jsonToGraphQLQuery({ query }))
        ).subscriptionContract;
    };

    const fetchPaginatedByCustomerIdentifier = async <
        OnSubscriptionContract = unknown,
        OnCustomer = unknown,
        EA extends Record<string, unknown> = Record<string, unknown>,
        OSC = unknown,
        OC = unknown,
    >(
        customerIdentifier: string,
        extraArgs?: EA & { filter?: Record<string, unknown> },
        enhancements?: EnhanceQuery<OSC, OC>,
    ): Promise<{
        pageInfo: PageInfo;
        subscriptionContracts: Array<DefaultSubscriptionContractType<OnSubscriptionContract, OnCustomer>>;
    }> => {
        const { filter, ...extraArgsRest } = extraArgs || {};
        const query = {
            subscriptionContracts: {
                __args: {
                    filter: {
                        ...filter,
                        customerIdentifier,
                    },
                    ...extraArgsRest,
                },
                __on: [
                    {
                        __typeName: 'SubscriptionContractConnection',
                        pageInfo: {
                            hasPreviousPage: true,
                            hasNextPage: true,
                            startCursor: true,
                            endCursor: true,
                        },
                        edges: {
                            node: buildBaseQuery(enhancements?.onSubscriptionContract, enhancements?.onCustomer),
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
            subscriptionContracts: {
                pageInfo: PageInfo;
                edges?: Array<{
                    node: DefaultSubscriptionContractType<OnSubscriptionContract, OnCustomer>;
                }>;
            };
        }>(jsonToGraphQLQuery({ query }));
        return {
            pageInfo: response.subscriptionContracts.pageInfo,
            subscriptionContracts: response.subscriptionContracts?.edges?.map((edge) => edge.node) || [],
        };
    };

    return {
        byId: fetchById,
        byCustomerIdentifier: fetchPaginatedByCustomerIdentifier,
    };
};
