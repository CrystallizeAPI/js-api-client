export * from './core/client';
export * from './core/navigation';
export * from './core/hydrate';
export * from './core/product.types';
export * from './core/order.types';

import { createClient } from './core/client';
import {
    createNavigationByFoldersFetcher,
    createNavigationByTopicsFetcher
} from './core/navigation';
import {
    createProductHydraterByPaths,
    createProductHydraterBySkus
} from './core/hydrate';

import { createOrderPusher } from './core/order';

export const CrystallizeClient = createClient({
    tenantIdentifier: process.env.CRYSTALLIZE_TENANT_IDENTIFIER || '',
    accessTokenId: process.env.CRYSTALLIZE_ACCESS_TOKEN_ID || '',
    accessTokenSecret: process.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET || ''
});

export const CrystallizeNavigationFoldersFetcher =
    createNavigationByFoldersFetcher(CrystallizeClient);
export const CrystallizeNavigationTopicsFetcher =
    createNavigationByTopicsFetcher(CrystallizeClient);
export const CrystallizeHydraterByPaths =
    createProductHydraterByPaths(CrystallizeClient);
export const CrystallizeHydraterBySkus =
    createProductHydraterBySkus(CrystallizeClient);
export const CrystallizeOrderPusher = createOrderPusher(CrystallizeClient);
