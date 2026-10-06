import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from '../client/create-client.js';

/**
 * Creates a distributed lock backed by the Crystallize Shop API `/lock` endpoint,
 * e.g. to make sure a payment webhook and a redirect don't both turn the same cart into an order.
 * The Shop API token is fetched (with the `lock` scope) for you, see `createClient`.
 *
 * @param apiClient - A Crystallize client instance created via `createClient`.
 * @returns An object with methods to `acquire` (`true` when the lock was free) and `release` a lock.
 *
 * @example
 * ```ts
 * const lock = createShopLock(client);
 * if (await lock.acquire(`cart-${cartId}`, 30)) {
 *   try {
 *     // …create the order
 *   } finally {
 *     await lock.release(`cart-${cartId}`);
 *   }
 * }
 * ```
 */
export const createShopLock = (apiClient: ClientInterface) => {
    const lockMutation = async (name: 'acquire' | 'release', args: Record<string, unknown>) => {
        const mutation = { [name]: { __args: args } };
        const response = await apiClient.shopLockApi<Record<string, boolean | null>>(jsonToGraphQLQuery({ mutation }));
        return response[name] === true;
    };

    return {
        /** Acquires `key` for `ttl` seconds (default 60); resolves `false` when it is already held. */
        acquire: (key: string, ttl: number = 60) => lockMutation('acquire', { key, ttl }),
        release: (key: string) => lockMutation('release', { key }),
    };
};
