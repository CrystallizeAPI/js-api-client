# JS API Client

Helpers and typed utilities for working with the Crystallize APIs.

> v5 is a major revamp: simpler client, typed inputs via @crystallize/schema, and focused managers for common tasks (catalogue, navigation, hydration, orders, customers, subscriptions, and cart).

## Installation

```bash
pnpm add @crystallize/js-api-client
# or
npm install @crystallize/js-api-client
# or
yarn add @crystallize/js-api-client
```

## Quick start

```typescript
import { createClient } from '@crystallize/js-api-client';

const api = createClient({
    tenantIdentifier: 'furniture',
    // For protected APIs, provide credentials
    // accessTokenId: '…',
    // accessTokenSecret: '…',
    // staticAuthToken: '…',
    // and more
});

// Call any GraphQL you already have (string query + variables)
const { catalogue } = await api.catalogueApi(
    `query Q($path: String!, $language: String!) {
    catalogue(path: $path, language: $language) { name path }
}`,
    { path: '/shop', language: 'en' },
);

// Don't forget to close when using HTTP/2 option (see below)
api.close();
```

## Quick summary

- One client with callers: `catalogueApi`, `discoveryApi`, `pimApi`, `nextPimApi`, `meApi`, `shopCartApi`
- High-level helpers: `createCatalogueFetcher`, `createNavigationFetcher`, `createProductHydrater`, `createOrderFetcher`, `createOrderManager`, `createCustomerManager`, `createCustomerGroupManager`, `createSubscriptionContractManager`, `createCartManager`
- Utilities: `createSignatureVerifier`, `createPluginPayloadDecrypter`, `createBinaryFileManager`, `pricesForUsageOnTier`, request `profiling`
- Build GraphQL with objects using `json-to-graphql-query` (see section below)
- Strong typing via `@crystallize/schema` inputs and outputs
- Upgrading? See [UPGRADE.md](UPGRADE.md) for v4 → v5 migration

## Options and environment

`createClient(configuration, options?)`

- configuration
    - `tenantIdentifier` (required)
    - `tenantId` optional
    - `accessTokenId` / `accessTokenSecret` or `sessionId`
    - `bearerToken` for backend-issued Bearer tokens (sent as `Authorization: Bearer …`)
    - `staticAuthToken` for read-only catalogue/discovery
    - `shopApiToken` optional; otherwise auto-fetched
    - `shopApiStaging` to use the staging Shop API
    - `origin` custom host suffix (defaults to `.crystallize.com`)
- options
    - `useHttp2` enable HTTP/2 transport
    - `timeout` request timeout in milliseconds; requests that take longer will be aborted
    - `http2IdleTimeout` HTTP/2 idle timeout in milliseconds (default `300000` — 5 minutes). Use a shorter value for serverless functions, a longer one for long-running servers
    - `profiling` callbacks
    - `extraHeaders` extra request headers for all calls
    - `shopApiToken` controls auto-fetch: `{ doNotFetch?: boolean; scopes?: string[]; expiresIn?: number }`

`client.close()` should be called when you enable HTTP/2 to gracefully close the underlying session.

### Available API callers

- `catalogueApi` – Catalogue GraphQL
- `discoveryApi` – Discovery GraphQL (replaces the old Search API)
- `pimApi` – PIM GraphQL (classic /graphql soon legacy)
- `nextPimApi` – PIM Next GraphQL (scoped to tenant)
- `meApi` – Me GraphQL (`/@me`, authenticated-user scoped)
- `shopCartApi` – Shop Cart GraphQL (token handled for you)

All callers share the same signature: `<T>(query: string, variables?: Record<string, unknown>) => Promise<T>`.

### Authentication overview

Pass the relevant credentials to `createClient`:

- `staticAuthToken` for catalogue/discovery read-only
- `accessTokenId` + `accessTokenSecret` (or `sessionId`) for PIM/Shop operations
- `bearerToken` for backend-issued tokens — sent as `Authorization: Bearer …`; accepted by `catalogueApi`, `discoveryApi`, `pimApi`, `nextPimApi`, and `meApi`. Also used automatically to fetch the Shop API token when no other credentials are provided.
- `shopApiToken` optional; if omitted, a token will be fetched using your PIM credentials on first cart call

