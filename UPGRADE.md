# Upgrade Guide to v5

This guide helps you migrate from v4 to v5 of `@crystallize/js-api-client`.

v5 focuses on:

- A single client with clearly separated callers: catalogue, discovery, PIM, next PIM, and Shop Cart
- High-level managers for Orders, Customers, Subscriptions, and Cart
- Stronger types via `@crystallize/schema`
- Removed deprecations

If you are starting fresh, see the README. If you are upgrading, follow the mapping below.

## At a glance: changes

- No more pre-exported singletons. Always `createClient({ tenantIdentifier, … })` in your app.
- `searchApi` was deprecated; use `discoveryApi` now.
- `orderApi` and `subscriptionApi` → use `nextPimApi` or dedicated managers.
- `createAsyncSignatureVerifier` → `createSignatureVerifier`
- Inputs accept ISO date strings (not Date objects)
- Product Hydrater: removed `useSyncApiForSKUs`
- Orders helpers consolidated into `createOrderManager`
- `handleImageUpload` removed → use `createBinaryFileManager`
- New `createCartManager` wraps cart operations
- Public JS API Client types are removed in favor of `@crystallize/schema`

## High-level helpers: before/after

### Orders

Before (v4): separate pusher/payment/pipeline utilities

```ts
// register order
await CrystallizeOrderPusher({
    /* … */
});

// update payments
await CrystallizeCreateOrderPaymentUpdater('order-id', {
    payment: [
        /* … */
    ],
});

// move stage
await CrystallizeCreateOrderPipelineStageSetter('order-id', 'pipeline-id', 'stage-id');
```

After (v5): one manager

```ts
import { createOrderManager } from '@crystallize/js-api-client';
const om = createOrderManager(api);

await om.register({
    /* RegisterOrderInput (ISO dates) */
});
await om.setPayments('order-id', [{ provider: 'STRIPE' /* … */ }]);
await om.putInPipelineStage({ id: 'order-id', pipelineId: 'pipeline-id', stageId: 'stage-id' });
await om.update({ id: 'order-id' /* rest of UpdateOrderInput */ });
```

Types are validated using `@crystallize/schema/pim`.

### Search → Discovery

Before (v4):

```ts
const res = await api.searchApi(`{ search { /* … */ } }`);
```

After (v5):

```ts
const res = await api.discoveryApi(`{ /* discovery query */ }`);
```

The Discovery schema differs from the old Search API. Update root fields accordingly.

### nextPimApi error handling

To have `@crystallize/js-api-client` throw the new `JSApiClientCallError` on business errors coming from the Next PIM API, make sure your GraphQL operations explicitly select the `BasicError` fields on error-union types. Without these fields, the client cannot surface structured errors.

Add this inline fragment wherever the schema returns an error union:

```graphql
... on BasicError {
    errorName
    message
}
```

Example (mutation shape simplified):

```graphql
mutation CreateThing($input: CreateThingInput!) {
    createThing(input: $input) {
        ... on CreateThingResult {
            id
        }
        ... on BasicError {
            errorName
            message
        }
    }
}
```

With the `BasicError` fields present, the client detects the error payload and throws `JSApiClientCallError` containing `errorName` and `message`.

### Subscriptions

Before (v4): direct `subscriptionApi` calls and ad-hoc helpers.

After (v5):

```ts
import { createSubscriptionContractManager } from '@crystallize/js-api-client';

const scm = createSubscriptionContractManager(api);
const template = await scm.createTemplateBasedOnVariantIdentity(
    '/path',
    'SKU',
    'plan',
    'periodId',
    'priceVariant',
    'en',
);
await scm.create({
    customerIdentifier: 'cust',
    tenantId: 'tenant',
    payment: {
        /* … */
    },
    ...template,
});
```

### Product Hydrater

- Removed option: `useSyncApiForSKUs`
- Added price contexts: `priceForEveryone`, `priceList`, `marketIdentifiers`

```ts
createProductHydrater(api, {
    priceForEveryone: true,
    priceList: 'b2b',
    marketIdentifiers: ['eu'],
});
```

### Cart operations

Before (v4): direct `shopCartApi` mutations sprinkled in code.

After (v5): use the manager, with automatic token handling.

```ts
import { createCartManager } from '@crystallize/js-api-client';
const cart = createCartManager(api);
const c = await cart.hydrate({ language: 'en', items: [{ sku: 'SKU', quantity: 1 }] });
await cart.addSkuItem(c.id, { sku: 'SKU-2', quantity: 1 });
await cart.place(c.id);
```

To fully control the token, pass `shopApiToken` in `createClient` and set `options.shopApiToken.doNotFetch = true`.

### Image upload

Before (v4): `handleImageUpload(path, client, tenantId)`

After (v5): `createBinaryFileManager(api)`

```ts
import { createBinaryFileManager } from '@crystallize/js-api-client';
const files = createBinaryFileManager(api);
const mediaKey = await files.uploadImage('/path/to/picture.jpg');
const staticKey = await files.uploadFile('/path/to/static/file.pdf');
const bulkKey = await files.uploadMassOperationFile('/path/to/import.json');
// Use the returned keys in subsequent PIM mutations
```

`uploadImage` enforces image uploads and targets the `MEDIA` storage bucket. `uploadFile` routes other assets to the static file storage, while `uploadMassOperationFile` prepares files for ingestion by the mass operations pipeline. Use `uploadToTenant` if you need to provide your own buffer or specify the upload type manually.

### Signature verification

Before (v4): `createAsyncSignatureVerifier` (and an older sync variant)

After (v5): `createSignatureVerifier` (async only)

```ts
const verify = createSignatureVerifier({ sha256: async () => '…', jwtVerify: async () => ({}) as any, secret });
await verify(signatureJwt, { url, method: 'POST', body: rawBody });
```

If you handle GET webhooks, also pass `webhookUrl` so the HMAC can be validated from query params.

## Input and date handling

- Replace any `Date` objects in inputs by ISO strings (e.g., `new Date().toISOString()`).
- All inputs are validated using zod schemas re-exported by `@crystallize/schema`. An invalid object will throw a validation error before calling the API.

## Type changes

- Public types previously exported from `@crystallize/js-api-client` are removed in favor of `@crystallize/schema`.
- Import from `@crystallize/schema/catalogue`, `/pim`, or `/shop` as appropriate.

## Examples

See [README](README.md) for updated usage examples across all helpers.
