import {
    compactDecrypt,
    createLocalJWKSet,
    createRemoteJWKSet,
    decodeJwt,
    decodeProtectedHeader,
    importJWK,
    jwtVerify,
    type CryptoKey,
    type JSONWebKeySet,
    type JWK,
    type JWTPayload,
} from 'jose';

type PrivateKey = CryptoKey | Uint8Array;

const ALLOWED_ALG = new Set(['RSA-OAEP', 'RSA-OAEP-256']);
const ALLOWED_ENC = new Set(['A128GCM', 'A192GCM', 'A256GCM']);

const DEFAULT_ISSUER = 'https://api.crystallize.com';
const jwksUrlFor = (issuer: string): string =>
    `${issuer.endsWith('/') ? issuer.slice(0, -1) : issuer}/.well-known/jwks.json`;

export type PluginPayloadDecrypterVerifyOptions = {
    /**
     * Inline JWKS. Takes precedence over `jwksUrl`. Useful in tests or when
     * JWKS are loaded out-of-band.
     */
    jwks?: JSONWebKeySet;
    /**
     * Remote JWKS URL. Defaults to `${issuer}/.well-known/jwks.json`.
     */
    jwksUrl?: string;
    /**
     * Expected JWT `iss` (Crystallize Core base URL). Defaults to
     * `https://api.crystallize.com` (production).
     */
    issuer?: string;
    /**
     * Expected JWT `aud` — your plugin identifier (reverse-DNS). Required.
     */
    audience: string;
    clockTolerance?: number;
    verifyBackendToken?: boolean;
};

export type CreatePluginPayloadDecrypterOptions = {
    privateJwk: JWK;
    verify?: PluginPayloadDecrypterVerifyOptions;
};

export type SignatureStatus = {
    verified: boolean;
    skipped?: boolean;
    reason?: string;
    issuer?: string;
    audience?: string;
    algorithm?: string;
};

export type CrystallizeBackendToken = JWTPayload & {
    act?: {
        pluginIdentifier?: string;
        tenantId?: string;
        installationId?: string;
        revisionId?: string;
        [key: string]: unknown;
    };
};

export type BackendTokenStatus = {
    verified: boolean;
    skipped?: boolean;
    reason?: string;
    claims?: CrystallizeBackendToken;
};

/**
 * The decoded plugin payload — the JWT claims emitted by Crystallize Core
 * once the outer JWE has been decrypted and the inner JWS has been parsed.
 *
 * Two protocol variants share this shape:
 * - Webhook payloads carry `event` (e.g. `"install"`, `"uninstall"`).
 * - Iframe payloads carry `entityContext` instead of `event`.
 * The two are mutually exclusive at the protocol level; the type leaves both
 * optional so a single decoder can return either.
 *
 * `TConfiguration` lets callers narrow the plugin-specific `configuration`
 * blob; it defaults to `Record<string, unknown>`.
 */
export type CrystallizePluginPayload<TConfiguration = Record<string, unknown>> = JWTPayload & {
    tenantId: string;
    tenantIdentifier: string;
    installationId: string;
    pluginIdentifier: string;
    revisionId: string;
    configuration: TConfiguration;
    encryptedSecrets: Record<string, string>;
    backendToken: string;
    /** Present for plugins that receive Crystallize webhooks. */
    signatureSecret?: string;
    /** Present for plugins that expose a Discovery endpoint. */
    staticAuthToken?: string;
    /** Webhook variant: lifecycle event name (e.g. `"install"`). */
    event?: string;
    /** Iframe variant: contextual entity payload from Crystallize. */
    entityContext?: unknown;
};

export type DecryptedPluginPayload<TConfiguration = Record<string, unknown>> = {
    protectedHeader: Record<string, unknown>;
    innerProtectedHeader: Record<string, unknown> | null;
    plaintext: string | null;
    envelope: CrystallizePluginPayload<TConfiguration> | null;
    secrets: Record<string, string>;
    signatureStatus: SignatureStatus;
    backendTokenStatus: BackendTokenStatus | null;
};

export type PluginPayloadDecrypter<TConfiguration = Record<string, unknown>> = (
    payload: string,
) => Promise<DecryptedPluginPayload<TConfiguration>>;

