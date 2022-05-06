import { jsonToGraphQLQuery, VariableType } from 'json-to-graphql-query';
import { ClientInterface } from './client';

enum NavigationType {
    Tree,
    Topics,
}

function nestedQuery(depth: number, start: number = 1, extraQuery?: (currentLevel: number) => any): any {
    const props = {
        name: true,
        path: true,
        ...(extraQuery !== undefined ? extraQuery(start - 1) : {}),
    };

    if (depth <= 1) {
        return props;
    }

    return {
        ...props,
        children: {
            ...nestedQuery(depth - 1, start + 1, extraQuery),
        },
    };
}

function buildQueryFor(type: NavigationType, path: string) {
    switch (type) {
        case NavigationType.Tree:
            return {
                __variables: {
                    language: 'String!',
                    path: 'String!',
                },
                tree: {
                    __aliasFor: 'catalogue',
                    __args: {
                        language: new VariableType('language'),
                        path: new VariableType('path'),
                    },
                },
            };
        case NavigationType.Topics:
            if (path === '' || path === '/') {
                return {
                    __variables: {
                        language: 'String!',
                    },
                    tree: {
                        __aliasFor: 'topics',
                        __args: {
                            language: new VariableType('language'),
                        },
                    },
                };
            }
            return {
                __variables: {
                    language: 'String!',
                    path: 'String!',
                },
                tree: {
                    __aliasFor: 'topic',
                    __args: {
                        language: new VariableType('language'),
                        path: new VariableType('path'),
                    },
                },
            };
    }
}

export type TreeFetcher = (
    path: string,
    language: string,
    depth: number,
    extraQuery?: any,
    perLevel?: (currentLevel: number) => any,
) => Promise<any>;

function fetchTree<T>(client: ClientInterface, type: NavigationType): TreeFetcher {
    return <T>(
        path: string,
        language: string,
        depth: number = 1,
        extraQuery?: any,
        perLevel?: (currentLevel: number) => any,
    ): Promise<T> => {
        const fetch = client.catalogueApi;
        const baseQuery = buildQueryFor(type, path);
        const query = {
            ...baseQuery,
            tree: {
                ...baseQuery.tree,
                ...nestedQuery(depth, 1, perLevel),
            },
            ...(extraQuery !== undefined ? extraQuery : {}),
        };
        return fetch(jsonToGraphQLQuery({ query }), { language, path });
    };
}

export function createNavigationFetcher(client: ClientInterface): {
    byFolders: TreeFetcher;
    byTopics: TreeFetcher;
} {
    return {
        byFolders: fetchTree(client, NavigationType.Tree),
        byTopics: fetchTree(client, NavigationType.Topics),
    };
}
