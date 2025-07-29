import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from '../../client/create-client.js';
import {
    CreateCustomerInput,
    CreateCustomerInputSchema,
    Customer,
    UpdateCustomerInput,
    UpdateCustomerInputSchema,
} from '@crystallize/schema/pim';
import { transformCustomerInput } from './helpers.js';
import { createCustomerFetcher } from './create-customer-fetcher.js';

type WithIdentifier<R> = R & { identifier: string };

export const createCustomerManager = (apiClient: ClientInterface) => {
    const create = async <OnCustomer, OC = unknown>(
        intentCustomer: CreateCustomerInput,
        onCustomer?: OC,
    ): Promise<WithIdentifier<OnCustomer>> => {
        const input = CreateCustomerInputSchema.parse(intentCustomer);
        const mutation = {
            createCustomer: {
                __args: {
                    input: transformCustomerInput(input),
                },
                __on: [
                    {
                        __typeName: 'Customer',
                        identifier: true,
                        ...onCustomer,
                    },
                    {
                        __typeName: 'BasicError',
                        errorName: true,
                        message: true,
                    },
                ],
            },
        };
        const confirmation = await apiClient.nextPimApi<{ createCustomer: WithIdentifier<OnCustomer> }>(
            jsonToGraphQLQuery({ mutation }),
        );
        return confirmation.createCustomer;
    };

    const update = async <OnCustomer, OC = unknown>(
        intentCustomer: UpdateCustomerInput,
        onCustomer?: OC,
    ): Promise<WithIdentifier<OnCustomer>> => {
        const { identifier, ...input } = UpdateCustomerInputSchema.parse(intentCustomer);
        const mutation = {
            updateCustomer: {
                __args: {
                    identifier,
                    input: transformCustomerInput(input),
                },
                __on: [
                    {
                        __typeName: 'Customer',
                        identifier: true,
                        ...onCustomer,
                    },
                    {
                        __typeName: 'BasicError',
                        errorName: true,
                        message: true,
                    },
                ],
            },
        };
        const confirmation = await apiClient.nextPimApi<{ updateCustomer: WithIdentifier<OnCustomer> }>(
            jsonToGraphQLQuery({ mutation }),
        );
        return confirmation.updateCustomer;
    };

    // this is overriding completely the previous meta (there is no merge method yes on the API)
    const setMeta = async <OnCustomer, OC = unknown>(
        identifier: string,
        intentMeta: NonNullable<UpdateCustomerInput['meta']>,
        onCustomer?: OC,
    ): Promise<WithIdentifier<OnCustomer>> => {
        const meta = UpdateCustomerInputSchema.shape.meta.parse(intentMeta);
        return await update<OnCustomer, OC>({ identifier, meta }, onCustomer);
    };

    // this is overriding completely the previous references (there is no merge method yes on the API)
    const setExternalReference = async <OnCustomer, OC = unknown>(
        identifier: string,
        intentReferences: NonNullable<UpdateCustomerInput['externalReferences']>,
        onCustomer?: OC,
    ): Promise<WithIdentifier<OnCustomer>> => {
        const references = UpdateCustomerInputSchema.shape.meta.parse(intentReferences);
        return await update<OnCustomer, OC>({ identifier, externalReferences: references }, onCustomer);
    };

    const setMetaKey = async <OnCustomer, OC = unknown>(
        identifier: string,
        key: string,
        value: string,
        onCustomer?: OC,
    ): Promise<WithIdentifier<OnCustomer>> => {
        const fetcher = createCustomerFetcher(apiClient);
        const customer = await fetcher.byIdentifier<{ meta: Customer['meta'] }>(identifier, {
            meta: {
                key: true,
                value,
            },
        });
        if (!customer) {
            throw new Error(`Customer with identifier ${identifier} not found`);
        }
        const existingMeta = customer.meta || [];
        const newMeta = existingMeta.filter((m) => m.key !== key).concat({ key, value }) as NonNullable<
            UpdateCustomerInput['meta']
        >;
        return await setMeta<OnCustomer, OC>(identifier, newMeta, onCustomer);
    };

    const setExternalReferenceKey = async <OnCustomer, OC = unknown>(
        identifier: string,
        key: string,
        value: string,
        onCustomer?: OC,
    ): Promise<WithIdentifier<OnCustomer>> => {
        const fetcher = createCustomerFetcher(apiClient);
        const customer = await fetcher.byIdentifier<{ externalReferences: Customer['externalReferences'] }>(
            identifier,
            {
                externalReferences: {
                    key: true,
                    value,
                },
            },
        );
        if (!customer) {
            throw new Error(`Customer with identifier ${identifier} not found`);
        }
        const existingReferences = customer.externalReferences || [];
        const newReferences = existingReferences.filter((m) => m.key !== key).concat({ key, value }) as NonNullable<
            UpdateCustomerInput['externalReferences']
        >;
        return await setExternalReference<OnCustomer, OC>(identifier, newReferences, onCustomer);
    };
    return {
        create,
        update,
        setMeta,
        setMetaKey,
        setExternalReference,
        setExternalReferenceKey,
    };
};
