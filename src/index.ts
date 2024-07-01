export * from './core/client.js';
export * from './core/massCallClient.js';
export * from './core/navigation.js';
export * from './core/hydrate.js';
export * from './core/catalogue.js';
export * from './core/order.js';
export * from './core/search.js';
export * from './core/shape.js';
export * from './core/subscription.js';
export * from './core/customer.js';
export * from './core/pricing.js';
export * from './core/verifySignature.js';
export * from './types/product.js';
export * from './types/order.js';
export * from './types/payment.js';
export * from './types/components.js';
export * from './types/search.js';
export * from './types/subscription.js';
export * from './types/address.js';
export * from './types/customer.js';
export * from './types/signature.js';
export * from './types/pricing.js';
export * from './core/uploadImage.js';
export * from './core/editCart.js';

import { createClient } from './core/client.js';
import { createNavigationFetcher } from './core/navigation.js';
import { createProductHydrater } from './core/hydrate.js';

import { createOrderPusher, createOrderPaymentUpdater, createOrderFetcher } from './core/order.js';
import { createCatalogueFetcher } from './core/catalogue.js';
import { createSearcher } from './core/search.js';
import { createSubscriptionContractManager } from './core/subscription.js';
import { createCustomerManager } from './core/customer.js';

export const CrystallizeClient = createClient({
    tenantId: globalThis?.process?.env?.CRYSTALLIZE_TENANT_ID ?? '',
    tenantIdentifier: globalThis?.process?.env?.CRYSTALLIZE_TENANT_IDENTIFIER ?? '',
    accessTokenId: globalThis?.process?.env?.CRYSTALLIZE_ACCESS_TOKEN_ID ?? '',
    accessTokenSecret: globalThis?.process?.env?.CRYSTALLIZE_ACCESS_TOKEN_SECRET ?? '',
});

const navigationFetcher = createNavigationFetcher(CrystallizeClient);
export const CrystallizeNavigationFoldersFetcher = navigationFetcher.byFolders;
export const CrystallizeNavigationTopicsFetcher = navigationFetcher.byTopics;

const productHydrator = createProductHydrater(CrystallizeClient);
export const CrystallizeHydraterByPaths = productHydrator.byPaths;
export const CrystallizeHydraterBySkus = productHydrator.bySkus;

export const CrystallizeOrderPusher = createOrderPusher(CrystallizeClient);
export const CrystallizeCreateOrderPaymentUpdater = createOrderPaymentUpdater(CrystallizeClient);

export const CrystallizeCatalogueFetcher = createCatalogueFetcher(CrystallizeClient);
export const CrystallizeSearcher = createSearcher(CrystallizeClient);

const orderFetcher = createOrderFetcher(CrystallizeClient);
export const CrystallizeOrderFetcherById = orderFetcher.byId;
export const CrystallizeOrderFetcherByCustomerIdentifier = orderFetcher.byCustomerIdentifier;

export const CrystallizeSubscriptionContractManager = createSubscriptionContractManager(CrystallizeClient);
export const CrystallizeCustomerManager = createCustomerManager(CrystallizeClient);
