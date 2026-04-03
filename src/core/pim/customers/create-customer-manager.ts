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

/**
 * Creates a customer manager for creating, updating, and managing customer records via the Crystallize PIM API.
 * Requires PIM API credentials (accessTokenId/accessTokenSecret) in the client configuration.
 *
 * @param apiClient - A Crystallize client instance created via `createClient` with PIM credentials.
 * @returns An object with methods to `create`, `update`, `setMeta`, `setMetaKey`, `setExternalReference`, and `setExternalReferenceKey`.
 *
 * @example
 * ```ts
 * const customerManager = createCustomerManager(client);
 * const customer = await customerManager.create({
 *   identifier: 'customer@example.com',
 *   firstName: 'Jane',
 *   lastName: 'Doe',
 * });
 * ```
 */
export const createCustomerManager = (apiClient: ClientInterface) => {
    const create = async <OnCustomer, CustomerExtra = unknown>(
        intentCustomer: CreateCustomerInput,
        onCustomer?: CustomerExtra,
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

    const update = async <OnCustomer, CustomerExtra = unknown>(
        intentCustomer: UpdateCustomerInput,
        onCustomer?: CustomerExtra,
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
    const setMeta = async <OnCustomer, CustomerExtra = unknown>(
        identifier: string,
        intentMeta: NonNullable<UpdateCustomerInput['meta']>,
        onCustomer?: CustomerExtra,
    ): Promise<WithIdentifier<OnCustomer>> => {
        const meta = UpdateCustomerInputSchema.shape.meta.parse(intentMeta);
        return await update<OnCustomer, CustomerExtra>({ identifier, meta }, onCustomer);
    };

    // this is overriding completely the previous references (there is no merge method yes on the API)
    const setExternalReference = async <OnCustomer, CustomerExtra = unknown>(
        identifier: string,
        intentReferences: NonNullable<UpdateCustomerInput['externalReferences']>,
        onCustomer?: CustomerExtra,
    ): Promise<WithIdentifier<OnCustomer>> => {
        const references = UpdateCustomerInputSchema.shape.meta.parse(intentReferences);
        return await update<OnCustomer, CustomerExtra>({ identifier, externalReferences: references }, onCustomer);
    };

    const setMetaKey = async <OnCustomer, CustomerExtra = unknown>(
        identifier: string,
        key: string,
        value: string,
        onCustomer?: CustomerExtra,
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
        return await setMeta<OnCustomer, CustomerExtra>(identifier, newMeta, onCustomer);
    };

    const setExternalReferenceKey = async <OnCustomer, CustomerExtra = unknown>(
        identifier: string,
        key: string,
        value: string,
        onCustomer?: CustomerExtra,
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
        return await setExternalReference<OnCustomer, CustomerExtra>(identifier, newReferences, onCustomer);
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
