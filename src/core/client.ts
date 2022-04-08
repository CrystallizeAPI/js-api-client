import fetch from 'node-fetch';

export interface ClientConfiguration {
    tenantIdentifier: string;
    accessTokenId?: string;
    accessTokenSecret?: string;
}

type VariablesType = { [key: string]: string | number | string[] | number[] };

type ApiCaller<T> = (query: string, variables?: VariablesType) => Promise<T>;

export interface ClientInterface {
    catalogueApi: ApiCaller<any>;
    searchApi: ApiCaller<any>;
    orderApi: ApiCaller<any>;
    subscriptionApi: ApiCaller<any>;
    pimApi: ApiCaller<any>;
}

async function post<T>(
    path: string,
    config: ClientConfiguration,
    query: string,
    variables?: VariablesType,
    init?: RequestInit
): Promise<T> {
    try {
        const response = await fetch(path, {
            ...init,
            method: 'POST',
            headers: {
                'Content-type': 'application/json; charset=UTF-8',
                Accept: 'application/json',
                'X-Crystallize-Access-Token-Id': config.accessTokenId || '',
                'X-Crystallize-Access-Token-Secret': config.accessTokenSecret || ''
            },
            body: JSON.stringify({ query, variables })
        });

        if (response.ok && 204 === response.status) {
            return <T>{};
        }
        if (!response.ok) {
            const json = await response.json();
            throw {
                code: response.status,
                statusText: response.statusText,
                message: json.message,
                errors: json.errors || {}
            };
        }
        return <T>(await response.json()).data;
    } catch (exception) {
        throw exception;
    }
}

export function createClient(configuration: ClientConfiguration): ClientInterface {
    function createApiCaller(uri: string): ApiCaller<any> {
        return function callApi<T>(query: string, variables?: VariablesType): Promise<T> {
            return post<T>(uri, configuration, query, variables);
        };
    }

    return {
        catalogueApi: createApiCaller(`https://api.crystallize.com/${configuration.tenantIdentifier}/catalogue`),
        searchApi: createApiCaller(`https://api.crystallize.com/${configuration.tenantIdentifier}/search`),
        orderApi: createApiCaller(`https://api.crystallize.com/${configuration.tenantIdentifier}/orders`),
        subscriptionApi: createApiCaller(`https://api.crystallize.com/${configuration.tenantIdentifier}/subscriptions`),
        pimApi: createApiCaller(`https://pim.crystallize.com/graphql`)
    };
}
