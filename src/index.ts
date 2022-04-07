export * from './core/client';
export * from './core/navigation';
export * from './core/hydrate';
export * from './core/catalogue';
export * from './types/product.types';
export * from './types/order.types';
export * from './types/payment.types';

import { createClient } from './core/client';
import { createNavigationByFoldersFetcher, createNavigationByTopicsFetcher } from './core/navigation';
import { createProductHydraterByPaths, createProductHydraterBySkus } from './core/hydrate';

import { createOrderPusher, createOrderPaymentUpdater } from './core/order';
import { createCatalogueFetcher } from './core/catalogue';

export const CrystallizeClient = createClient({
    tenantIdentifier: typeof process === 'object' ? process?.env.CRYSTALLIZE_TENANT_IDENTIFIER || '' : '',
    accessTokenId: typeof process === 'object' ? process?.env.CRYSTALLIZE_ACCESS_TOKEN_ID || '' : '',
    accessTokenSecret: typeof process === 'object' ? process?.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET || '' : ''
});

export const CrystallizeNavigationFoldersFetcher = createNavigationByFoldersFetcher(CrystallizeClient);
export const CrystallizeNavigationTopicsFetcher = createNavigationByTopicsFetcher(CrystallizeClient);
export const CrystallizeHydraterByPaths = createProductHydraterByPaths(CrystallizeClient);
export const CrystallizeHydraterBySkus = createProductHydraterBySkus(CrystallizeClient);
export const CrystallizeOrderPusher = createOrderPusher(CrystallizeClient);
export const CrystallizeCreateOrderPaymentUpdater = createOrderPaymentUpdater(CrystallizeClient);
export const CrystallizeCatalogueFetcher = createCatalogueFetcher(CrystallizeClient);
