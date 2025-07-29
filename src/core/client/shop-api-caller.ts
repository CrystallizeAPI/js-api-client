import { authenticationHeaders, post, VariablesType } from './create-api-caller.js';
import { apiHost, ClientConfiguration, CreateClientOptions } from './create-client.js';
import { Grab } from './create-grabber.js';

const getExpirationAtFromToken = (token: string) => {
    const payload = token.split('.')[1];
    const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
    const parsedPayload = JSON.parse(decodedPayload);
    return parsedPayload.exp * 1000;
};

export const createShopApiCaller = (
    grab: Grab['grab'],
    configuration: ClientConfiguration,
    options?: CreateClientOptions,
) => {
    const identifier = configuration.tenantIdentifier;
    let shopApiToken = configuration.shopApiToken;
    return async function callApi<T>(query: string, variables?: VariablesType): Promise<T> {
        const tokenExpiresAt: number | null = shopApiToken ? getExpirationAtFromToken(shopApiToken) : null;
        const isTokenAboutToExpireOrIsExpired = tokenExpiresAt ? tokenExpiresAt - Date.now() < 1000 * 60 * 5 : true;
        if ((!shopApiToken || isTokenAboutToExpireOrIsExpired) && options?.shopApiToken?.doNotFetch !== true) {
            //static auth token must be removed to fetch the shop api token
            const { staticAuthToken, ...withoutStaticAuthToken } = configuration;
            const headers = {
                'Content-type': 'application/json; charset=UTF-8',
                Accept: 'application/json',
                ...authenticationHeaders(withoutStaticAuthToken),
            };
            const response = await grab(apiHost(configuration)([`@${identifier}`, 'auth', 'token'], 'shop-api'), {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    scopes: options?.shopApiToken?.scopes || ['cart'],
                    expiresIn: options?.shopApiToken?.expiresIn || 3600 * 12,
                }),
            });
            const results = await response.json<{
                success: boolean;
                token: string;
                error?: string;
            }>();
            if (results.success !== true) {
                throw new Error('Could not fetch shop api token: ' + results.error);
            }
            shopApiToken = results.token;
        }
        return post<T>(
            grab,
            apiHost(configuration)([`@${identifier}`, 'cart'], 'shop-api'),
            {
                ...configuration,
                shopApiToken: shopApiToken,
            },
            query,
            variables,
            {
                headers: {
                    Authorization: `Bearer ${shopApiToken}`,
                },
            },
            options,
        );
    };
};
