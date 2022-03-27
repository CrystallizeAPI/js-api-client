export * from './core/client';
export * from './core/navigation';
import { createClient } from './core/client';
import { createNavigationByFoldersFetcher } from './core/navigation';

export const CrystallizeClient = createClient({
    tenantIdentifier: process.env.CRYSTALLIZE_TENANT_IDENTIFIER || '',
    accessTokenId: process.env.CRYSTALLIZE_ACCESS_TOKEN_ID || '',
    accessTokenSecret: process.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET || ''
});

export const CrystallizeNavigationTreeFetcher =
    createNavigationByFoldersFetcher(CrystallizeClient);
