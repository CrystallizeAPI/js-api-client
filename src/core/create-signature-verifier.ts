import { jwtVerify } from 'jose';

export type CrystallizeSignature = {
    aud: 'webhook' | 'app' | 'frontend';
    sub: 'signature';
    iss: 'crystallize';
    exp: number; // Timestamp
    iat: number; // Timestamp
    userId?: string;
    tenantId: string;
    tenantIdentifier: string;
    hmac: string;
};

export type SimplifiedRequest = {
    url?: string;
    method?: string;
    body?: string | null;
    webhookUrl?: string;
};

export type CreateSignatureVerifierParams = {
    secret: string;
};

export type SignatureVerifier = (signature: string, request: SimplifiedRequest) => Promise<CrystallizeSignature>;

const sha256Hex = async (data: string): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
};

const newQueryParams = (webhookUrl: string, receivedUrl: string): Record<string, string> => {
    const parseQueryString = (url: string): Record<string, string> => {
        const urlParams = new URL(url).searchParams;
        const params: Record<string, string> = {};
        for (const [key, value] of urlParams.entries()) {
            params[key] = value;
        }
        return params;
    };
    const webhookOriginalParams = parseQueryString(webhookUrl);
    const receivedParams = parseQueryString(receivedUrl);
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(receivedParams)) {
        if (!Object.prototype.hasOwnProperty.call(webhookOriginalParams, key)) {
            result[key] = value;
        }
    }
    return result;
};

const buildChallenge = (request: SimplifiedRequest) => ({
    url: request.url,
    method: request.method,
    body: request.body ? JSON.parse(request.body) : null,
});

const buildGETSituationChallenge = (request: SimplifiedRequest) => {
    if (request.url && request.webhookUrl && request.method && request.method.toLowerCase() === 'get') {
        const body = newQueryParams(request.webhookUrl, request.url);
        if (Object.keys(body).length > 0) {
            return { url: request.webhookUrl, method: request.method, body };
        }
    }
    return null;
};

/**
 * Creates a signature verifier for validating Crystallize webhook / app / frontend signatures.
 * Verifies the HS256 JWT envelope with the shared secret and matches its `hmac` claim against
 * a SHA-256 of the reconstructed challenge.
 *
 * @example
 * ```ts
 * const verify = createSignatureVerifier({ secret: process.env.CRYSTALLIZE_WEBHOOK_SECRET! });
 * const payload = await verify(signatureHeader, { url, method, body: rawBodyString });
 * ```
 */
export const createSignatureVerifier = ({ secret }: CreateSignatureVerifierParams): SignatureVerifier => {
    const secretBytes = new TextEncoder().encode(secret);

    return async (signature, request) => {
        try {
            const { payload } = await jwtVerify(signature, secretBytes, { algorithms: ['HS256'] });
            const claims = payload as unknown as CrystallizeSignature;
            const isValid = async (challenge: unknown) => claims.hmac === (await sha256Hex(JSON.stringify(challenge)));

            if (await isValid(buildChallenge(request))) {
                return claims;
            }
            const fallback = buildGETSituationChallenge(request);
            if (fallback && (await isValid(fallback))) {
                return claims;
            }
            throw new Error('HMAC does not match.');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error('Invalid signature. ' + message);
        }
    };
};
