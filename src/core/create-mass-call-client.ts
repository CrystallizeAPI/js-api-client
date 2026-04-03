import { ApiCaller, VariablesType } from './client/create-api-caller.js';
import { ClientInterface } from './client/create-client.js';

export type CrystallizePromise = {
    key: string;
    caller: ApiCaller;
    query: string;
    variables?: VariablesType;
};

export type MassCallClientBatch = {
    from: number;
    to: number;
};
export type QueuedApiCaller = (query: string, variables?: VariablesType) => string;

export type MassCallResults = Record<string, unknown>;

export type MassClientInterface = ClientInterface & {
    execute: () => Promise<MassCallResults>;
    reset: () => void;
    hasFailed: () => boolean;
    failureCount: () => number;
    retry: () => Promise<MassCallResults>;
    catalogueApi: ApiCaller;
    discoveryApi: ApiCaller;
    pimApi: ApiCaller;
    nextPimApi: ApiCaller;
    shopCartApi: ApiCaller;
    enqueue: {
        catalogueApi: QueuedApiCaller;
        discoveryApi: QueuedApiCaller;
        pimApi: QueuedApiCaller;
        nextPimApi: QueuedApiCaller;
        shopCartApi: QueuedApiCaller;
    };
};

export type Sleeper = {
    wait: () => Promise<void>;
    reset: () => void;
};

const createFibonacciSleeper = (): Sleeper => {
    let fibonacciA = 0,
        fibonacciB = 1;
    const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

    return {
        wait: async () => {
            const waitTime = fibonacciB;
            const nextFib = fibonacciA + fibonacciB;
            fibonacciA = fibonacciB;
            fibonacciB = nextFib;
            await sleep(waitTime);
        },
        reset: () => {
            fibonacciA = 0;
            fibonacciB = 1;
        },
    };
};

let hasWarnedDeprecation = false;

/**
 * Creates a mass call client that batches and throttles multiple API requests with automatic retry and concurrency control.
 *
 * @deprecated Use mature ecosystem packages like `p-limit` or `p-queue` instead for concurrency control.
 * They provide better error handling, TypeScript support, and are actively maintained.
 *
 * ```ts
 * import pLimit from 'p-limit';
 * const limit = pLimit(5);
 * const results = await Promise.all(
 *   items.map((item) => limit(() => client.pimApi(mutation, { id: item.id }))),
 * );
 * ```
 *
 * @param client - A Crystallize client instance created via `createClient`.
 * @param options - Configuration for concurrency, batching callbacks, failure handling, and sleep strategy.
 * @returns A mass client interface that extends `ClientInterface` with `enqueue`, `execute`, `retry`, `reset`, `hasFailed`, and `failureCount` capabilities.
 *
 * @example
 * ```ts
 * const massClient = createMassCallClient(client, { initialSpawn: 2, maxSpawn: 5 });
 * massClient.enqueue.pimApi(`mutation { ... }`, { id: '1' });
 * massClient.enqueue.pimApi(`mutation { ... }`, { id: '2' });
 * const results = await massClient.execute();
 * if (massClient.hasFailed()) {
 *   const retryResults = await massClient.retry();
 * }
 * ```
 */
