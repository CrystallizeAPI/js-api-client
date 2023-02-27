# JS API Client

This library provides simplifications and helpers to easily fetch data from your tenant.

## Description

So far, the available helpers are:

-   Client to query or mutate data from Crystallize
-   Mass Call Client that relies on the Client for mass operations
-   Catalogue Fetcher
-   Searcher
-   Order Payment Updater
-   Order Pusher
-   Product Hydrater
    -   Paths
    -   Skus
-   Navigation Fetcher
-   Topics
-   Folders
-   CustomerManager
-   Subscription Contract Manager
-   Signature Verification
-   Profiling the requests

## Installation

With NPM:

```bash
npm install @crystallize/js-api-client
```

With Yarn:

```bash
yarn add @crystallize/js-api-client
```

## Simple Client

This is a simple client to communicate with the Crystallize APIs.

You get access to different helpers for each API:

-   catalogueApi
-   searchApi
-   orderApi
-   subscriptionApi
-   pimApi

First, you need to create the _Client_:

```javascript
import { createClient } from '@crystallize/js-api-client';

export const CrystallizeClient = createClient({
    tenantIdentifier: 'furniture',
});
```

Then you can use it:

```typescript
export async function fetchSomething(): Promise<Something[]> {
    const caller = CrystallizeClient.catalogueApi;
    const response = await caller(graphQLQuery, variables);
    return response.catalogue;
}
```

There is a live demo: https://crystallizeapi.github.io/libraries/js-api-client/call-api

## Catalogue Fetcher

You can pass objects that respect the logic of https://www.npmjs.com/package/json-to-graphql-query to the Client.

And because we can use plain simple objects, it means we can provide you a query builder.

The goal is to help you build queries that are more than “strings”:

```javascript
const builder = catalogueFetcherGraphqlBuilder;
await CrystallizeCatalogueFetcher(query, variables);
```

Example Query 1:

```javascript
{
    catalogue: {
        children: {
            __on: [
                builder.onItem({
                    ...builder.onComponent('test', 'RichText', {
                        json: true,
                    }),
                }),
                builder.onProduct({
                    defaultVariant: {
                        firstImage: {
                            url: true,
                        },
                    },
                }),
                builder.onDocument(),
                builder.onFolder(),
            ],
        },
    },
}
```

Example Query 2:

```javascript
{
    catalogue: {
        ...builder.onComponent('grid', 'GridRelations', {
            grids: {
                rows: {
                    columns: {
                        layout: {
                            rowspan: true,
                            colspan: true,
                        },
                        item: {
                            __on: [
                                builder.onProduct(
                                    {
                                        name: true,
                                    },
                                    {
                                        onVariant: {
                                            images: {
                                                url: true,
                                            },
                                            price: true,
                                        },
                                    },
                                ),
                            ],
                        },
                    },
                },
            },
        }),
    },
}
```

