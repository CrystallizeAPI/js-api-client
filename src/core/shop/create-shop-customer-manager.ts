import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from '../client/create-client.js';
import {
    AddressInput,
    AddressInputSchema,
    CustomerWithIdentifierInput,
    CustomerWithIdentifierInputSchema,
    MetaInput,
    MetaInputSchema,
} from '@crystallize/schema/shop';
import { transformAddressInput, transformShopCustomerInput } from './helpers.js';

type WithIdentifier<R> = R & { identifier: string };

export type ShopCustomerMetaIntent = {
    meta: MetaInput;
    merge?: boolean;
};

/**
 * Creates a customer manager for the Crystallize Shop API `/customer` endpoint, where customers are keyed by
 * `identifier`. For Core API customers, use `createCustomerManager`.
 * The Shop API token is fetched (with the `customer` scope) for you, see `createClient`.
 *
 * Every method returns the customer `identifier` plus the fields selected with `onCustomer`;
 * `meta` and `externalReferences` are read back as JSON objects, not as `[{ key, value }]` lists.
 *
 * @param apiClient - A Crystallize client instance created via `createClient`.
 * @returns An object with methods to `fetch`, `upsert`, `addAddress`, `setAddress`, `removeAddress`, and `setMeta`.
 *
 * @example
 * ```ts
 * const customerManager = createShopCustomerManager(client);
 * await customerManager.upsert({ identifier: 'john@doe.com', email: 'john@doe.com', firstName: 'John' });
 * await customerManager.addAddress('john@doe.com', { type: 'delivery', street: 'Main St 1', city: 'Oslo' });
 * ```
 */
export const createShopCustomerManager = (apiClient: ClientInterface) => {
    const customerOperation = async <R>(
        operation: 'query' | 'mutation',
        name: string,
        args: Record<string, unknown>,
        onCustomer?: Record<string, unknown>,
    ) => {
        const graphQLQuery = { [operation]: { [name]: { __args: args, identifier: true, ...onCustomer } } };
        const response = await apiClient.shopCustomerApi<Record<string, R>>(jsonToGraphQLQuery(graphQLQuery));
        return response[name];
    };

    return {
        /** Rejects with a `JSApiClientCallError` when the customer does not exist. */
        fetch: <OnCustomer = unknown>(identifier: string, onCustomer?: Record<string, unknown>) =>
            customerOperation<WithIdentifier<OnCustomer>>('query', 'customer', { identifier }, onCustomer),
        /** Creates the customer, or updates it when one with this `identifier` exists. */
        upsert: async <OnCustomer = unknown>(
            intent: CustomerWithIdentifierInput,
            onCustomer?: Record<string, unknown>,
        ) => {
            const input = CustomerWithIdentifierInputSchema.parse(intent);
            return customerOperation<WithIdentifier<OnCustomer>>(
                'mutation',
                'customer',
                { input: transformShopCustomerInput(input) },
                onCustomer,
            );
        },
        addAddress: async <OnCustomer = unknown>(
            identifier: string,
            intent: AddressInput,
            onCustomer?: Record<string, unknown>,
        ) => {
            const input = AddressInputSchema.parse(intent);
            return customerOperation<WithIdentifier<OnCustomer>>(
                'mutation',
                'addAddress',
                { identifier, input: transformAddressInput(input) },
                onCustomer,
            );
        },
        setAddress: async <OnCustomer = unknown>(
            identifier: string,
            index: number,
            intent: AddressInput,
            onCustomer?: Record<string, unknown>,
        ) => {
            const input = AddressInputSchema.parse(intent);
            return customerOperation<WithIdentifier<OnCustomer>>(
                'mutation',
                'setAddress',
                { identifier, index, input: transformAddressInput(input) },
                onCustomer,
            );
        },
        removeAddress: <OnCustomer = unknown>(
            identifier: string,
            index: number,
            onCustomer?: Record<string, unknown>,
        ) =>
            customerOperation<WithIdentifier<OnCustomer>>(
                'mutation',
                'removeAddress',
                { identifier, index },
                onCustomer,
            ),
        setMeta: async <OnCustomer = unknown>(
            identifier: string,
            { meta, merge = true }: ShopCustomerMetaIntent,
            onCustomer?: Record<string, unknown>,
        ) =>
            customerOperation<WithIdentifier<OnCustomer>>(
                'mutation',
                'setMeta',
                { identifier, meta: MetaInputSchema.parse(meta), merge },
                onCustomer,
            ),
    };
};
