import { catalogueFetcherGraphqlBuilder } from '../catalogue';
import { MassClientInterface } from '../massCallClient';
import { buildNestedNavigationQuery, NavigationType } from '../navigation';
import { getTenantBasicQuery, getTenantQueries } from './createSpecQuery';

export type DumperOptions = {
    tenantIdentifier: string;
    topicsDepth?: number;
    treeDepth?: number;
};

export type TenantDescription = {
    tenant: {
        id: string;
        identifier: string;
        staticAuthToken: string;
    };
    shapes?: any[];
    priceVariants?: any[];
    stockLocations?: any[];
    subscriptionPlans?: any[];
    languages: {
        default: string;
        availableLanguages: any[];
    };
    vatTypes?: any[];
    topics: Record<string, any[]>;
    grids: Record<string, any[]>;
    items: Record<string, any[]>;
};

export const createDumper = (apiClient: MassClientInterface, options: DumperOptions) => {
    const dump = async (): Promise<any> => {
        const tenantRequestId = apiClient.enqueue.pimApi(getTenantBasicQuery(options.tenantIdentifier));
        const tenantResult = await apiClient.execute();
        const tenant = tenantResult[tenantRequestId]?.tenant?.get;
        if (apiClient.hasFailed() || !tenant) {
            throw new Error(`⛔️ You do not have access to tenant "${options.tenantIdentifier}" ⛔️`);
        }
        const defaultLanguage = tenant?.defaults?.language;

        const spec: TenantDescription = {
            tenant: {
                id: tenant.id,
                identifier: tenant.identifier,
                staticAuthToken: tenant.staticAuthToken,
            },
            languages: {
                default: defaultLanguage ?? tenant.availableLanguages[0].code,
                availableLanguages: tenant.availableLanguages,
            },
            vatTypes: undefined,
            subscriptionPlans: undefined,
            shapes: undefined,
            priceVariants: undefined,
            stockLocations: undefined,
            topics: {},
            grids: {},
            items: {},
        };

        const queries = getTenantQueries(tenant.id);
        const vatTypes = apiClient.enqueue.pimApi(queries.vatTypes);
        const shapes = apiClient.enqueue.pimApi(queries.shapes);
        const priceVariants = apiClient.enqueue.pimApi(queries.priceVariantsQuery);
        const subscriptionPlans = apiClient.enqueue.pimApi(queries.subscriptionPlans);
        const stockLocations = apiClient.enqueue.pimApi(queries.stockLocations);
        const topics = spec.languages.availableLanguages.map((language: any) => {
            return {
                language: language.code,
                requestId: apiClient.enqueue.catalogueApi(
                    buildNestedNavigationQuery(NavigationType.Topics, '/', options.topicsDepth ?? 25, {}, () => {
                        return {
                            parentId: true,
                        };
                    }),
                    { language: language.code, path: '/' },
                ),
            };
        });

        const grids = spec.languages.availableLanguages.map((language: any) => {
            return {
                language: language.code,
                requestId: apiClient.enqueue.pimApi(queries.grids, { language: language.code }),
            };
        });

        // big todo here, maybe get the parents, then loop through the children
        // use generator etc.
        const items = spec.languages.availableLanguages.map((language: any) => {
            const builder = catalogueFetcherGraphqlBuilder;
            const query = buildNestedNavigationQuery(NavigationType.Tree, '/', options.treeDepth ?? 5, {}, () => {
                return {
                    id: true,
                };
            });
            return {
                language: language.code,
                requestId: apiClient.enqueue.catalogueApi(query, { language: language.code, path: '/' }),
            };
        });

        do {
            const results = apiClient.hasFailed() ? await apiClient.retry() : await apiClient.execute();

            // vatTypes
            if (results[vatTypes]) {
                spec.vatTypes = results[vatTypes].tenant?.get?.vatTypes || [];
            }

            // subscriptionPlans
            if (results[subscriptionPlans]) {
                const data = results[subscriptionPlans].subscriptionPlan?.getMany || [];

                spec.subscriptionPlans = data.map((subscriptionPlan: any) => ({
                    identifier: subscriptionPlan.identifier,
                    name: subscriptionPlan.name || '',
                    meteredVariables:
                        subscriptionPlan.meteredVariables?.map((meteredVariable: any) => ({
                            identifier: meteredVariable.identifier,
                            name: meteredVariable.name || '',
                            unit: meteredVariable.unit,
                        })) || [],
                    periods:
                        subscriptionPlan.periods?.map((period: any) => ({
                            name: period.name || '',
                            initial: period.initial,
                            recurring: period.recurring,
                        })) || [],
                }));
            }

            // shapes
            if (results[shapes]) {
                spec.shapes = results[shapes].shape?.getMany || [];
            }

            // priceVariants
            if (results[priceVariants]) {
                spec.priceVariants = results[priceVariants].priceVariant?.getMany || [];
            }

            // stockLocations
            if (results[stockLocations]) {
                spec.stockLocations = results[stockLocations].stockLocation?.getMany || [];
            }

            // topics
            topics.forEach(({ language, requestId }: { language: string; requestId: string }) => {
                if (results[requestId]) {
                    spec.topics[language] = results[requestId].tree ?? [];
                }
            });

            // grids
            grids.forEach(({ language, requestId }: { language: string; requestId: string }) => {
                if (results[requestId]) {
                    function handleRow(row: any) {
                        return {
                            columns: row.columns.map((c: any) => ({
                                layout: c.layout,
                                item: !c.item
                                    ? null
                                    : {
                                        externalReference: c.item.tree.externalReference,
                                        cataloguePath: c.item.tree.path,
                                    },
                            })),
                        };
                    }
                    function handleGrid(grid: any): any {
                        return {
                            ...grid,
                            rows: grid.rows?.map(handleRow) || [],
                        };
                    }
                    spec.grids[language] = results[requestId].grid?.getMany?.map(handleGrid) || [];
                }
            });

            // items
            items.forEach(({ language, requestId }: { language: string; requestId: string }) => {
                if (results[requestId]) {
                    spec.items[language] = results[requestId].tree ?? [];
                }
            });
        } while (apiClient.hasFailed());

        return spec;
    };
    return {
        dump,
    };
};