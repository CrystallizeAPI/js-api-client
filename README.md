# Crystallize API Client

---

This repository is what we call a "subtree split": a read-only copy of one directory of the main repository.

If you want to report or contribute, you should do it on the main repository: https://github.com/CrystallizeAPI/libraries

---

## Description

This is a simple client to communicate with Crystallize API.

It exposes a `CrystallizeClient` on which you can get:

-   catalogueApi
-   searchApi
-   orderApi
-   subscriptionApi
-   pimApi

You can setup the credentials via `.configuration`

```javascript
CrystallizeClient.configuration = {
    tenantIdentifier: 'furniture'
};
```

## Usage

```javascript
import { CrystallizeClient } from '@crystallize/js-api-client';

export async function fetchSomething(): Promise<Something[]> {
    const caller = CrystallizeClient.catalogueApi;
    const response = await caller(graphQLQuery, variables);
    return response.data.catalogue;
}
```
