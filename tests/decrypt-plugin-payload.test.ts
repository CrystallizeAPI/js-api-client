import { describe, expect, test } from 'vitest';
import {
    CompactEncrypt,
    SignJWT,
    exportJWK,
    generateKeyPair,
    importJWK,
    type JSONWebKeySet,
    type JWK,
    type KeyLike,
} from 'jose';
import { createPluginPayloadDecrypter } from '../src';

const generateVendorKeys = async (): Promise<{ publicJwk: JWK; privateJwk: JWK }> => {
    const { publicKey, privateKey } = await generateKeyPair('RSA-OAEP-256', { modulusLength: 2048, extractable: true });
    const publicJwk = { ...(await exportJWK(publicKey)), kid: 'vendor-1', use: 'enc', alg: 'RSA-OAEP-256' };
    const privateJwk = { ...(await exportJWK(privateKey)), kid: 'vendor-1', use: 'enc', alg: 'RSA-OAEP-256' };
    return { publicJwk, privateJwk };
};

const encryptBytesForVendor = async (publicJwk: JWK, plaintext: Uint8Array, cty?: string) => {
    const key = await importJWK(publicJwk, 'RSA-OAEP-256');
    const header: Record<string, unknown> = {
        alg: 'RSA-OAEP-256',
        enc: 'A256GCM',
        kid: publicJwk.kid,
    };
    if (cty) header.cty = cty;
    return new CompactEncrypt(plaintext).setProtectedHeader(header as never).encrypt(key);
};

type Issuer = {
    jwks: JSONWebKeySet;
    issuer: string;
    signer: KeyLike;
    kid: string;
};

const makeJwksIssuer = async (issuerOverride?: string): Promise<Issuer> => {
    const { publicKey, privateKey } = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });
    const publicJwk = { ...(await exportJWK(publicKey)), kid: 'core-sign-1', use: 'sig', alg: 'RS256' };
    return {
        jwks: { keys: [publicJwk] },
        issuer: issuerOverride ?? 'https://api.crystallize.example',
        signer: privateKey as KeyLike,
        kid: 'core-sign-1',
    };
};

const buildProtocolPayload = async (args: {
    vendorPublic: JWK;
    issuer: Issuer;
    audience: string;
    envelopeExtras?: Record<string, unknown>;
    secretsPlain?: Record<string, string>;
    backendTokenExtras?: Record<string, unknown>;
    expiresInSeconds?: number;
}) => {
    const {
        vendorPublic,
        issuer,
        audience,
        envelopeExtras = {},
        secretsPlain = {},
        backendTokenExtras,
        expiresInSeconds = 300,
    } = args;

    const encryptedSecrets: Record<string, string> = {};
    for (const [field, value] of Object.entries(secretsPlain)) {
        encryptedSecrets[field] = await encryptBytesForVendor(vendorPublic, new TextEncoder().encode(value));
    }

    const now = Math.floor(Date.now() / 1000);

    let backendToken: string | undefined;
    if (backendTokenExtras) {
        backendToken = await new SignJWT({ ...backendTokenExtras })
            .setProtectedHeader({ alg: 'RS256', kid: issuer.kid })
            .setIssuer(issuer.issuer)
            .setAudience(audience)
            .setSubject('user-123')
            .setIssuedAt(now)
            .setNotBefore(now - 1)
            .setExpirationTime(now + expiresInSeconds)
            .setJti(crypto.randomUUID())
            .sign(issuer.signer);
    }

    const envelopeClaims: Record<string, unknown> = {
        installationId: 'inst-1',
        tenantIdentifier: 'acme',
        pluginIdentifier: audience,
        revisionId: 'rev-1',
        config: { brand: 'Acme' },
        encryptedSecrets,
        ...envelopeExtras,
    };
    if (backendToken) envelopeClaims.backendToken = backendToken;

    const innerJwt = await new SignJWT(envelopeClaims)
        .setProtectedHeader({ alg: 'RS256', kid: issuer.kid })
        .setIssuer(issuer.issuer)
        .setAudience(audience)
        .setSubject('user-123')
        .setIssuedAt(now)
        .setNotBefore(now - 1)
        .setExpirationTime(now + expiresInSeconds)
        .setJti(crypto.randomUUID())
        .sign(issuer.signer);

    return encryptBytesForVendor(vendorPublic, new TextEncoder().encode(innerJwt), 'JWT');
};

