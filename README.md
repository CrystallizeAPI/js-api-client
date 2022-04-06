# Crystallize API Client

---

This repository is what we call a "subtree split": a read-only copy of one directory of the main repository.

If you want to report or contribute, you should do it on the main repository: https://github.com/CrystallizeAPI/libraries

---

## Description

This lib provides simplifications / helpers to easily fetch data from your tenant.

-   [Order Payment Updater](#Order-Payment-Updater)
-   [Order Pusher](#Order-Pusher)
-   [Product Hydrater](#Product-Hydrater)
-   [Navigation Fetcher](#Navigation-Tree-or-Topic-Fetcher)
-   [Simple Client](#Client)

Check the live demo: https://crystallizeapi.github.io/libraries/

## Order Payment Updater

You can use the `CrystallizeCreateOrderPaymentUpdater` to update an order with payment information in Crystallize, this helper will validate the payment and throw exception if the input is incorrect.

Also all the Types (and Zod JS type) are exported so you can work efficiently.)

## Order Pusher

You can use the `CrystallizeOrderPusher` to push an order to Crystallize, this helper will validate the order and throw exception if the input is incorrect.

Also all the Types (and Zod JS type) are exported so you can work efficiently.)

## Navigation (Tree or Topic) Fetcher

> Note: This helper uses `children` property and is therefore not paginate. You have to take this into account.

In Crystallize your Items or Topics are organized like a tree, a graph, it's hierarchical.
It's very common that you will want to build the navigation of your website following the Content Tree or the Topic Tree.

These fetchers do the heaving lifting for you.

```javascript
const response = await CrystallizeNavigationFoldersFetcher('/', 'en', 3);
```

> Note `CrystallizeNavigationTopicsFetcher` works exactly the same but for topics. [Examples for Topics](./tests/naigationTopics.test.js), [Examples for Items](./tests/naigationTree.test.js)

This will trigger the following query:

```graqhql
      query ($language: String!, $path: String!) {
          tree: catalogue (language: $language, path: $path) {
              name
              path
              children {
                  name
                  path
                  children {
                      name
                      path
                  }
              }
          }
      }
```

You might want more customizations, here is the function signatures

```typescript
function fetch(path:string, language:string, depth:number, extraQuery: any, (level:number) => any);
```

## Product Hydrater

Usually in the context of the Cart you might want to keep the SKUs and/or the paths locally and ask Crystallize to hydrate the data.

There is an help for that! Function signatures are:

```typescript
function CrystallizeHydraterByPaths|CrystallizeHydraterBySkus(items:string[], language:string, extraQuery: any, perProduct: (item: string, index: number) => any, perVariant: (item: string, index: number) => any);
```

> It returns an array of products based on the strings in arguments (paths or skus)

## Client

This is a simple client to communicate with Crystallize API.

You can get:

-   catalogueApi
-   searchApi
-   orderApi
-   subscriptionApi
-   pimApi

You can create your own client to provide a specific `configuration`

```javascript
import { createClient } from '@crystallize/js-api-client';

export const CrystallizeClient = createClient({
    tenantIdentifier: 'furniture'
});
```

## Usage

```javascript
import { CrystallizeClient } from '@crystallize/js-api-client';

export async function fetchSomething(): Promise<Something[]> {
    const caller = CrystallizeClient.catalogueApi;
    const response = await caller(graphQLQuery, variables);
    return response.catalogue;
}
```
