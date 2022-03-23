export * from './core/client';
import { createClient } from './core/client';

export const CrystallizeClient = createClient({
    tenantIdentifier: process.env.CRYSTALLIZE_TENANT_IDENTIFIER || '',
    accessTokenId: process.env.CRYSTALLIZE_ACCESS_TOKEN_ID || '',
    accessTokenSecret: process.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET || ''
});
