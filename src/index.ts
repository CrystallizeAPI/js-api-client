export * from './core/client';
export * from './core/navigation';
export * from './core/hydrate';
export * from './core/product.types';

import { createClient } from './core/client';
import {
    createNavigationByFoldersFetcher,
    createNavigationByTopicsFetcher
} from './core/navigation';
import {
    createProductHydraterByPaths,
    createProductHydraterBySkus
} from './core/hydrate';

export const CrystallizeClient = createClient({
    tenantIdentifier: process.env.CRYSTALLIZE_TENANT_IDENTIFIER || '',
    accessTokenId: process.env.CRYSTALLIZE_ACCESS_TOKEN_ID || '',
    accessTokenSecret: process.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET || ''
});

export const CrystallizeNavigationTreeFetcher =
    createNavigationByFoldersFetcher(CrystallizeClient);
export const CrystallizeNavigationTopicsFetcher =
    createNavigationByTopicsFetcher(CrystallizeClient);
export const CrystallizeHydraterByPaths =
    createProductHydraterByPaths(CrystallizeClient);
export const CrystallizeHydraterBySkus =
    createProductHydraterBySkus(CrystallizeClient);