const looksLikeCompactJwe = (value: string): boolean => typeof value === 'string' && value.split('.').length === 5;
const looksLikeCompactJws = (value: string): boolean => typeof value === 'string' && value.split('.').length === 3;

type JwksGetter = Parameters<typeof jwtVerify>[1];

/**
 * Creates a decrypter for Crystallize plugin JWE payloads.
 *
 * The returned function decrypts the outer JWE with the vendor's private JWK
 * (RSA-OAEP / RSA-OAEP-256, A*GCM). When the outer header carries `cty: "JWT"`,
 * the plaintext is a compact JWS whose claims form the envelope. Per-field
 * secrets in `envelope.encryptedSecrets` are compact JWEs encrypted to the same
 * vendor key and are decrypted in turn.
 *
 * Signature verification is opt-in: pass `verify` (with at least an `audience`)
 * to enable it. `issuer` defaults to `https://api.crystallize.com` and `jwksUrl`
 * defaults to `${issuer}/.well-known/jwks.json`, so production usage is a
 * one-liner. Override either for staging or self-hosted deployments, or pass
 * an inline `jwks` (takes precedence over `jwksUrl`) for tests.
 *
 * When `verify` is omitted — or when verification fails — the envelope and
 * secrets are still returned so the caller can inspect them; the `signature`
 * field reports whether the payload can be trusted.
 *
 * The private key and JWKS resolver are built once and reused across calls,
 * which matters for `verify.jwksUrl` (jose caches remote JWKS internally).
 *
 * @example
 * ```ts
 * // Production: JWKS URL and issuer default to api.crystallize.com.
 * const decrypt = createPluginPayloadDecrypter({
 *     privateJwk,
 *     verify: { audience: 'com.vendor.plugin' },
 * });
 * const decoded = await decrypt(jweCompact);
 * ```
 */
