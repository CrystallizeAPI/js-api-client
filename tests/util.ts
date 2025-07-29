import {
    createClient as JSApiCreateClient,
    ClientConfiguration,
    CreateClientOptions,
} from '../src/core/client/create-client.js';

export const walkTree = (tree: any[], cb: any) => {
    tree.forEach((node) => {
        cb(node);
        if (node?.children?.length) {
            walkTree(node.children, cb);
        }
    });
};

type Options = {
    config?: ClientConfiguration;
    options?: CreateClientOptions;
};
export const createApiClient = (options?: Options) => {
    return JSApiCreateClient(
        {
            tenantIdentifier: process.env.CRYSTALLIZE_TENANT_IDENTIFIER || 'default',
            tenantId: process.env.CRYSTALLIZE_TENANT_ID || 'default',
            accessTokenId: process.env.CRYSTALLIZE_ACCESS_TOKEN_ID || 'xXx',
            accessTokenSecret: process.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET || 'xXx',
            origin: process.env.CRYSTALLIZE_ORIGIN || '.crystallize.com',
            ...options?.config,
        },
        options?.options,
    );
};
