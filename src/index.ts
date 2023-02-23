export * from './core/client';
export * from './core/massCallClient';
export * from './core/navigation';
export * from './core/hydrate';
export * from './core/catalogue';
export * from './core/order';
export * from './core/search';
export * from './core/subscription';
export * from './core/customer';
export * from './core/pricing';
export * from './core/verifySignature';
export * from './types/product';
export * from './types/order';
export * from './types/payment';
export * from './types/components';
export * from './types/search';
export * from './types/subscription';
export * from './types/address';
export * from './types/customer';
export * from './types/signature';
export * from './types/pricing';

import { createClient } from './core/client';
import { createNavigationFetcher } from './core/navigation';
import { createProductHydrater } from './core/hydrate';

import { createOrderPusher, createOrderPaymentUpdater, createOrderFetcher } from './core/order';
import { createCatalogueFetcher } from './core/catalogue';
import { createSearcher } from './core/search';
import { createSubscriptionContractManager } from './core/subscription';
import { createCustomerManager } from './core/customer';

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
