import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from '../../client/create-client.js';
import { Customer } from '@crystallize/schema/pim';

export type DefaultCustomerType<R> = R & Required<Pick<Customer, 'identifier' | 'email' | 'firstName' | 'lastName'>>;

const buildBaseQuery = <CustomerExtra>(onCustomer?: CustomerExtra) => {
    return {
        identifier: true,
        email: true,
        firstName: true,
        lastName: true,
        ...onCustomer,
    };
};

export const createCustomerFetcher = (apiClient: ClientInterface) => {
    const fetchByIdentifier = async <OnCustomer = unknown, CustomerExtra = unknown>(
        identifier: string,
        onCustomer?: CustomerExtra,
    ): Promise<DefaultCustomerType<OnCustomer> | null> => {
        const query = {
            customer: {
                __args: {
                    identifier,
                },
                __on: [
                    {
                        __typeName: 'Customer',
                        ...buildBaseQuery(onCustomer),
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
            await apiClient.nextPimApi<{ customer: DefaultCustomerType<OnCustomer> }>(jsonToGraphQLQuery({ query }))
        ).customer;
    };

    const fetchByExternalReference = async <OnCustomer = unknown, CustomerExtra = unknown>(
        { key, value }: { key: string; value?: string },
        onCustomer?: CustomerExtra,
    ): Promise<DefaultCustomerType<OnCustomer> | null> => {
        const query = {
            customer: {
                __args: {
                    externalReference: {
                        key,
                        ...(value ? { value } : {}),
                    },
                },
                __on: [
                    {
                        __typeName: 'Customer',
                        ...buildBaseQuery(onCustomer),
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
            await apiClient.nextPimApi<{ customer: DefaultCustomerType<OnCustomer> }>(jsonToGraphQLQuery({ query }))
        ).customer;
    };

    return {
        byIdentifier: fetchByIdentifier,
        byExternalReference: fetchByExternalReference,
    };
};
