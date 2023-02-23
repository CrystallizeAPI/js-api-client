import { CrystallizeSignature } from '../types/signature';

export type SimplifiedRequest = {
    url?: string;
    method?: string;
    body?: any;
};

export type CreateSignatureVerifierParams = {
    sha256: (data: string) => string;
    jwtVerify: (token: string, secret: string, options?: any) => CrystallizeSignature;
    secret: string;
};

export const createSignatureVerifier = ({ sha256, jwtVerify, secret }: CreateSignatureVerifierParams) => {
    return (signature: string, request: SimplifiedRequest): any => {
        try {
            const payload = jwtVerify(signature, secret);
            const isValid =
                payload.hmac ===
                sha256(
                    JSON.stringify({
                        url: request.url,
                        method: request.method,
                        body: JSON.parse(request.body),
                    }),
                );
            if (!isValid) {
                throw new Error('Invalid signature. HMAC does not match');
            }
            return payload;
        } catch (exception: any) {
            throw new Error('Invalid signature. ' + exception.message);
        }
    };
};
