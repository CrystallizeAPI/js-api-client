import fetch from 'node-fetch';

export interface ClientConfiguration {
    tenantIdentifier: string;
    accessTokenId?: string;
    accessTokenSecret?: string;
}

export type ApiCaller = (query: string, variables?: { [key: string]: string | number }) => Promise<any>;

export class Client {
    private _configuration: ClientConfiguration;

    constructor() {
        this._configuration = {
            tenantIdentifier: process.env.CRYSTALLIZE_TENANT_IDENTIFIER || '',
            accessTokenId: process.env.CRYSTALLIZE_ACCESS_TOKEN_ID || '',
            accessTokenSecret: process.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET || '',
        };
    }
    public set configuration(value: ClientConfiguration) {
        this._configuration = value;
    }

    private _createApiCaller(uri: string): ApiCaller {
        const configuration = this._configuration;
        return async function callApi(query: string, variables?: { [key: string]: string | number }): Promise<any> {
            const response = await fetch(uri, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "X-Crystallize-Access-Token-Id": configuration.accessTokenId || "",
                    "X-Crystallize-Access-Token-Secret": configuration.accessTokenSecret || "",
                },
                body: JSON.stringify({ query, variables }),
            });
            const json = await <any>response.json();
            if (json.errors) {
                console.log(JSON.stringify(json.errors, null, 2));
            }
            return json;
        };
    }

    public get catalogueApi(): ApiCaller {
        return this._createApiCaller(`https://api.crystallize.com/${this._configuration.tenantIdentifier}/catalogue`);
    }

    public get searchApi(): ApiCaller {
        return this._createApiCaller(`https://api.crystallize.com/${this._configuration.tenantIdentifier}/search`);
    }

    public get orderApi(): ApiCaller {
        return this._createApiCaller(`https://api.crystallize.com/${this._configuration.tenantIdentifier}/orders`);
    }

    public get subscriptionApi(): ApiCaller {
        return this._createApiCaller(`https://api.crystallize.com/${this._configuration.tenantIdentifier}/subscriptions`);
    }

    public get pimApi(): ApiCaller {
        return this._createApiCaller(`https://pim.crystallize.com/graphql`);
    }
}