export function createMassCallClient(
    client: ClientInterface,
    options: {
        initialSpawn?: number;
        maxSpawn?: number;
        onBatchDone?: (batch: MassCallClientBatch) => Promise<void>;
        beforeRequest?: (batch: MassCallClientBatch, promise: CrystallizePromise) => Promise<CrystallizePromise | void>;
        afterRequest?: (
            batch: MassCallClientBatch,
            promise: CrystallizePromise,
            results: Record<string, unknown>,
        ) => Promise<void>;
        onFailure?: (
            batch: { from: number; to: number },
            exception: unknown,
            promise: CrystallizePromise,
        ) => Promise<boolean>;
        sleeper?: Sleeper;
        changeIncrementFor?: (
            situation: 'more-than-half-have-failed' | 'some-have-failed' | 'none-have-failed',
            currentIncrement: number,
        ) => number;
    },
): MassClientInterface {
    if (!hasWarnedDeprecation) {
        hasWarnedDeprecation = true;
        console.warn(
            '[@crystallize/js-api-client] createMassCallClient is deprecated. ' +
                'Use p-limit or p-queue for concurrency control instead. ' +
                'See https://www.npmjs.com/package/p-limit',
        );
    }

    let promises: CrystallizePromise[] = [];
    let failedPromises: CrystallizePromise[] = [];
    let seek = 0;
    const maxConcurrent = options.maxSpawn ?? 5;
    let increment = options.initialSpawn ?? 1;
    const sleeper = options.sleeper ?? createFibonacciSleeper();

    const execute = async () => {
        failedPromises = [];
        let batch = [];
        let results: MassCallResults = {};
        do {
            let batchErrorCount = 0;
            const to = seek + increment;
            batch = promises.slice(seek, to);
            const batchResults = await Promise.all(
                batch.map(async (promise: CrystallizePromise) => {
                    const buildStandardPromise = async (
                        promise: CrystallizePromise,
                    ): Promise<{ key: string; result: unknown } | undefined> => {
                        try {
                            return {
                                key: promise.key,
                                result: await promise.caller(promise.query, promise.variables),
                            };
                        } catch (exception) {
                            batchErrorCount++;
                            const enqueueFailure = options.onFailure
                                ? await options.onFailure({ from: seek, to: to }, exception, promise)
                                : true;
                            if (enqueueFailure) {
                                failedPromises.push(promise);
                            }
                        }
                    };

                    // if no beforeRequest && no afterRequest, then we just return the promise as is
                    if (!options.beforeRequest && !options.afterRequest) {
                        return buildStandardPromise(promise);
                    }

                    // otherwise we wrap it with before/after hooks
                    let alteredPromise;
                    if (options.beforeRequest) {
                        alteredPromise = await options.beforeRequest({ from: seek, to: to }, promise);
                    }
                    const result = await buildStandardPromise(alteredPromise ?? promise);
                    if (options.afterRequest && result) {
                        await options.afterRequest({ from: seek, to: to }, promise, {
                            [result.key]: result.result,
                        });
                    }
                    return result;
                }),
            );
            batchResults.forEach((result) => {
                if (result) {
                    results[result.key] = result.result;
                }
            });

            // fire that a batch is done
            if (options.onBatchDone) {
                await options.onBatchDone({ from: seek, to });
            }
            // we move the seek pointer
            seek += batch.length;

            if (batchErrorCount === batch.length) {
                await sleeper.wait();
            } else {
                sleeper.reset();
            }

            if (batchErrorCount > Math.floor(batch.length / 2)) {
                // if we have more than 50% of error we restart from 1 by 1
                increment = options.changeIncrementFor
                    ? options.changeIncrementFor('more-than-half-have-failed', increment)
                    : 1;
            } else if (batchErrorCount > 0 && increment > 1) {
                // if that's under 50%, we reduce
                increment = options.changeIncrementFor
                    ? options.changeIncrementFor('some-have-failed', increment)
                    : increment - 1;
            } else if (batchErrorCount === 0 && increment < maxConcurrent) {
                // if no error, then we increment +1
                increment = options.changeIncrementFor
                    ? options.changeIncrementFor('none-have-failed', increment)
                    : increment + 1;
            }
        } while (batch.length > 0 && seek < promises.length);
        return results;
    };

    let counter = 1;
    return {
        execute,
        reset: () => {
            promises = [];
            seek = 0;
            failedPromises = [];
        },
        hasFailed: () => failedPromises.length > 0,
        failureCount: () => failedPromises.length,
        retry: async () => {
            promises = [...failedPromises];
            failedPromises = [];
            seek = 0;
            return await execute();
        },
        catalogueApi: client.catalogueApi,
        discoveryApi: client.discoveryApi,
        pimApi: client.pimApi,
        shopCartApi: client.shopCartApi,
        nextPimApi: client.nextPimApi,
        config: client.config,
        close: client.close,
        [Symbol.dispose]: client[Symbol.dispose],
        enqueue: Object.fromEntries(
            (['catalogueApi', 'discoveryApi', 'pimApi', 'nextPimApi', 'shopCartApi'] as const).map((apiName) => [
                apiName,
                (query: string, variables?: VariablesType): string => {
                    const key = `${apiName}-${counter++}`;
                    promises.push({ key, caller: client[apiName], query, variables });
                    return key;
                },
            ]),
        ) as MassClientInterface['enqueue'],
    };
}