describe('createPluginPayloadDecrypter', () => {
    test('decrypts a non-nested JWE and emits plaintext + skipped signature', async () => {
        const { publicJwk, privateJwk } = await generateVendorKeys();
        const jwe = await encryptBytesForVendor(publicJwk, new TextEncoder().encode('hello'));

        const decrypt = createPluginPayloadDecrypter({ privateJwk });
        const out = await decrypt(jwe);

        expect(out.protectedHeader.alg).toBe('RSA-OAEP-256');
        expect(out.protectedHeader.enc).toBe('A256GCM');
        expect(out.plaintext).toBe('hello');
        expect(out.envelope).toBeNull();
        expect(out.signature.verified).toBe(false);
        expect(out.signature.skipped).toBe(true);
        expect(out.secrets).toEqual({});
        expect(out.backendToken).toBeNull();
    });

    test('full protocol: decrypts envelope, verifies inner JWS, and decrypts per-field secrets', async () => {
        const { publicJwk, privateJwk } = await generateVendorKeys();
        const issuer = await makeJwksIssuer();
        const audience = 'com.vendor.test';
        const jwe = await buildProtocolPayload({
            vendorPublic: publicJwk,
            issuer,
            audience,
            secretsPlain: { StripeApiKey: 'sk_live_abc', WebhookSecret: 'whsec_def' },
            envelopeExtras: { entityContext: { orderId: 'ord-42' } },
        });

        const decrypt = createPluginPayloadDecrypter({
            privateJwk,
            verify: { jwks: issuer.jwks, issuer: issuer.issuer, audience },
        });
        const out = await decrypt(jwe);

        expect(out.protectedHeader.cty).toBe('JWT');
        expect(out.signature).toEqual({
            verified: true,
            issuer: issuer.issuer,
            audience,
            algorithm: 'RS256',
        });
        expect(out.envelope?.iss).toBe(issuer.issuer);
        expect(out.envelope?.aud).toBe(audience);
        expect(out.envelope?.installationId).toBe('inst-1');
        expect(out.envelope?.tenantIdentifier).toBe('acme');
        expect(out.envelope?.entityContext).toEqual({ orderId: 'ord-42' });
        expect(out.secrets).toEqual({ StripeApiKey: 'sk_live_abc', WebhookSecret: 'whsec_def' });
        expect(out.plaintext).toBeNull();
    });

    test('without verify, signature verification is skipped even when a nested JWT is present', async () => {
        const { publicJwk, privateJwk } = await generateVendorKeys();
        const issuer = await makeJwksIssuer();
        const jwe = await buildProtocolPayload({
            vendorPublic: publicJwk,
            issuer,
            audience: 'com.vendor.test',
            secretsPlain: { ApiKey: 'sk_abc' },
        });

        const decrypt = createPluginPayloadDecrypter({ privateJwk });
        const out = await decrypt(jwe);

        expect(out.signature.verified).toBe(false);
        expect(out.signature.skipped).toBe(true);
        expect(out.envelope?.aud).toBe('com.vendor.test');
        expect(out.secrets).toEqual({ ApiKey: 'sk_abc' });
    });

    test('signature verification failure (wrong audience) still emits envelope + secrets with signature.verified=false', async () => {
        const { publicJwk, privateJwk } = await generateVendorKeys();
        const issuer = await makeJwksIssuer();
        const jwe = await buildProtocolPayload({
            vendorPublic: publicJwk,
            issuer,
            audience: 'com.vendor.test',
            secretsPlain: { ApiKey: 'sk_abc' },
        });

        const decrypt = createPluginPayloadDecrypter({
            privateJwk,
            verify: { jwks: issuer.jwks, issuer: issuer.issuer, audience: 'com.vendor.OTHER' },
        });
        const out = await decrypt(jwe);

        expect(out.signature.verified).toBe(false);
        expect(out.signature.skipped).toBeUndefined();
        expect(typeof out.signature.reason).toBe('string');
        expect(out.envelope?.aud).toBe('com.vendor.test');
        expect(out.secrets).toEqual({ ApiKey: 'sk_abc' });
    });

    test('verifyBackendToken verifies envelope.backendToken against the same JWKS', async () => {
        const { publicJwk, privateJwk } = await generateVendorKeys();
        const issuer = await makeJwksIssuer();
        const audience = 'com.vendor.test';
        const jwe = await buildProtocolPayload({
            vendorPublic: publicJwk,
            issuer,
            audience,
            backendTokenExtras: { act: { pluginIdentifier: audience, installationId: 'inst-1', revisionId: 'rev-1' } },
        });

        const decrypt = createPluginPayloadDecrypter({
            privateJwk,
            verify: { jwks: issuer.jwks, issuer: issuer.issuer, audience, verifyBackendToken: true },
        });
        const out = await decrypt(jwe);

        expect(out.backendToken?.verified).toBe(true);
        expect(out.backendToken?.claims?.iss).toBe(issuer.issuer);
        expect(out.backendToken?.claims?.act).toEqual({
            pluginIdentifier: audience,
            installationId: 'inst-1',
            revisionId: 'rev-1',
        });
    });

    test('backend token is decoded (not verified) when verifyBackendToken is not set', async () => {
        const { publicJwk, privateJwk } = await generateVendorKeys();
        const issuer = await makeJwksIssuer();
        const audience = 'com.vendor.test';
        const jwe = await buildProtocolPayload({
            vendorPublic: publicJwk,
            issuer,
            audience,
            backendTokenExtras: { act: { pluginIdentifier: audience } },
        });

        const decrypt = createPluginPayloadDecrypter({
            privateJwk,
            verify: { jwks: issuer.jwks, issuer: issuer.issuer, audience },
        });
        const out = await decrypt(jwe);

        expect(out.backendToken?.verified).toBe(false);
        expect(out.backendToken?.skipped).toBe(true);
        expect(out.backendToken?.claims?.iss).toBe(issuer.issuer);
    });

    test('decryption with the wrong vendor key throws', async () => {
        const { publicJwk } = await generateVendorKeys();
        const { privateJwk: otherPrivate } = await generateVendorKeys();
        const jwe = await encryptBytesForVendor(publicJwk, new TextEncoder().encode('x'));

        const decrypt = createPluginPayloadDecrypter({ privateJwk: otherPrivate });

        await expect(decrypt(jwe)).rejects.toThrow();
    });

    test('rejects an encryptedSecrets entry that is not a compact JWE', async () => {
        const { publicJwk, privateJwk } = await generateVendorKeys();
        const issuer = await makeJwksIssuer();
        const audience = 'com.vendor.test';

        const now = Math.floor(Date.now() / 1000);
        const innerJwt = await new SignJWT({
            installationId: 'inst-1',
            tenantIdentifier: 'acme',
            pluginIdentifier: audience,
            revisionId: 'rev-1',
            config: {},
            encryptedSecrets: { ApiKey: 'not-a-jwe' },
        })
            .setProtectedHeader({ alg: 'RS256', kid: issuer.kid })
            .setIssuer(issuer.issuer)
            .setAudience(audience)
            .setSubject('user-123')
            .setIssuedAt(now)
            .setExpirationTime(now + 300)
            .sign(issuer.signer);
        const jwe = await encryptBytesForVendor(publicJwk, new TextEncoder().encode(innerJwt), 'JWT');

        const decrypt = createPluginPayloadDecrypter({
            privateJwk,
            verify: { jwks: issuer.jwks, issuer: issuer.issuer, audience },
        });

        await expect(decrypt(jwe)).rejects.toThrow(/not a valid JWE compact string/);
    });

    test('verify without issuer defaults to the production Crystallize issuer', async () => {
        const { publicJwk, privateJwk } = await generateVendorKeys();
        const issuer = await makeJwksIssuer('https://api.crystallize.com');
        const audience = 'com.vendor.test';
        const jwe = await buildProtocolPayload({ vendorPublic: publicJwk, issuer, audience });

        // Only `audience` and an inline `jwks` are supplied — `issuer` defaults.
        const decrypt = createPluginPayloadDecrypter({
            privateJwk,
            verify: { jwks: issuer.jwks, audience },
        });
        const out = await decrypt(jwe);

        expect(out.signature.verified).toBe(true);
        expect(out.signature.issuer).toBe('https://api.crystallize.com');
        expect(out.envelope?.iss).toBe('https://api.crystallize.com');
    });

    test('private key and JWKS are reused across calls (single decrypter, many payloads)', async () => {
        const { publicJwk, privateJwk } = await generateVendorKeys();
        const issuer = await makeJwksIssuer();
        const audience = 'com.vendor.test';

        const [a, b] = await Promise.all([
            buildProtocolPayload({
                vendorPublic: publicJwk,
                issuer,
                audience,
                secretsPlain: { K: 'v1' },
            }),
            buildProtocolPayload({
                vendorPublic: publicJwk,
                issuer,
                audience,
                secretsPlain: { K: 'v2' },
            }),
        ]);

        const decrypt = createPluginPayloadDecrypter({
            privateJwk,
            verify: { jwks: issuer.jwks, issuer: issuer.issuer, audience },
        });

        const [outA, outB] = await Promise.all([decrypt(a), decrypt(b)]);
        expect(outA.signature.verified).toBe(true);
        expect(outB.signature.verified).toBe(true);
        expect(outA.secrets.K).toBe('v1');
        expect(outB.secrets.K).toBe('v2');
    });
});