The best way to learn how use the Fetcher is to [check the builder itself](https://github.com/CrystallizeAPI/libraries/blob/main/components/js-api-client/src/core/catalogue.ts#L20).

## Navigation Fetcher

In Crystallize, your Items or Topics are organized like a tree or graph, i.e. hierarchically. It's very common that you will want to build the navigation of your website following the Content Tree or the Topic Tree.

These fetchers do the heavy lifting for you. Behind the scenes, they will build a recursive GraphQL query for you.

There are 2 helpers for it that you get via createNavigationFetcher. You get an object with `byFolders` or `byTopics` that are functions. The function signatures are:

```typescript
function fetch(path:string, language:string, depth:number, extraQuery: any, (level:number) => any);
```

Note: These helpers use the children property and are therefore not paginated. You have to take this into account.

Example of Usage:

```javascript
const response = await CrystallizeNavigationFetcher('/', 'en', 3).byFolders;
const response = await CrystallizeNavigationFetcher('/', 'en', 2).byTopics;
```

### To go even further

You might want to return more information from that function by extending the GraphQL query that is generated for you. You can do that thanks to the last parameters.

Those last parameters MUST return an object that respects the logic of https://www.npmjs.com/package/json-to-graphql-query

Example:

```javascript
const fetch = createNavigationFetcher(CrystallizeClient).byFolders;
const response = await fetch(
    '/',
    'en',
    3,
    {
        tenant: {
            __args: {
                language: 'en',
            },
            name: true,
        },
    },
    (level) => {
        switch (level) {
            case 0:
                return {
                    shape: {
                        identifier: true,
                    },
                };
            case 1:
                return {
                    createdAt: true,
                };
            default:
                return {};
        }
    },
);
```

Here you will get not only the navigation but also the tenant name, the shape identifier for items of _depth=1_, and the creation date for items of _depth=2_.

## Product Hydrater

Usually in the context of the Cart/Basket, you might want to keep the SKUs and/or the paths of the Variants in the basket locally and ask Crystallize to hydrate the data at some point.

There are 2 helpers that you get via _createProductHydrater_. You get an object with `byPaths` or `bySkus` that are functions. The function signatures are:

```typescript
function hydrater(
    items: string[],
    language: string,
    extraQuery: any,
    perProduct: (item: string, index: number) => any,
    perVariant: (item: string, index: number) => any,
);
```

When called, both return an array of products based on the strings in the arguments (paths or SKUs) you provided.

Note: when you hydrate by SKU, the helper fetches the paths from the Search API.

There is a live demo for both:

-   https://crystallizeapi.github.io/libraries/js-api-client/hydrater/by/paths
-   https://crystallizeapi.github.io/libraries/js-api-client/hydrater/by/skus

### To go even further

You might want to return more information from that function by extending the GraphQL query that is generated for you. You can do that thanks to the last parameters.

Those last parameters MUST return an object that respects the logic of https://www.npmjs.com/package/json-to-graphql-query

Example:

```javascript
const CrystallizeClient = createClient({
    tenantIdentifier: 'furniture',
});
const hydrater = createProductHydrater(CrystallizeClient).byPaths;
const response = await hydrater(
    [
        '/shop/bathroom-fitting/large-mounted-cabinet-in-treated-wood',
        '/shop/bathroom-fitting/mounted-bathroom-counter-with-shelf',
    ],
    'en',
    {
        tenant: {
            id: true,
        },
        perVariant: {
            id: true,
        },
        perProduct: {
            firstImage: {
                variants: {
                    url: true,
                },
            },
        },
    },
);
```

With this code, you get the _Products_, the current tenant id, the _id_ for each Variant, and for each product the URL of the first transcoded product Image.

## Order Fetcher

It is also very common to fetch an Order from Crystallize. It usually requires [authentication](https://crystallize.com/learn/developer-guides/api-overview/authentication), and this helper is probably more suitable for your Service API. This fetcher does the heavy lifting to simplify fetching orders.

There are 2 helpers that you get via _createOrderFetcher_. You get an object with `byId` or `byCustomerIdentifier` that are functions.

-   **byId**: takes an _orderId_ in argument and fetches the related Order for you.
-   **byCustomerIdentifier**: takes a _customerIdentifier_ and fetches all the Orders (with pagination) of that customer.

Function signatures respectively are:

```typescript
function byId(orderId: string, onCustomer?: any, onOrderItem?: any, extraQuery?: any);
function byId(customerIdentifier: string, extraQueryArgs?: any, onCustomer?: any, onOrderItem?: any, extraQuery?: any);
```

### To go even further

You might want to return more information from that function by extending the GraphQL query that is generated for you. You can do that thanks to the last parameters.

## Order Pusher

You can use the *CrystallizeOrderPusher* to push an order to Crystallize. This helper will validate the order and throw an exception if the input is incorrect. Also, all the Types (and the Zod JS types) are exported so you can work more efficiently.

```javascript
const caller = CrystallizeOrderPusher;
await caller({
    customer: {
        firstName: 'William',
        lastName: 'Wallace',
    },
    cart: [
        {
            sku: '123',
            name: 'Bamboo Chair',
            quantity: 3,
        },
    ],
});
```

This is the minimum to create an Order. Of course, the Order can be much more complex.

## Order Payment Updater

You can use the *CrystallizeCreateOrderPaymentUpdater* to update an order with payment information in Crystallize. This helper will validate the payment and throw an exception if the input is incorrect. And all the Types (and Zod JS types) are exported so you can work more efficiently.

```javascript
const caller = CrystallizeCreateOrderPaymentUpdater;
const result = await caller('xXxYyYZzZ', {
    payment: [
        {
            provider: 'custom',
            custom: {
                properties: [
                    {
                        property: 'payment_method',
                        value: 'Crystal Coin',
                    },
                    {
                        property: 'amount',
                        value: '112358',
                    },
                ],
            },
        },
    ],
});
```

## Searcher

You can use the *CrystallizeSearcher* to search through the Search API in a more sophisticated way.

The JS API Client exposes a type _CatalogueSearchFilter_ and a type _catalogueSearchOrderBy_ that you can use in combination with other parameters to experience a better search.

The _search_ function is a generator that allows you to seamlessly loop into the results while the lib is taking care of pagination.

```javascript
const CrystallizeClient = createClient({
    tenantIdentifier: 'furniture',
});

//note: you can use the catalogueFetcherGraphqlBuilder
const nodeQuery = {
    name: true,
    path: true,
};
const filter = {
    type: 'PRODUCT',
};
const orderBy = undefined;
const pageInfo = {
    /* customize here if needed */
};

for await (const item of createSearcher(CrystallizeClient).search('en', nodeQuery, filter, orderBy, pageInfo, {
    total: 15,
    perPage: 5,
})) {
    console.log(item); // what you have passed to nodeQuery
}
```

## Customer Manager

This manages the creation and updating of Customers in Crystallize.

This is just a simple wrapper using a Schema to validate the input before calling the API for you.

Example of creation:

```javascript
const intent: CreateCustomerInputRequest = valideCustomerObject;
await CrystallizeCustomerManager.create({
    ...intent,
    meta: [
        {
            key: 'type',
            value: 'particle',
        },
    ],
});
```

Example of update:

```javascript
const intent: UpdateCustomerInputRequest = {
    ...rest,
    meta: [
        {
            key: 'type',
            value: 'crystal',
        },
    ],
};
await CrystallizeCustomerManager.update(identifier, intent);
```

## Subscription Contract Manager

The Crystallize Subscription system is really powerful. The [documentation](https://crystallize.com/learn/concepts/subscription) is clear, so you know that to create a Subscription Contract based on a Product Variant that has a Plan, you need:

-   the **Product**: what are we buying
-   the **ProductVariant**: the real thing we are actually buying
-   the **Subscription Plan**: it may exist different kind of Plan on a Variant. Plans include the Metered Variables, etc.
-   the **Period**: Monthly? Yearly?
-   the **PriceVariantIdentifier**: USD? EUR?
-   the **language** as Crystallize is fully multilingual.

That’s the information you can retrieve from the Catalogue, the information that your buyer would put in his/her cart.

When the time comes, you will need to create a Subscription Contract.

From the documentation:

```
Creating Subscription Contracts
Once you’ve got a valid customer, created a subscription plan, and added the subscription plan to a product variant as needed, you’re ready to create a subscription contract. You can design the flow that you want, but usually, it’d be very close to what you would do on paper. First, you create a contract with your customer (subscription contract) that sets up the rules (price, metered variables, etc.), including the payment information (payment field) and the different subscription periods (initial and recurring). After the contract is created comes the payment, prepaid or paid after. Finally, there will be an order in Crystallize with the subscription contract ID and a subscription OrderItem to describe what this charge is for.
```

The same way you can create an Order with your own price (discounts, B2B pricing etc.), the Subscription Contract can have specific prices that are completely customized to the buyer.

Wouldn’t it be nice to get a Subscription Contract Template (based on buyer decision) that you could just tweak?

That’s one of the methods of the Subscription Contract Manager:

```javascript
CrystallizeSubscriptionContractManager.createSubscriptionContractTemplateBasedOnVariantIdentity(
    productPath,
    { sku: variantSku },
    planIdentifier,
    periodId,
    priceVariantIdentifier,
    'en',
);
```

This will return a Subscription Contract that you can alter in order to save it to Crystallize:

```javascript
const data = await CrystallizeSubscriptionContractManager.create({
    ...tweakedContract,
    customerIdentifier: customerIdentifier,
    item: productItem,
    // custom stuff
});
```

An Update method exists as well:

```javascript
await CrystallizeSubscriptionContractManager.update(contractId, cleanUpdateContract);
```

## Signature Verification

The full documentation is here https://crystallize.com/learn/developer-guides/api-overview/signature-verification
This library makes it simple, assuming:

-   you have your `CRYSTALLIZE_SIGNATURE_SECRET` from the environment variable
-   you retrieve the Signature from the Header in `signatureJwt`

you can use the `createSignatureVerifier`

```javascript
const guard = createSignatureVerifier({
    secret: `${process.env.CRYSTALLIZE_SIGNATURE_SECRET}`,
    sha256: (data: string) => crypto.createHash('sha256').update(data).digest('hex'),
    jwtVerify: (token: string, secret: string) => jwt.verify(token, secret) as CrystallizeSignature,
});

guard(signatureJwt, {
    url: request.url, // full URL here, including https://  etc. request.href in some framework
    method: 'POST',
    body: 'THE RAW JSON BODY', // the library parse it for you cf. doc
});
```

If the signature is not valid:

-   JWT signature is not verified
-   HMAC is invalid (man in the middle)

The guard function will trigger an exception.

> We let you provide the `sha256` and `jwtVerify` methods to stay agnostic of any library.

## Profiling the request

There is time when you want to log and see the raw queries sent to Crystallize and also the timings.

```javascript
const apiClient = createClient(
    {
        tenantIdentifier: 'furniture',
    },
    {
        profiling: {
            onRequest: (query, variables) => {
                // do something with it
                console.log(query, variables);
            },
            onRequestResolved: ({ resolutionTimeMs, serverTimeMs }, query, variables) => {
                // do something with it
                console.log(processingTimeMs, query, variables);
            },
        },
    },
);
```

The queries that you get passed on those functions are strings. Computed query from JS Object used by Fetcher, Hydrater and so on.
It's really handy for debugging and development.

## Mass Call Client

Sometimes, when you have many calls to do, whether they are queries or mutations, you want to be able to manage them asynchronously. This is the purpose of the Mass Call Client. It will let you be asynchronous, managing the heavy lifting of lifecycle, retry, incremental increase or decrease of the pace, etc.

These are the main features:

-   Run *initialSpawn* requests asynchronously in a batch. *initialSpawn* is the size of the batch per default
-   If there are more than 50% errors in the batch, it saves the errors and continues with a batch size of 1
-   If there are less than 50% errors in the batch, it saves the errors and continues with a batch size of [batch size - 1]
-   If there are no errors, it increments (+1) the number of requests in a batch, capped to *maxSpawn*
-   If the error rate is 100%, it waits based on **Fibonnaci** increment
-   At the end of all batches, you can retry the failed requests
-   Optional lifecycle function *onBatchDone* (async)
-   Optional lifecycle function *onFailure* (sync) allowing you to do something and decide to let enqueue (return true: default) or return false and re-execute right away, or any other actions
-   Optional lifecycle function *beforeRequest* (sync) to execute before each request. You can return an altered request/promise
-   Optional lifecycle function *afterRequest* (sync) to execute after each request. You also get the result in there, if needed

```javascript
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

A full example is here: https://github.com/CrystallizeAPI/libraries/blob/main/components/js-api-client/src/examples/dump-tenant.ts

[crystallizeobject]: crystallize_marketing|folder|625619f6615e162541535959
