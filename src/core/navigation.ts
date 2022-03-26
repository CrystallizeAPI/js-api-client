import { jsonToGraphQLQuery, VariableType } from 'json-to-graphql-query';
import { ClientInterface } from './client';

function nestedQuery(
    depth: number,
    start: number = 1,
    extraQuery?: (currentLevel: number) => any
): any {
    const props = {
        name: true,
        path: true,
        ...(extraQuery !== undefined ? extraQuery(start - 1) : {})
    };

    if (depth <= 1) {
        return props;
    }

    return {
        ...props,
        ['level' + start]: {
            __aliasFor: 'children',
            ...nestedQuery(depth - 1, start + 1, extraQuery)
        }
    };
}

export function createNavigationTreeFetcher(client: ClientInterface) {
    return async (
        path: string,
        language: string,
        depth: number = 1,
        extraQuery?: any,
        perLevel?: (currentLevel: number) => any
    ): Promise<any> => {
        const fetch = client.catalogueApi;
        const query = {
            query: {
                __variables: {
                    language: 'String!',
                    path: 'String!'
                },
                navigationTree: {
                    __aliasFor: 'catalogue',
                    __args: {
                        language: new VariableType('language'),
                        path: new VariableType('path')
                    },
                    ...nestedQuery(depth, 1, perLevel)
                },
                ...(extraQuery !== undefined ? extraQuery : {})
            }
        };
        return await fetch(jsonToGraphQLQuery(query), { language, path });
    };
}