export const createPluginPayloadDecrypter = <TConfiguration = Record<string, unknown>>({
    privateJwk,
    verify,
}: CreatePluginPayloadDecrypterOptions): PluginPayloadDecrypter<TConfiguration> => {
    let privateKeyPromise: Promise<PrivateKey> | null = null;
    const getPrivateKey = (): Promise<PrivateKey> => {
        if (!privateKeyPromise) {
            privateKeyPromise = importJWK(privateJwk, (privateJwk.alg as string) ?? 'RSA-OAEP-256');
        }
        return privateKeyPromise;
    };

    const resolvedVerify = verify
        ? (() => {
              const issuer = verify.issuer ?? DEFAULT_ISSUER;
              const jwksUrl = verify.jwks ? undefined : (verify.jwksUrl ?? jwksUrlFor(issuer));
              return {
                  jwks: verify.jwks,
                  jwksUrl,
                  issuer,
                  audience: verify.audience,
                  clockTolerance: verify.clockTolerance,
                  verifyBackendToken: verify.verifyBackendToken,
              };
          })()
        : undefined;

    const jwks: JwksGetter | null = resolvedVerify?.jwks
        ? createLocalJWKSet(resolvedVerify.jwks)
        : resolvedVerify?.jwksUrl
          ? createRemoteJWKSet(new URL(resolvedVerify.jwksUrl), {
                timeoutDuration: 15_000,
                cooldownDuration: 30_000,
            })
          : null;

    return async (payload: string): Promise<DecryptedPluginPayload<TConfiguration>> => {
        const privateKey = await getPrivateKey();

        const { plaintext: outerBytes, protectedHeader } = await compactDecrypt(payload, privateKey);
        if (!ALLOWED_ALG.has(String(protectedHeader.alg))) {
            throw new Error(
                `Rejected outer JWE: alg=${JSON.stringify(protectedHeader.alg)} not in {${[...ALLOWED_ALG].join(', ')}}`,
            );
        }
        if (!ALLOWED_ENC.has(String(protectedHeader.enc))) {
            throw new Error(
                `Rejected outer JWE: enc=${JSON.stringify(protectedHeader.enc)} not in {${[...ALLOWED_ENC].join(', ')}}`,
            );
        }

        const outerPlaintext = new TextDecoder().decode(outerBytes);

        let envelopeClaims: JWTPayload | null = null;
        let innerProtectedHeader: Record<string, unknown> | null = null;
        const signatureStatus: SignatureStatus = { verified: false };

        if (protectedHeader.cty === 'JWT' && looksLikeCompactJws(outerPlaintext)) {
            try {
                innerProtectedHeader = decodeProtectedHeader(outerPlaintext) as Record<string, unknown>;
            } catch {
                // malformed JWS — later jwtVerify/decodeJwt will surface a clearer error
            }
        }

        if (protectedHeader.cty === 'JWT' && looksLikeCompactJws(outerPlaintext)) {
            if (resolvedVerify && jwks) {
                signatureStatus.issuer = resolvedVerify.issuer;
                signatureStatus.audience = resolvedVerify.audience;
                try {
                    const { payload: claims, protectedHeader: jwsHeader } = await jwtVerify(outerPlaintext, jwks, {
                        issuer: resolvedVerify.issuer,
                        audience: resolvedVerify.audience,
                        algorithms: ['RS256'],
                        clockTolerance: resolvedVerify.clockTolerance ?? 30,
                    });
                    envelopeClaims = claims;
                    signatureStatus.verified = true;
                    signatureStatus.algorithm = String(jwsHeader.alg ?? 'RS256');
                } catch (error) {
                    envelopeClaims = decodeJwt(outerPlaintext);
                    signatureStatus.verified = false;
                    signatureStatus.reason = error instanceof Error ? error.message : String(error);
                }
            } else {
                envelopeClaims = decodeJwt(outerPlaintext);
                signatureStatus.skipped = true;
                signatureStatus.reason = 'no verify options provided; inner JWS signature NOT verified';
            }
        } else {
            signatureStatus.skipped = true;
            signatureStatus.reason =
                protectedHeader.cty === 'JWT'
                    ? 'cty=JWT but outer plaintext is not a compact JWS'
                    : `outer JWE is not a nested JWT (cty=${JSON.stringify(protectedHeader.cty)})`;
        }

        const secrets: Record<string, string> = {};
        const encryptedSecrets = (envelopeClaims?.encryptedSecrets ?? {}) as Record<string, unknown>;
        for (const [field, ciphertext] of Object.entries(encryptedSecrets)) {
            if (typeof ciphertext !== 'string' || !looksLikeCompactJwe(ciphertext)) {
                throw new Error(`encryptedSecrets[${JSON.stringify(field)}] is not a valid JWE compact string`);
            }
            const { plaintext: secretBytes } = await compactDecrypt(ciphertext, privateKey);
            secrets[field] = new TextDecoder().decode(secretBytes);
        }

        let backendTokenStatus: BackendTokenStatus | null = null;
        if (envelopeClaims && typeof envelopeClaims.backendToken === 'string') {
            backendTokenStatus = { verified: false };
            if (resolvedVerify?.verifyBackendToken && jwks) {
                try {
                    const { payload: tokenClaims } = await jwtVerify(envelopeClaims.backendToken, jwks, {
                        issuer: resolvedVerify.issuer,
                        audience: resolvedVerify.audience,
                        algorithms: ['RS256'],
                        clockTolerance: resolvedVerify.clockTolerance ?? 30,
                    });
                    backendTokenStatus.verified = true;
                    backendTokenStatus.claims = tokenClaims as CrystallizeBackendToken;
                } catch (error) {
                    backendTokenStatus.reason = error instanceof Error ? error.message : String(error);
                    try {
                        backendTokenStatus.claims = decodeJwt(envelopeClaims.backendToken) as CrystallizeBackendToken;
                    } catch {
                        // give up silently — we already have reason set
                    }
                }
            } else {
                backendTokenStatus.skipped = true;
                backendTokenStatus.reason = resolvedVerify
                    ? 'backend token signature check disabled (pass verify.verifyBackendToken to enable)'
                    : 'no verify options provided; backend token signature NOT verified';
                try {
                    backendTokenStatus.claims = decodeJwt(envelopeClaims.backendToken) as CrystallizeBackendToken;
                } catch {
                    // leave claims undefined
                }
            }
        }

        return {
            protectedHeader: protectedHeader as Record<string, unknown>,
            innerProtectedHeader,
            plaintext: envelopeClaims ? null : outerPlaintext,
            envelope: envelopeClaims as CrystallizePluginPayload<TConfiguration> | null,
            secrets,
            signatureStatus,
            backendTokenStatus,
        };
    };
};
