import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from '../../client/create-client.js';
import {
    CreateCustomerGroupInput,
    CreateCustomerGroupInputSchema,
    UpdateCustomerGroupInput,
    UpdateCustomerGroupInputSchema,
} from '@crystallize/schema/pim';

type WithIdentifier<R> = R & { identifier: string };

export const createCustomerGroupManager = (apiClient: ClientInterface) => {
    const create = async <OnCustomerGroup, OCG = unknown>(
        intentCustomer: CreateCustomerGroupInput,
        onCustomerGroup?: OCG,
    ): Promise<WithIdentifier<OnCustomerGroup>> => {
        const input = CreateCustomerGroupInputSchema.parse(intentCustomer);
        const mutation = {
            createCustomerGroup: {
                __args: {
                    input,
                },
                __on: [
                    {
                        __typeName: 'CustomerGroup',
                        identifier: true,
                        ...onCustomerGroup,
                    },
                    {
                        __typeName: 'BasicError',
                        errorName: true,
                        message: true,
                    },
                ],
            },
        };
        const confirmation = await apiClient.nextPimApi<{ createCustomerGroup: WithIdentifier<OnCustomerGroup> }>(
            jsonToGraphQLQuery({ mutation }),
        );
        return confirmation.createCustomerGroup;
    };

    const update = async <OnCustomerGroup, OCG = unknown>(
        intentCustomer: UpdateCustomerGroupInput,
        onCustomerGroup?: OCG,
    ): Promise<WithIdentifier<OnCustomerGroup>> => {
        const { identifier, ...input } = UpdateCustomerGroupInputSchema.parse(intentCustomer);
        const mutation = {
            updateCustomerGroup: {
                __args: {
                    identifier,
                    input,
                },
                __on: [
                    {
                        __typeName: 'CustomerGroup',
                        identifier: true,
                        ...onCustomerGroup,
                    },
                    {
                        __typeName: 'BasicError',
                        errorName: true,
                        message: true,
                    },
                ],
            },
        };
        const confirmation = await apiClient.nextPimApi<{ updateCustomerGroup: WithIdentifier<OnCustomerGroup> }>(
            jsonToGraphQLQuery({ mutation }),
        );
        return confirmation.updateCustomerGroup;
    };
    return {
        create,
        update,
    };
};
