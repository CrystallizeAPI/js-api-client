import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import {
    CatalogueSearchFilter,
    CatalogueSearchOrderBy,
    catalogueSearchFilter,
    catalogueSearchOrderBy,
} from '../types/search';
import { ClientInterface } from './client';

export function createSearcher(client: ClientInterface) {
    async function* search(
        language: string,
        nodeQuery: any,
        filter?: CatalogueSearchFilter,
        orderBy?: CatalogueSearchOrderBy,
        pageInfo?: any,
        limit?: {
            perPage?: number;
            total?: number;
        },
        cursors?: {
            before?: string;
            after?: string;
        },
    ): AsyncIterableIterator<any> {
        const args: Record<string, any> = {
            language,
            first: limit?.perPage ?? 100,
        };

        if (filter) {
            args.filter = catalogueSearchFilter.parse(filter);
        }
        if (orderBy) {
            args.orderBy = catalogueSearchOrderBy.parse(orderBy);
        }

        if (cursors?.after) {
            args.after = cursors.after;
        }
        if (cursors?.before) {
            args.after = cursors.before;
        }

        let query = {
            search: {
                __args: args,
                pageInfo: {
                    ...pageInfo,
                    hasNextPage: true,
                    endCursor: true,
                },
                edges: {
                    cursor: true,
                    node: nodeQuery,
                },
            },
        };
        let data;
        let yieldAt = 0;
        const max = limit?.total ?? Infinity;
        do {
            args.first = Math.min(max - yieldAt, args.first);
            data = await client.searchApi(jsonToGraphQLQuery({ query }));
            for (const edge of data.search.edges) {
                yield edge.node;
            }
            yieldAt += args.first;
            query.search.__args.after = data.search.pageInfo.endCursor;
        } while (data.search.pageInfo.hasNextPage && yieldAt < max);
    }

    return {
        search,
    };
}
