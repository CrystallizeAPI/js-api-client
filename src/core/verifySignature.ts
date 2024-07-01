import { CrystallizeSignature } from '../types/signature.js';

export type SimplifiedRequest = {
    url?: string;
    method?: string;
    body?: any;
    webhookUrl?: string;
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

export type CreateAsyncSignatureVerifierParams = {
    sha256: (data: string) => Promise<string>;
    jwtVerify: (token: string, secret: string, options?: any) => Promise<CrystallizeSignature>;
    secret: string;
};

const buildChallenge = (request: SimplifiedRequest) => {
    return {
        url: request.url,
        method: request.method,
        body: request.body ? JSON.parse(request.body) : null,
    };
};
const buildGETSituationChallenge = (request: SimplifiedRequest) => {
    if (request.url && request.webhookUrl && request.method && request.method.toLowerCase() === 'get') {
        const body = newQueryParams(request.webhookUrl, request.url);
        if (Object.keys(body).length > 0) {
            return {
                url: request.webhookUrl,
                method: request.method,
                body,
            };
        }
    }
    return null;
};

export const createAsyncSignatureVerifier = ({ sha256, jwtVerify, secret }: CreateAsyncSignatureVerifierParams) => {
    return async (signature: string, request: SimplifiedRequest): Promise<CrystallizeSignature> => {
        try {
            const payload = await jwtVerify(signature, secret);
            const isValid = async (challenge: any) => payload.hmac === (await sha256(JSON.stringify(challenge)));
            const challenge = buildChallenge(request);
            if (!(await isValid(challenge))) {
                const newChallenge = buildGETSituationChallenge(request);
                if (newChallenge && (await isValid(newChallenge))) {
                    return payload;
                }
                throw new Error('Invalid signature. HMAC does not match.');
            }
            return payload;
        } catch (exception: any) {
            throw new Error('Invalid signature. ' + exception.message);
        }
    };
};

/**
 * @deprecated you should use the `CreateAsyncSignatureVerifierParams` type instead
 */
export type CreateSignatureVerifierParams = {
    sha256: (data: string) => string;
    jwtVerify: (token: string, secret: string, options?: any) => CrystallizeSignature;
    secret: string;
};

/**
 * @deprecated you should use the `createAsyncSignatureVerifier` function instead
 */
export const createSignatureVerifier = ({ sha256, jwtVerify, secret }: CreateSignatureVerifierParams) => {
    return (signature: string, request: SimplifiedRequest): CrystallizeSignature => {
        try {
            const payload = jwtVerify(signature, secret);
            const isValid = (challenge: any) => payload.hmac === sha256(JSON.stringify(challenge));
            const challenge = buildChallenge(request);
            if (!isValid(challenge)) {
                const newChallenge = buildGETSituationChallenge(request);
                if (newChallenge && isValid(newChallenge)) {
                    return payload;
                }
                throw new Error('Invalid signature. HMAC does not match.');
            }
            return payload;
        } catch (exception: any) {
            throw new Error('Invalid signature. ' + exception.message);
        }
    };
};
