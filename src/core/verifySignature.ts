import { CrystallizeSignature } from '../types/signature';

export type SimplifiedRequest = {
    url?: string;
    method?: string;
    body?: any;
    webhookUrl?: string;
};

export type CreateSignatureVerifierParams = {
    sha256: (data: string) => string;
    jwtVerify: (token: string, secret: string, options?: any) => CrystallizeSignature;
    secret: string;
};

const newQueryParams = (webhookUrl: string, receivedUrl: string): Record<string, string> => {
    const parseQueryString = (url: string): Record<string, string> => {
        const urlParams = new URL(url).searchParams;
        let params: Record<string, string> = {};
        for (const [key, value] of urlParams.entries()) {
            params[key] = value;
        }
        return params;
    };
    const webhookOriginalParams = parseQueryString(webhookUrl);
    const receivedParams = parseQueryString(receivedUrl);
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(receivedParams)) {
        if (!webhookOriginalParams.hasOwnProperty(key)) {
            result[key] = value;
        }
    }

    return result;
};

export const createSignatureVerifier = ({ sha256, jwtVerify, secret }: CreateSignatureVerifierParams) => {
    return (signature: string, request: SimplifiedRequest): any => {
        try {
            const payload = jwtVerify(signature, secret);
            const isValid = (challenge: any) => payload.hmac === sha256(JSON.stringify(challenge));
            const challenge = {
                url: request.url,
                method: request.method,
                body: request.body ? JSON.parse(request.body) : null,
            };
            if (!isValid(challenge)) {
                // we are going to do another check here for the webhook payload situation
                if (request.url && request.webhookUrl && request.method && request.method.toLowerCase() === 'get') {
                    const body = newQueryParams(request.webhookUrl, request.url);
                    if (Object.keys(body).length > 1) {
                        const newChallenge = {
                            url: request.webhookUrl,
                            method: request.method,
                            body,
                        };
                        if (isValid(newChallenge)) {
                            return payload;
                        }
                    }
                }
                throw new Error('Invalid signature. HMAC does not match.');
            }
            return payload;
        } catch (exception: any) {
            throw new Error('Invalid signature. ' + exception.message);
        }
    };
};
