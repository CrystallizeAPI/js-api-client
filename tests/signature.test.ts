import { describe, expect, test } from 'vitest';
import { SignJWT } from 'jose';
import { createSignatureVerifier } from '../src';

const SECRET = 'xXx';
const secretBytes = new TextEncoder().encode(SECRET);

const sha256Hex = async (data: string): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
};

const signAs = async (claims: Record<string, unknown>): Promise<string> =>
    new SignJWT({
        aud: 'webhook',
        sub: 'signature',
        iss: 'crystallize',
        tenantId: 'tnt',
        tenantIdentifier: 'acme',
        ...claims,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(secretBytes);

describe('createSignatureVerifier', () => {
    test('POST request with a body', async () => {
        const url = 'https://a17e.ngrok.io/test/signature';
        const method = 'POST';
        const body = '{"item":{"get":{"id":"63f2d3b2a94533f79fc6397b","name":"test"}}}';
        const hmac = await sha256Hex(JSON.stringify({ url, method, body: JSON.parse(body) }));

        const verify = createSignatureVerifier({ secret: SECRET });
        const signature = await signAs({ hmac });

        const payload = await verify(signature, { url, method, body });
        expect(payload.hmac).toBe(hmac);
        expect(payload.tenantIdentifier).toBe('acme');
    });

    test('GET request without a body (app-style)', async () => {
        const url = 'https://helloworld.crystallize.app.local';
        const method = 'GET';
        const hmac = await sha256Hex(JSON.stringify({ url, method, body: null }));

        const verify = createSignatureVerifier({ secret: SECRET });
        const signature = await signAs({ hmac });

        const payload = await verify(signature, { url, method, body: null });
        expect(payload.hmac).toBe(hmac);
    });

    test('GET webhook with extra query params (webhookUrl fallback)', async () => {
        const webhookUrl = 'https://webhook.site/abc';
        const receivedUrl = `${webhookUrl}?id=65d8fc4c&tenantId=61f9937c&type=document`;
        const method = 'GET';
        const challengeBody = { id: '65d8fc4c', tenantId: '61f9937c', type: 'document' };
        const hmac = await sha256Hex(JSON.stringify({ url: webhookUrl, method, body: challengeBody }));

        const verify = createSignatureVerifier({ secret: SECRET });
        const signature = await signAs({ hmac });

        const payload = await verify(signature, { url: receivedUrl, webhookUrl, method });
        expect(payload.hmac).toBe(hmac);
    });

    test('rejects a signature whose hmac does not match', async () => {
        const verify = createSignatureVerifier({ secret: SECRET });
        const signature = await signAs({ hmac: 'nope' });

        await expect(verify(signature, { url: 'https://x.test', method: 'POST', body: '{}' })).rejects.toThrow(
            /Invalid signature\. HMAC does not match\./,
        );
    });

    test('rejects a signature signed with the wrong secret', async () => {
        const other = new TextEncoder().encode('OTHER');
        const signature = await new SignJWT({ hmac: 'doesnt-matter' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(other);

        const verify = createSignatureVerifier({ secret: SECRET });
        await expect(verify(signature, { url: 'https://x.test', method: 'POST', body: '{}' })).rejects.toThrow(
            /Invalid signature\./,
        );
    });
});
