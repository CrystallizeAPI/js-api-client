import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import {
    createCustomerInputRequest,
    CreateCustomerInputRequest,
    updateCustomerInputRequest,
    UpdateCustomerInputRequest,
} from '../types/customer';
import { ClientInterface } from './client';

export function createCustomerManager(apiClient: ClientInterface) {
    const create = async (intentCustomer: CreateCustomerInputRequest, extraResultQuery?: any): Promise<any> => {
        const intent = createCustomerInputRequest.parse(intentCustomer);
        const api = apiClient.pimApi;

        const mutation = {
            mutation: {
                customer: {
                    create: {
                        __args: {
                            input: {
                                ...intent,
                                tenantId: apiClient.config.tenantId || intent.tenantId || '',
                            },
                        },
                        identifier: true,
                        ...(extraResultQuery !== undefined ? extraResultQuery : {}),
                    },
                },
            },
        };
        const confirmation = await api(jsonToGraphQLQuery(mutation));
        return confirmation.customer.create;
    };

    const update = async (
        identifier: string,
        intentCustomer: UpdateCustomerInputRequest,
        extraResultQuery?: any,
    ): Promise<any> => {
        const intent = updateCustomerInputRequest.parse(intentCustomer);
        const api = apiClient.pimApi;

        const mutation = {
            mutation: {
                customer: {
                    update: {
                        __args: {
                            identifier,
                            input: intent,
                            tenantId: apiClient.config.tenantId || '',
                        },
                        identifier: true,
                        ...(extraResultQuery !== undefined ? extraResultQuery : {}),
                    },
                },
            },
        };
        const confirmation = await api(jsonToGraphQLQuery(mutation));
        return confirmation.customer.update;
    };
    return {
        create,
        update,
    };
}
