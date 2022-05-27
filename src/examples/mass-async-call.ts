// Usage: CRYSTALLIZE_TENANT_IDENTIFIER=furniture node dist/examples/massasynccall.js

import { CrystallizeClient } from '..';
import { createMassCallClient, CrystallizePromise, MassCallClientBatch } from '../core/massCallClient';

// call of onBatchDone is not blocking. (no await done internally)
const onBatchDone = async (batch: MassCallClientBatch): Promise<void> => {
    console.log(`Batch from ${batch.from} to ${batch.to} Done!`);
};

// call of onFailure is blocking. (await is done internally)
// Return:
//     true: the failure is enqueued for retry (if called)
//     false: the failure is not enqueued. You can retry it right away if you want.
const onFailure = async (
    batch: MassCallClientBatch,
    exception: any,
    promise: CrystallizePromise<any>,
): Promise<boolean> => {
    console.log(`Failure in batch from ${batch.from} to ${batch.to}`);
    console.log([promise.query, promise.variables]);
    //console.log(exception);
    return true;
};

// call of beforeRequest is blocking. (await is done before each request is done)
const beforeRequest = async (
    batch: MassCallClientBatch,
    promise: CrystallizePromise<any>,
): Promise<CrystallizePromise<any> | void> => {
    console.log(`Batch from ${batch.from} to ${batch.to} before request: ${promise.query}!`);
};

// call of afterRequest is blocking. (await is done after each request is finished)
const afterRequest = async (
    batch: MassCallClientBatch,
    promise: CrystallizePromise<any>,
    results: any,
): Promise<void> => {
    console.log(`Batch from ${batch.from} to ${batch.to} after request: ${promise.query}!`);
    console.log(results);
};

const client = createMassCallClient(CrystallizeClient, {
    initialSpawn: 1,
    maxSpawn: 5,
    onBatchDone,
    onFailure,
    beforeRequest,
    afterRequest,
});

async function run() {
    for (let i = 1; i <= 54; i++) {
        client.enqueue.catalogueApi(`query { catalogue { id, key${i}: name } }`);
    }

    const success = await client.execute();
    console.log('First pass done ', success);

    console.log('Failed Count: ' + client.failureCount());
    while (client.hasFailed()) {
        console.log('Retrying ' + client.failureCount());
        const newSuccess = await client.retry();
        console.log('retry pass done ', newSuccess);
    }
    console.log('ALL DONE!');
}
run();
