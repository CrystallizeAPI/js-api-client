# Crystallize API Client

---

This repository is what we call a "subtree split": a read-only copy of one directory of the main repository.

If you want to report or contribute, you should do it on the main repository: https://github.com/CrystallizeAPI/libraries

---

## Description

This lib provides simplifications / helpers to easily fetch data from your tenant.

-   [Navigation Tree Fetcher](#Navigation-Tree-Fetcher)
-   [Simple Client](#Client)

## Navigation (Tree or Topic) Fetcher

> Note: This helper uses `children` property and is therefore not paginate. You have to take this into account.

In Crystallize your Items or Topics are organized like a tree, a graph, it's hierarchical.
It's very common that you will want to build the navigation of your website following the Content Tree or the Topic Tree.

These fetchers do the heaving lifting for you.

```javascript
const fetch = createNavigationTreeFetcher(CrystallizeClient);
const response = await fetch('/', 'en', 3);
```

> Note `createNavigationTopicsFetcher` works exactly the same but for topics. [Examples for Topics](./tests/naigationTopic.test.js), [Examples for Items](./tests/naigationTree.test.js)

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

You might want more, so you can pass a first parameter like this:

```javascript
const fetch = createNavigationTreeFetcher(CrystallizeClient);
const response = await fetch('/', 'en', 2, {
    tenant: {
        __args: {
            language: 'en'
        },
        name: true
    }
});
```

This will trigger the following query:

```graphql
query ($language: String!, $path: String!) {
    tree: catalogue(language: $language, path: $path) {
        name
        path
        children {
            name
            path
        }
    }
    tenant(language: "en") {
        name
    }
}
```

> This is using the wonderful https://www.npmjs.com/package/json-to-graphql-query

You can also customize what you want in each level:

```javascript
const fetch = createNavigationTreeFetcher(CrystallizeClient);
const response = await fetch(
    '/',
    'en',
    3,
    {
        tenant: {
            __args: {
                language: 'en'
            },
            name: true
        }
    },
    (level) => {
        switch (level) {
            case 0:
                return {
                    shape: {
                        identifier: true
                    }
                };
            case 1:
                return {
                    createdAt: true
                };
            default:
                return {};
        }
    }
);
```

would result:

```graphql
query ($language: String!, $path: String!) {
    tree: catalogue(language: $language, path: $path) {
        name
        path
        shape {
            name
        }
        children {
            name
            path
            createdAt
            children {
                name
                path
            }
        }
    }
    tenant(language: "en") {
        name
    }
}
```

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
