import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from '../client/create-client.js';
import {
    CartInput,
    CartInputSchema,
    CartSkuItemInput,
    CartSkuItemInputSchema,
    CustomerInput,
    CustomerInputSchema,
    MetaInput,
} from '@crystallize/schema/shop';
import { transformCartCustomerInput, transformCartInput } from './helpers.js';

type WithId<R> = R & { id: string };

/**
 * Creates a cart manager for hydrating, placing, and managing shopping carts via the Crystallize Shop Cart API.
 * Requires a shop API token or appropriate credentials in the client configuration.
 *
 * @param apiClient - A Crystallize client instance created via `createClient`.
 * @returns An object with methods to `hydrate`, `fetch`, `place`, `fulfill`, `abandon`, `addSkuItem`, `removeItem`, `setMeta`, and `setCustomer`.
 *
 * @example
 * ```ts
 * const cartManager = createCartManager(client);
 * const cart = await cartManager.hydrate({
 *   items: [{ sku: 'SKU-001', quantity: 2 }],
 *   locale: { displayName: 'English', language: 'en' },
 * });
 * const placed = await cartManager.place(cart.id);
 * ```
 */
export const createCartManager = (apiClient: ClientInterface) => {
    const cartQuery = async <OnCart, CartExtra = unknown>(
        name: string,
        args: Record<string, unknown>,
        onCart?: CartExtra,
    ) => {
        const query = { [name]: { __args: args, id: true, ...onCart } };
        const response = await apiClient.shopCartApi<Record<string, WithId<CartExtra>>>(jsonToGraphQLQuery({ query }));
        return response[name];
    };

    const cartMutation = async <OnCart, CartExtra = unknown>(
        name: string,
        args: Record<string, unknown>,
        onCart?: CartExtra,
    ) => {
        const mutation = { [name]: { __args: args, id: true, ...onCart } };
        const response = await apiClient.shopCartApi<Record<string, WithId<CartExtra>>>(
            jsonToGraphQLQuery({ mutation }),
        );
        return response[name];
    };

    type MetaIntent = {
        meta: MetaInput;
        merge: boolean;
    };

    return {
        hydrate: async <OnCart, CartExtra = unknown>(intent: CartInput, onCart?: CartExtra) => {
            const input = CartInputSchema.parse(intent);
            return cartMutation<OnCart, CartExtra>('hydrate', { input: transformCartInput(input) }, onCart);
        },
        place: <OnCart, CartExtra = unknown>(id: string, onCart?: CartExtra) =>
            cartMutation<OnCart, CartExtra>('place', { id }, onCart),
        fetch: <OnCart, CartExtra = unknown>(id: string, onCart?: CartExtra) =>
            cartQuery<OnCart, CartExtra>('cart', { id }, onCart),
        fulfill: <OnCart, CartExtra = unknown>(id: string, orderId: string, onCart?: CartExtra) =>
            cartMutation<OnCart, CartExtra>('fulfill', { id, orderId }, onCart),
        abandon: <OnCart, CartExtra = unknown>(id: string, onCart?: CartExtra) =>
            cartMutation<OnCart, CartExtra>('abandon', { id }, onCart),
        addSkuItem: async <OnCart, CartExtra = unknown>(id: string, intent: CartSkuItemInput, onCart?: CartExtra) => {
            const input = CartSkuItemInputSchema.parse(intent);
            return cartMutation<OnCart, CartExtra>('addSkuItem', { id, input }, onCart);
        },
        removeItem: <OnCart, CartExtra = unknown>(
            id: string,
            { sku, quantity }: { sku: string; quantity: number },
            onCart?: CartExtra,
        ) => cartMutation<OnCart, CartExtra>('removeCartItem', { id, sku, quantity }, onCart),
        setMeta: <OnCart, CartExtra = unknown>(id: string, { meta, merge }: MetaIntent, onCart?: CartExtra) =>
            cartMutation<OnCart, CartExtra>('setMeta', { id, merge, meta }, onCart),
        setCustomer: async <OnCart, CartExtra = unknown>(
            id: string,
            customerIntent: CustomerInput,
            onCart?: CartExtra,
        ) => {
            const input = CustomerInputSchema.parse(customerIntent);
            return cartMutation<OnCart, CartExtra>(
                'setCustomer',
                { id, input: transformCartCustomerInput(input) },
                onCart,
            );
        },
    };
};
