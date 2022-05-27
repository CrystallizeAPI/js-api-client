export * from './core/client';
export * from './core/navigation';
export * from './core/hydrate';
export * from './core/catalogue';
export * from './core/order';
export * from './core/search';
export * from './types/product';
export * from './types/order';
export * from './types/payment';
export * from './types/components';
export * from './types/search';

import { createClient } from './core/client';
import { createNavigationFetcher } from './core/navigation';
import { createProductHydrater } from './core/hydrate';

import { createOrderPusher, createOrderPaymentUpdater, createOrderFetcher } from './core/order';
import { createCatalogueFetcher } from './core/catalogue';
import { createSearcher } from './core/search';

export const CrystallizeClient = createClient({
    tenantIdentifier: typeof process === 'object' ? process?.env.CRYSTALLIZE_TENANT_IDENTIFIER || '' : '',
    accessTokenId: typeof process === 'object' ? process?.env.CRYSTALLIZE_ACCESS_TOKEN_ID || '' : '',
    accessTokenSecret: typeof process === 'object' ? process?.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET || '' : '',
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
