import { ApiCaller, ClientInterface, VariablesType } from './client';

export type CrystallizePromise<T> = {
    key: string;
    caller: ApiCaller<T>;
    query: string;
    variables?: VariablesType;
};

export type MassCallClientBatch = {
    from: number;
    to: number;
};
export type QueuedApiCaller = (query: string, variables?: VariablesType) => string;

export type MassClientInterface = ClientInterface & {
    execute: () => Promise<any>;
    reset: () => void;
    hasFailed: () => boolean;
    failureCount: () => number;
    retry: () => Promise<any>;
    catalogueApi: ApiCaller<any>;
    searchApi: ApiCaller<any>;
    orderApi: ApiCaller<any>;
    subscriptionApi: ApiCaller<any>;
    pimApi: ApiCaller<any>;
    enqueue: {
        catalogueApi: QueuedApiCaller;
        searchApi: QueuedApiCaller;
        orderApi: QueuedApiCaller;
        subscriptionApi: QueuedApiCaller;
        pimApi: QueuedApiCaller;
    };
};

const createFibonnaciSleeper = () => {
    let fibonnaciA = 0,
        fibonnaciB = 1;
    const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

    return {
        wait: async () => {
            const waitTime = fibonnaciA + fibonnaciB;
            fibonnaciA = fibonnaciB;
            fibonnaciB = waitTime;
            await sleep(waitTime);
        },
        reset: () => {
            fibonnaciA = 0;
            fibonnaciB = 1;
        },
    };
};

/**
 * Note: MassCallClient is experimental and may not work as expected.
 * Creates a mass call client based on an existing ClientInterface.
 *
 * @param client ClientInterface
 * @param options Object
 * @returns MassClientInterface
 */
export function createMassCallClient(
    client: ClientInterface,
    options: {
        initialSpawn?: number;
        maxSpawn?: number;
        onBatchDone?: (batch: MassCallClientBatch) => Promise<void>;
        beforeRequest?: (
            batch: MassCallClientBatch,
            promise: CrystallizePromise<any>,
        ) => Promise<CrystallizePromise<any> | void>;
        afterRequest?: (batch: MassCallClientBatch, promise: CrystallizePromise<any>, results: any) => Promise<void>;
        onFailure?: (
            batch: { from: number; to: number },
            exception: any,
            promise: CrystallizePromise<any>,
        ) => Promise<boolean>;
    },
): MassClientInterface {
    let promises: CrystallizePromise<any>[] = [];
    let failedPromises: CrystallizePromise<any>[] = [];
    let seek = 0;
    const maxConcurrent = options.maxSpawn ?? 5;
    let increment = options.initialSpawn ?? 1;
    const sleeper = createFibonnaciSleeper();

    const execute = async () => {
        failedPromises = [];
        let batch = [];
        let results: {
            [key: string]: any;
        } = [];
        do {
            let batchErrorCount = 0;
            const to = seek + increment;
            batch = promises.slice(seek, to);
            const batchResults = await Promise.all(
                batch.map(async (promise: CrystallizePromise<any>) => {
                    const buildStandardPromise = async (promise: CrystallizePromise<any>): Promise<any> => {
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

                    // otherwise we wrap it
                    return new Promise(async (resolve) => {
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
                        resolve(result);
                    });
                }),
            );
            batchResults.forEach((result) => {
                if (result) {
                    results[result.key] = result.result;
                }
            });

            // fire that a batch is done
            if (options.onBatchDone) {
                options.onBatchDone({ from: seek, to });
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
                increment = 1;
            } else if (batchErrorCount > 0 && increment > 1) {
                // if that's under 50%, we reduce
                increment--;
            } else if (batchErrorCount === 0 && increment < maxConcurrent) {
                // if no error, then we increment +1
                increment++;
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
        searchApi: client.searchApi,
        orderApi: client.orderApi,
        subscriptionApi: client.subscriptionApi,
        pimApi: client.pimApi,
        config: client.config,
        enqueue: {
            catalogueApi: (query: string, variables?: VariablesType): string => {
                const key = `catalogueApi-${counter++}`;
                promises.push({ key, caller: client.catalogueApi, query, variables });
                return key;
            },
            searchApi: (query: string, variables?: VariablesType): string => {
                const key = `searchApi-${counter++}`;
                promises.push({ key, caller: client.searchApi, query, variables });
                return key;
            },
            orderApi: (query: string, variables?: VariablesType): string => {
                const key = `orderApi-${counter++}`;
                promises.push({ key, caller: client.orderApi, query, variables });
                return key;
            },
            subscriptionApi: (query: string, variables?: VariablesType): string => {
                const key = `subscriptionApi-${counter++}`;
                promises.push({ key, caller: client.subscriptionApi, query, variables });
                return key;
            },
            pimApi: (query: string, variables?: VariablesType): string => {
                const key = `pimApi-${counter++}`;
                promises.push({ key, caller: client.pimApi, query, variables });
                return key;
            },
        },
    };
}
