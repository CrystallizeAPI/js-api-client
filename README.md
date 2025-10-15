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

- One client with callers: `catalogueApi`, `discoveryApi`, `pimApi`, `nextPimApi`, `shopCartApi`
- High-level helpers: `createCatalogueFetcher`, `createNavigationFetcher`, `createProductHydrater`, `createOrderFetcher`, `createOrderManager`, `createCustomerManager`, `createCustomerGroupManager`, `createSubscriptionContractManager`, `createCartManager`
- Utilities: `createSignatureVerifier`, `createBinaryFileManager`, `pricesForUsageOnTier`, request `profiling`
- Build GraphQL with objects using `json-to-graphql-query` (see section below)
- Strong typing via `@crystallize/schema` inputs and outputs
- Upgrading? See [UPGRADE.md](UPGRADE.md) for v4 → v5 migration

## Options and environment

`createClient(configuration, options?)`

- configuration
    - `tenantIdentifier` (required)
    - `tenantId` optional
    - `accessTokenId` / `accessTokenSecret` or `sessionId`
    - `staticAuthToken` for read-only catalogue/discovery
    - `shopApiToken` optional; otherwise auto-fetched
    - `shopApiStaging` to use the staging Shop API
    - `origin` custom host suffix (defaults to `.crystallize.com`)
- options
    - `useHttp2` enable HTTP/2 transport
    - `profiling` callbacks
    - `extraHeaders` extra request headers for all calls
    - `shopApiToken` controls auto-fetch: `{ doNotFetch?: boolean; scopes?: string[]; expiresIn?: number }`

`client.close()` should be called when you enable HTTP/2 to gracefully close the underlying session.

### Available API callers

- `catalogueApi` – Catalogue GraphQL
- `discoveryApi` – Discovery GraphQL (replaces the old Search API)
- `pimApi` – PIM GraphQL (classic /graphql soon legacy)
- `nextPimApi` – PIM Next GraphQL (scoped to tenant)
- `shopCartApi` – Shop Cart GraphQL (token handled for you)

All callers share the same signature: `<T>(query: string, variables?: Record<string, unknown>) => Promise<T>`.

### Authentication overview

Pass the relevant credentials to `createClient`:

- `staticAuthToken` for catalogue/discovery read-only
- `accessTokenId` + `accessTokenSecret` (or `sessionId`) for PIM/Shop operations
- `shopApiToken` optional; if omitted, a token will be fetched using your PIM credentials on first cart call

See the official docs for auth: https://crystallize.com/learn/developer-guides/api-overview/authentication

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

// Add/remove items and place the order
await cart.addSkuItem(hydrated.id, { sku: 'SKU-2', quantity: 2 });
await cart.setCustomer(hydrated.id, { identifier: 'customer-123', email: 'john@doe.com' });
await cart.setMeta(hydrated.id, { merge: true, meta: [{ key: 'source', value: 'web' }] });
await cart.place(hydrated.id);
```

## Signature verification (async)

Use `createSignatureVerifier` to validate Crystallize signatures for webhooks or frontend calls. Provide your own `jwtVerify` and `sha256` implementations.

```typescript
import jwt from 'jsonwebtoken';
import { createHmac } from 'crypto';
import { createSignatureVerifier } from '@crystallize/js-api-client';

const secret = process.env.CRYSTALLIZE_SIGNATURE_SECRET!;
const verify = createSignatureVerifier({
    secret,
    jwtVerify: async (token, s) => jwt.verify(token, s) as any,
    sha256: async (data) => createHmac('sha256', secret).update(data).digest('hex'),
});

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

## Mass Call Client

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
// import { createMassCallClient } from '@crystallize/js-api-client';
const client = createMassCallClient(api, { initialSpawn: 1 }); // api created via createClient(...)

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

Full example: https://github.com/CrystallizeAPI/libraries/blob/main/components/js-api-client/src/examples/dump-tenant.ts