Authentication priority (per caller, highest first): `sessionId` → `bearerToken` → `staticAuthToken` → `accessTokenId`/`accessTokenSecret`.

See the official docs for auth: https://crystallize.com/learn/developer-guides/api-overview/authentication

### Error handling

API call errors throw a `JSApiClientCallError` with both `code` and `statusCode` properties for the HTTP status:

```typescript
import { JSApiClientCallError } from '@crystallize/js-api-client';

try {
    await api.pimApi(`query { … }`);
} catch (e) {
    if (e instanceof JSApiClientCallError) {
        console.error(`HTTP ${e.statusCode}:`, e.message);
        // e.code also works (same value)
    }
}
```

## Profiling requests

Log queries, timings and server timing if available.

```typescript
import { createClient } from '@crystallize/js-api-client';

const api = createClient(
    { tenantIdentifier: 'furniture' },
    {
        profiling: {
            onRequest: (q) => console.debug('[CRYSTALLIZE] >', q),
            onRequestResolved: ({ resolutionTimeMs, serverTimeMs }, q) =>
                console.debug('[CRYSTALLIZE] <', resolutionTimeMs, 'ms (server', serverTimeMs, 'ms)'),
        },
    },
);
```

## GraphQL builder: json-to-graphql-query

This library embraces the awesome [json-to-graphql-query](https://www.npmjs.com/package/json-to-graphql-query) under the hood so you can build GraphQL queries using plain JS objects. Most helpers accept an object and transform it into a GraphQL string for you.

- You can still call the low-level callers with raw strings.
- For catalogue-related helpers, we expose `catalogueFetcherGraphqlBuilder` to compose reusable fragments.

Example object → query string:

```typescript
import { jsonToGraphQLQuery } from 'json-to-graphql-query';

const query = jsonToGraphQLQuery({
    query: {
        catalogue: {
            __args: { path: '/shop', language: 'en' },
            name: true,
            path: true,
        },
    },
});
```

## High-level helpers

These helpers build queries, validate inputs using `@crystallize/schema`, and call the correct API for you.

### Catalogue Fetcher

```typescript
import { createCatalogueFetcher, catalogueFetcherGraphqlBuilder as b } from '@crystallize/js-api-client';

const fetchCatalogue = createCatalogueFetcher(api);

const data = await fetchCatalogue<{ catalogue: { name: string; path: string } }>({
    catalogue: {
        __args: { path: '/shop', language: 'en' },
        name: true,
        path: true,
        ...b.onProduct({}, { onVariant: { sku: true, name: true } }),
    },
});
```

### Navigation Fetcher

```typescript
import { createNavigationFetcher } from '@crystallize/js-api-client';

const nav = createNavigationFetcher(api);
const tree = await nav.byFolders('/', 'en', 3, /* extra root-level query */ undefined, (level) => {
    if (level === 1) return { shape: { identifier: true } };
    return {};
});
```

### Product Hydrater

Fetch product/variant data by paths or SKUs with optional price contexts.

```typescript
import { createProductHydrater } from '@crystallize/js-api-client';

const hydrater = createProductHydrater(api, {
    marketIdentifiers: ['eu'],
    priceList: 'b2b',
    priceForEveryone: true,
});

const products = await hydrater.bySkus(
    ['SKU-1', 'SKU-2'],
    'en',
    /* extraQuery */ undefined,
    (sku) => ({ vatType: { name: true, percent: true } }),
    () => ({ priceVariants: { identifier: true, price: true } }),
);
```

### Order Fetcher

```typescript
import { createOrderFetcher } from '@crystallize/js-api-client';

const orders = createOrderFetcher(api);
const order = await orders.byId('order-id', {
    onOrder: { payment: { provider: true } },
    onOrderItem: { subscription: { status: true } },
    onCustomer: { email: true },
});

const list = await orders.byCustomerIdentifier('customer-123', { first: 20 });
```

Typed example (TypeScript generics):

```typescript
type OrderExtras = { payment: { provider: string }[] };
type OrderItemExtras = { subscription?: { status?: string } };
type CustomerExtras = { email?: string };

const typedOrder = await orders.byId<OrderExtras, OrderItemExtras, CustomerExtras>('order-id', {
    onOrder: { payment: { provider: true } },
    onOrderItem: { subscription: { status: true } },
    onCustomer: { email: true },
});

typedOrder.payment; // typed as array with provider
typedOrder.cart[0].subscription?.status; // typed
typedOrder.customer.email; // typed
```

### Order Manager

Create/update orders, set payments or move to pipeline stage. Inputs are validated against `@crystallize/schema`.

```typescript
import { createOrderManager } from '@crystallize/js-api-client';

const om = createOrderManager(api);

// Register (minimal example)
const confirmation = await om.register({
    cart: [{ sku: 'SKU-1', name: 'Product', quantity: 1, price: { gross: 100, net: 80, currency: 'USD' } }],
    customer: { identifier: 'customer-123' },
});

// Update payments only
await om.setPayments('order-id', [
    {
        provider: 'STRIPE',
        amount: { gross: 100, net: 80, currency: 'USD' },
        method: 'card',
    },
]);

// Put in pipeline stage
await om.putInPipelineStage({ id: 'order-id', pipelineId: 'pipeline', stageId: 'stage' });
```

### Customer and Customer Group Managers

```typescript
import { createCustomerManager, createCustomerGroupManager } from '@crystallize/js-api-client';

const customers = createCustomerManager(api);
await customers.create({ identifier: 'cust-1', email: 'john@doe.com' });
await customers.update({ identifier: 'cust-1', firstName: 'John' });

const groups = createCustomerGroupManager(api);
await groups.create({ identifier: 'vip', name: 'VIP' });
```

### Subscription Contract Manager

Create/update contracts and generate a pre-filled template from a variant.

```typescript
import { createSubscriptionContractManager } from '@crystallize/js-api-client';

const scm = createSubscriptionContractManager(api);

const template = await scm.createTemplateBasedOnVariantIdentity(
    '/shop/my-product',
    'SKU-1',
    'plan-identifier',
    'period-id',
    'default',
    'en',
);

// …tweak template and create
const created = await scm.create({
    customerIdentifier: 'customer-123',
    tenantId: 'tenant-id',
    payment: {
        /* … */
    },
    ...template,
});
```

### Cart Manager (Shop API)

Token handling is automatic (unless you pass `shopApiToken` and set `shopApiToken.doNotFetch: true`).

```typescript
import { createCartManager } from '@crystallize/js-api-client';

const cart = createCartManager(api);

// Hydrate a cart from input
const hydrated = await cart.hydrate({
    language: 'en',
    items: [{ sku: 'SKU-1', quantity: 1 }],
});

// Add/remove items, abandon or place and fulfill the cart and assign the orderId
await cart.addSkuItem(hydrated.id, { sku: 'SKU-2', quantity: 2 });
await cart.setCustomer(hydrated.id, { identifier: 'customer-123', email: 'john@doe.com' });
await cart.setMeta(hydrated.id, { merge: true, meta: [{ key: 'source', value: 'web' }] });
await cart.abandon(hydrated.id);
await cart.place(hydrated.id);
await cart.fulfill(hydrated.id, orderId);
```

## Signature verification

Use `createSignatureVerifier` to validate Crystallize signatures for webhooks, apps or frontend calls. The verifier decodes the HS256 JWT envelope with the shared secret and matches its `hmac` claim against a SHA-256 of the reconstructed challenge — all through the bundled `jose` and the platform's `crypto.subtle`, so you don't need to pass your own JWT or hashing implementation.

```typescript
import { createSignatureVerifier } from '@crystallize/js-api-client';

const verify = createSignatureVerifier({ secret: process.env.CRYSTALLIZE_SIGNATURE_SECRET! });

// POST example
await verify(signatureJwtFromHeader, {
    url: request.url,
    method: 'POST',
    body: rawBodyString, // IMPORTANT: raw body
});

// GET webhook example (must pass the original webhook URL)
await verify(signatureJwtFromHeader, {
    url: request.url, // the received URL including query params
    method: 'GET',
    webhookUrl: 'https://example.com/api/webhook', // the configured webhook URL in Crystallize
});
```

## Plugin payload decryption

Use `createPluginPayloadDecrypter` to decrypt a Crystallize plugin JWE payload (outer JWE → nested JWS envelope → per-field `encryptedSecrets`) and optionally verify the inner JWS against a JWKS. This is the single entry point the CLI and any vendor-side integration should rely on.

The factory takes the vendor's private JWK (as produced by `crystallize plugin keygen`) and optional `verify` settings, and returns a reusable function that accepts a JWE compact payload per call. The private key and the JWKS resolver are built once and reused — so for a server handling many webhook calls, create the decrypter once at boot.

Only `RSA-OAEP` / `RSA-OAEP-256` with `A*GCM` content encryption are accepted on the outer JWE. When the outer header carries `cty: "JWT"`, the plaintext is treated as a compact JWS whose claims form the envelope.

Signature verification is opt-in: pass `verify` to enable it. When `verify` is omitted — or when verification fails — the envelope and per-field secrets are still returned so the caller can inspect them; `signature.verified` / `signature.skipped` / `signature.reason` tell you whether to trust the result.

```typescript
import { readFile } from 'node:fs/promises';
import { createPluginPayloadDecrypter } from '@crystallize/js-api-client';

const privateJwk = JSON.parse(await readFile('./private.jwk.json', 'utf8'));

// Decrypt only — no signature check. Good for local dev / smoke tests.
const decrypt = createPluginPayloadDecrypter({ privateJwk });
const decoded = await decrypt(jweCompact);

if (decoded.envelope) {
    console.log('tenant:', decoded.envelope.tenantIdentifier);
    console.log('config:', decoded.envelope.config);
    console.log('secrets:', decoded.secrets); // { StripeApiKey: 'sk_live_…', … }
}
```

Enable verification by passing `verify` with at least an `audience` (your plugin identifier). `issuer` defaults to `https://api.crystallize.com` and `jwksUrl` defaults to `${issuer}/.well-known/jwks.json`, so production usage is a one-liner:

```typescript
// Production — issuer + JWKS URL default to api.crystallize.com.
const decrypt = createPluginPayloadDecrypter({
    privateJwk,
    verify: { audience: 'com.vendor.plugin' },
});

const verified = await decrypt(jweCompact);
if (!verified.signature.verified) {
    // Signature check skipped or failed — envelope + secrets are still populated but MUST be treated as untrusted.
    console.warn('signature not trusted:', verified.signature.reason);
}
```

Other `verify` fields: `clockTolerance` (seconds, defaults to `30`), `verifyBackendToken` (also verify `envelope.backendToken` against the same JWKS, defaults to `false`).

The returned `DecryptedPluginPayload` contains:

- `protectedHeader` — outer JWE protected header
- `innerProtectedHeader` — inner JWS protected header, when the payload is nested
- `envelope` — verified (or decoded) JWS claims, or `null` for a non-nested payload
- `plaintext` — raw outer plaintext when the payload is not a nested JWT, otherwise `null`
- `secrets` — plain-text per-field secrets decrypted from `envelope.encryptedSecrets`
- `signature` — `{ verified, skipped?, reason?, issuer?, audience?, algorithm? }`
- `backendToken` — `{ verified, skipped?, reason?, claims? }` when `envelope.backendToken` is present, otherwise `null`

> Security: `secrets` and decoded `envelope` claims contain cleartext credentials. Do not log or forward them to shared sinks.

## Pricing utilities

```typescript
import { pricesForUsageOnTier } from '@crystallize/js-api-client';

const usage = 1200;
const total = pricesForUsageOnTier(
    usage,
    [
        { threshold: 0, price: 0, currency: 'USD' },
        { threshold: 1000, price: 0.02, currency: 'USD' },
    ],
    'graduated',
);
```

## Binary file manager

Upload files (like images) to your tenant via pre-signed requests. Server-side only.

```typescript
import { createBinaryFileManager } from '@crystallize/js-api-client';

const files = createBinaryFileManager(api);
const mediaKey = await files.uploadImage('/absolute/path/to/picture.jpg');
const staticKey = await files.uploadFile('/absolute/path/to/static/file.pdf');
const bulkKey = await files.uploadMassOperationFile('/absolute/path/to/import.zip');
// Use the returned keys in subsequent PIM mutations
```

`uploadImage` validates that the file is an image before creating a `MEDIA` upload. Use `uploadFile` for assets that should live in the tenant's static file storage, and `uploadMassOperationFile` for imports handled by the mass operations pipeline. Call `uploadToTenant` directly if you need lower-level control (e.g., custom buffers or upload types).

[crystallizeobject]: crystallize_marketing|folder|625619f6615e162541535959

## Mass Call Client (Deprecated)

> **Deprecated:** Use mature ecosystem packages like [`p-limit`](https://www.npmjs.com/package/p-limit) or [`p-queue`](https://www.npmjs.com/package/p-queue) instead. They provide better error handling, TypeScript support, and are actively maintained.

### Recommended alternative using p-limit

```typescript
import pLimit from 'p-limit';
import { createClient } from '@crystallize/js-api-client';

const api = createClient({ tenantIdentifier: 'my-tenant', accessTokenId: '…', accessTokenSecret: '…' });
const limit = pLimit(5); // max 5 concurrent requests

const mutations = items.map((item) =>
    limit(() =>
        api.pimApi(
            `mutation UpdateItem($id: ID!, $name: String!) { product { update(id: $id, input: { name: $name }) { id } } }`,
            { id: item.id, name: item.name },
        ),
    ),
);

const results = await Promise.allSettled(mutations);
const failed = results.filter((r) => r.status === 'rejected');
console.log(`Done: ${results.length - failed.length} succeeded, ${failed.length} failed`);
```

### Legacy usage

The mass call client is still functional but will emit a deprecation warning on first use.

Sometimes, when you have many calls to do, whether they are queries or mutations, you want to be able to manage them asynchronously. This is the purpose of the Mass Call Client. It will let you be asynchronous, managing the heavy lifting of lifecycle, retry, incremental increase or decrease of the pace, etc.

These are the main features:

- Run *initialSpawn* requests asynchronously in a batch. *initialSpawn* is the size of the batch by default
- If there are more than 50% errors in the batch, it saves the errors and continues with a batch size of 1
- If there are less than 50% errors in the batch, it saves the errors and continues with the current batch size minus 1
- If there are no errors, it increments (+1) the number of requests in a batch, capped to *maxSpawn*
- If the error rate is 100%, it waits based on **Fibonacci** increment
- At the end of all batches, you can retry the failed requests
- Optional lifecycle function *onBatchDone* (async)
- Optional lifecycle function *onFailure* (sync) allowing you to do something and decide to let enqueue (return true: default) or return false and re-execute right away, or any other actions
- Optional lifecycle function *beforeRequest* (sync) to execute before each request. You can return an altered request/promise
- Optional lifecycle function *afterRequest* (sync) to execute after each request. You also get the result in there, if needed

```javascript
const client = createMassCallClient(api, { initialSpawn: 1 });

async function run() {
    for (let i = 1; i <= 54; i++) {
        client.enqueue.catalogueApi(`query { catalogue { id, key${i}: name } }`);
    }

    const successes = await client.execute();
    console.log('First pass done ', successes);
    console.log('Failed Count: ' + client.failureCount());
    while (client.hasFailed()) {
        console.log('Retrying...');
        const newSuccesses = await client.retry();
        console.log('Retry pass done ', newSuccesses);
    }
    console.log('ALL DONE!');
}
run();
```
