import fetch from 'node-fetch';

export interface ClientConfiguration {
    tenantIdentifier: string;
    accessTokenId?: string;
    accessTokenSecret?: string;
}

export type ApiCaller = (
    query: string,
    variables?: { [key: string]: string | number }
) => Promise<any>;

export interface ClientInterface {
    catalogueApi: ApiCaller;
    searchApi: ApiCaller;
    orderApi: ApiCaller;
    subscriptionApi: ApiCaller;
    pimApi: ApiCaller;
}

export function createClient(configuration: ClientConfiguration) {
    function createApiCaller(uri: string): ApiCaller {
        return async function callApi(
            query: string,
            variables?: { [key: string]: string | number }
        ): Promise<any> {
            const response = await fetch(uri, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'X-Crystallize-Access-Token-Id':
                        configuration.accessTokenId || '',
                    'X-Crystallize-Access-Token-Secret':
                        configuration.accessTokenSecret || ''
                },
                body: JSON.stringify({ query, variables })
            });
            const json = await (<any>response.json());
            if (json.errors) {
                console.log(JSON.stringify(json.errors, null, 2));
            }
            return json;
        };
    }

    return {
        catalogueApi: createApiCaller(
            `https://api.crystallize.com/${configuration.tenantIdentifier}/catalogue`
        ),
        searchApi: createApiCaller(
            `https://api.crystallize.com/${configuration.tenantIdentifier}/search`
        ),
        orderApi: createApiCaller(
            `https://api.crystallize.com/${configuration.tenantIdentifier}/orders`
        ),
        subscriptionApi: createApiCaller(
            `https://api.crystallize.com/${configuration.tenantIdentifier}/subscriptions`
        ),
        pimApi: createApiCaller(`https://pim.crystallize.com/graphql`)
    };
}
