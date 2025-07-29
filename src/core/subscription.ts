// import { EnumType, jsonToGraphQLQuery } from 'json-to-graphql-query';
// import {
//     ProductPriceVariant,
//     ProductVariant,
//     ProductVariantSubscriptionPlan,
//     ProductVariantSubscriptionPlanPeriod,
//     ProductVariantSubscriptionMeteredVariable,
//     ProductVariantSubscriptionPlanTier,
//     ProductVariantSubscriptionPlanPricing,
// } from '../types/product.js';
// import {
//     createSubscriptionContractInputRequest,
//     CreateSubscriptionContractInputRequest,
//     SubscriptionContract,
//     SubscriptionContractMeteredVariableReferenceInputRequest,
//     SubscriptionContractMeteredVariableTierInputRequest,
//     SubscriptionContractPhaseInput,
//     updateSubscriptionContractInputRequest,
//     UpdateSubscriptionContractInputRequest,
// } from '../types/subscription.js';
// import { catalogueFetcherGraphqlBuilder, createCatalogueFetcher } from './catalogue/create-catalogue-fetcher.js';
// import { ClientInterface } from './client/create-client.js';

// function convertDates(intent: CreateSubscriptionContractInputRequest | UpdateSubscriptionContractInputRequest) {
//     if (!intent.status) {
//         return {
//             ...intent,
//         };
//     }

//     let results: any = {
//         ...intent,
//     };

//     if (intent.status.renewAt) {
//         results = {
//             ...results,
//             status: {
//                 ...results.status,
//                 renewAt: intent.status.renewAt.toISOString(),
//             },
//         };
//     }

//     if (intent.status.activeUntil) {
//         results = {
//             ...results,
//             status: {
//                 ...results.status,
//                 activeUntil: intent.status.activeUntil.toISOString(),
//             },
//         };
//     }
//     return results;
// }

// function convertEnums(intent: CreateSubscriptionContractInputRequest | UpdateSubscriptionContractInputRequest) {
//     let results: any = {
//         ...intent,
//     };

//     if (intent.initial && intent.initial.meteredVariables) {
//         results = {
//             ...results,
//             initial: {
//                 ...intent.initial,
//                 meteredVariables: intent.initial.meteredVariables.map((variable: any) => {
//                     return {
//                         ...variable,
//                         tierType: typeof variable.tierType === 'string' ? variable.tierType : variable.tierType.value,
//                     };
//                 }),
//             },
//         };
//     }

//     if (intent.recurring && intent.recurring.meteredVariables) {
//         results = {
//             ...results,
//             recurring: {
//                 ...intent.recurring,
//                 meteredVariables: intent.recurring.meteredVariables.map((variable: any) => {
//                     return {
//                         ...variable,
//                         tierType: typeof variable.tierType === 'string' ? variable.tierType : variable.tierType.value,
//                     };
//                 }),
//             },
//         };
//     }

//     return results;
// }

// export function createSubscriptionContractManager(apiClient: ClientInterface) {
//     const create = async (
//         intentSubsctiptionContract: CreateSubscriptionContractInputRequest,
//         extraResultQuery?: any,
//     ): Promise<any> => {
//         const intent = createSubscriptionContractInputRequest.parse(convertEnums(intentSubsctiptionContract));
//         const api = apiClient.pimApi;

//         const mutation = {
//             mutation: {
//                 subscriptionContract: {
//                     create: {
//                         __args: {
//                             input: convertDates(intent),
//                         },
//                         id: true,
//                         createdAt: true,
//                         ...(extraResultQuery !== undefined ? extraResultQuery : {}),
//                     },
//                 },
//             },
//         };
//         const confirmation = await api(jsonToGraphQLQuery(mutation));
//         return confirmation.subscriptionContract.create;
//     };

//     const update = async (
//         id: string,
//         intentSubsctiptionContract: UpdateSubscriptionContractInputRequest,
//         extraResultQuery?: any,
//     ): Promise<any> => {
//         const intent = updateSubscriptionContractInputRequest.parse(convertEnums(intentSubsctiptionContract));
//         const api = apiClient.pimApi;

//         const mutation = {
//             mutation: {
//                 subscriptionContract: {
//                     update: {
//                         __args: {
//                             id,
//                             input: convertDates(intent),
//                         },
//                         id: true,
//                         updatedAt: true,
//                         ...(extraResultQuery !== undefined ? extraResultQuery : {}),
//                     },
//                 },
//             },
//         };
//         const confirmation = await api(jsonToGraphQLQuery(mutation));
//         return confirmation.subscriptionContract.update;
//     };

//     /**
//      * This function assumes that the variant contains the subscriptions plans
//      */
//     const createSubscriptionContractTemplateBasedOnVariant = async (
//         variant: ProductVariant,
//         planIdentifier: string,
//         periodId: string,
//         priceVariantIdentifier: string,
//     ) => {
//         const matchingPlan: ProductVariantSubscriptionPlan | undefined = variant?.subscriptionPlans?.find(
//             (plan: ProductVariantSubscriptionPlan) => plan.identifier === planIdentifier,
//         );
//         const matchingPeriod: ProductVariantSubscriptionPlanPeriod | undefined = matchingPlan?.periods?.find(
//             (period: ProductVariantSubscriptionPlanPeriod) => period.id === periodId,
//         );
//         if (!matchingPlan || !matchingPeriod) {
//             throw new Error(
//                 `Impossible to find the Subscription Plans for SKU ${variant.sku}, plan: ${planIdentifier}, period: ${periodId}`,
//             );
//         }

//         const getPriceVariant = (
//             priceVariants: ProductPriceVariant[],
//             identifier: string,
//         ): ProductPriceVariant | undefined => {
//             return priceVariants.find((priceVariant: ProductPriceVariant) => priceVariant.identifier === identifier);
//         };

//         const transformPeriod = (period: ProductVariantSubscriptionPlanPricing): SubscriptionContractPhaseInput => {
//             return {
//                 currency: getPriceVariant(period.priceVariants || [], priceVariantIdentifier)?.currency || 'USD',
//                 price: getPriceVariant(period.priceVariants || [], priceVariantIdentifier)?.price || 0.0,
//                 meteredVariables: (period.meteredVariables || []).map(
//                     (
//                         meteredVariable: ProductVariantSubscriptionMeteredVariable,
//                     ): SubscriptionContractMeteredVariableReferenceInputRequest => {
//                         return {
//                             id: meteredVariable.id,
//                             tierType: new EnumType(meteredVariable.tierType),
//                             tiers: meteredVariable.tiers.map(
//                                 (
//                                     tier: ProductVariantSubscriptionPlanTier,
//                                 ): SubscriptionContractMeteredVariableTierInputRequest => {
//                                     return {
//                                         threshold: tier.threshold,
//                                         currency:
//                                             getPriceVariant(tier.priceVariants || [], priceVariantIdentifier)
//                                                 ?.currency || 'USD',
//                                         price:
//                                             getPriceVariant(tier.priceVariants || [], priceVariantIdentifier)?.price ||
//                                             0.0,
//                                     };
//                                 },
//                             ),
//                         };
//                     },
//                 ),
//             };
//         };
//         const contract: Omit<
//             CreateSubscriptionContractInputRequest,
//             'customerIdentifier' | 'payment' | 'addresses' | 'tenantId' | 'status'
//         > = {
//             item: {
//                 sku: variant.sku,
//                 name: variant.name || '',
//                 quantity: 1,
//                 imageUrl: variant.firstImage?.url || '',
//             },
//             subscriptionPlan: {
//                 identifier: matchingPlan.identifier,
//                 periodId: matchingPeriod.id,
//             },
//             initial: !matchingPeriod.initial ? undefined : transformPeriod(matchingPeriod.initial),
//             recurring: !matchingPeriod.recurring ? undefined : transformPeriod(matchingPeriod.recurring),
//         };

//         return contract;
//     };

//     const createSubscriptionContractTemplateBasedOnVariantIdentity = async (
//         path: string,
//         productVariantIdentifier: { sku?: string; id?: string },
//         planIdentifier: string,
//         periodId: string,
//         priceVariantIdentifier: string,
//         language: string = 'en',
//     ) => {
//         if (!productVariantIdentifier.sku && !productVariantIdentifier.id) {
//             throw new Error(
//                 `Impossible to find the Subscription Plans for Path ${path} with and empty Variant Identity`,
//             );
//         }

//         // let's ask the catalog for the data we need to create the subscription contract template
//         const fetcher = createCatalogueFetcher(apiClient);
//         const builder = catalogueFetcherGraphqlBuilder;
//         const data: any = await fetcher({
//             catalogue: {
//                 __args: {
//                     path,
//                     language,
//                 },
//                 __on: [
//                     builder.onProduct(
//                         {},
//                         {
//                             onVariant: {
//                                 id: true,
//                                 name: true,
//                                 sku: true,
//                                 ...builder.onSubscriptionPlan(),
//                             },
//                         },
//                     ),
//                 ],
//             },
//         });

//         const matchingVariant: ProductVariant | undefined = data.catalogue?.variants?.find(
//             (variant: ProductVariant) => {
//                 if (productVariantIdentifier.sku && variant.sku === productVariantIdentifier.sku) {
//                     return true;
//                 }
//                 if (productVariantIdentifier.id && variant.id === productVariantIdentifier.id) {
//                     return true;
//                 }
//                 return false;
//             },
//         );

//         if (!matchingVariant) {
//             throw new Error(
//                 `Impossible to find the Subscription Plans for Path ${path} and Variant: (sku: ${productVariantIdentifier.sku} id: ${productVariantIdentifier.id}), plan: ${planIdentifier}, period: ${periodId} in lang: ${language}`,
//             );
//         }

//         return createSubscriptionContractTemplateBasedOnVariant(
//             matchingVariant,
//             planIdentifier,
//             periodId,
//             priceVariantIdentifier,
//         );
//     };

//     const fetchById = async (id: string, onCustomer?: any, extraQuery?: any): Promise<SubscriptionContract> => {
//         const query = {
//             subscriptionContract: {
//                 get: {
//                     __args: {
//                         id,
//                     },
//                     ...SubscriptionContractQuery(onCustomer, extraQuery),
//                 },
//             },
//         };
//         const data = await apiClient.pimApi(jsonToGraphQLQuery({ query }));
//         return data.subscriptionContract.get;
//     };

//     const fetchByCustomerIdentifier = async (
//         customerIdentifier: string,
//         extraQueryArgs?: any,
//         onCustomer?: any,
//         extraQuery?: any,
//     ): Promise<{
//         pageInfo: {
//             hasNextPage: boolean;
//             hasPreviousPage: boolean;
//             startCursor: string;
//             endCursor: string;
//             totalNodes: number;
//         };
//         contracts: SubscriptionContract[];
//     }> => {
//         const query = {
//             subscriptionContract: {
//                 getMany: {
//                     __args: {
//                         customerIdentifier: customerIdentifier,
//                         tenantId: apiClient.config.tenantId,
//                         ...(extraQueryArgs !== undefined ? extraQueryArgs : {}),
//                     },
//                     pageInfo: {
//                         hasPreviousPage: true,
//                         hasNextPage: true,
//                         startCursor: true,
//                         endCursor: true,
//                         totalNodes: true,
//                     },
//                     edges: {
//                         cursor: true,
//                         node: SubscriptionContractQuery(onCustomer, extraQuery),
//                     },
//                 },
//             },
//         };
//         const response = await apiClient.pimApi(jsonToGraphQLQuery({ query }));
//         return {
//             pageInfo: response.subscriptionContract.getMany.pageInfo,
//             contracts: response.subscriptionContract.getMany?.edges?.map((edge: any) => edge.node) || [],
//         };
//     };

//     const getCurrentPhase = async (id: string): Promise<'initial' | 'recurring'> => {
//         const query = {
//             subscriptionContractEvent: {
//                 getMany: {
//                     __args: {
//                         subscriptionContractId: id,
//                         tenantId: apiClient.config.tenantId,
//                         sort: new EnumType('asc'),
//                         first: 1,
//                         eventTypes: new EnumType('renewed'),
//                     },
//                     edges: {
//                         node: {
//                             id: true,
//                         },
//                     },
//                 },
//             },
//         };
//         const contractUsage = await apiClient.pimApi(jsonToGraphQLQuery({ query }));
//         return contractUsage.subscriptionContractEvent.getMany.edges.length > 0 ? 'recurring' : 'initial';
//     };

//     const getUsageForPeriod = async (
//         id: string,
//         from: Date,
//         to: Date,
//     ): Promise<
//         {
//             meteredVariableId: string;
//             quantity: number;
//         }[]
//     > => {
//         const query = {
//             subscriptionContract: {
//                 get: {
//                     __args: {
//                         id,
//                     },
//                     id: true,
//                     usage: {
//                         __args: {
//                             start: from.toISOString(),
//                             end: to.toISOString(),
//                         },
//                         meteredVariableId: true,
//                         quantity: true,
//                     },
//                 },
//             },
//         };
//         const contractUsage = await apiClient.pimApi(jsonToGraphQLQuery({ query }));
//         return contractUsage.subscriptionContract.get.usage;
//     };

//     return {
//         create,
//         update,
//         fetchById,
//         fetchByCustomerIdentifier,
//         getCurrentPhase,
//         getUsageForPeriod,
//         createSubscriptionContractTemplateBasedOnVariantIdentity,
//         createSubscriptionContractTemplateBasedOnVariant,
//     };
// }

// const buildGenericSubscriptionContractQuery = (onCustomer?: any, extraQuery?: any) => {
//     return {
//         id: true,
//         tenantId: true,
//         subscriptionPlan: {
//             name: true,
//             identifier: true,
//             meteredVariables: {
//                 id: true,
//                 identifier: true,
//                 name: true,
//                 unit: true,
//             },
//         },
//         item: {
//             name: true,
//             sku: true,
//             quantity: true,
//             meta: {
//                 key: true,
//                 value: true,
//             },
//         },
//         initial: {
//             period: true,
//             unit: true,
//             price: true,
//             currency: true,
//             meteredVariables: {
//                 id: true,
//                 name: true,
//                 identifier: true,
//                 unit: true,
//                 tierType: true,
//                 tiers: {
//                     currency: true,
//                     threshold: true,
//                     price: true,
//                 },
//             },
//         },
//         recurring: {
//             period: true,
//             unit: true,
//             price: true,
//             currency: true,
//             meteredVariables: {
//                 id: true,
//                 name: true,
//                 identifier: true,
//                 unit: true,
//                 tierType: true,
//                 tiers: {
//                     currency: true,
//                     threshold: true,
//                     price: true,
//                 },
//             },
//         },
//         status: {
//             renewAt: true,
//             activeUntil: true,
//             price: true,
//             currency: true,
//         },
//         meta: {
//             key: true,
//             value: true,
//         },
//         addresses: {
//             type: true,
//             lastName: true,
//             firstName: true,
//             email: true,
//             middleName: true,
//             street: true,
//             street2: true,
//             city: true,
//             country: true,
//             state: true,
//             postalCode: true,
//             phone: true,
//             streetNumber: true,
//         },
//         customerIdentifier: true,
//         customer: {
//             identifier: true,
//             email: true,
//             firstName: true,
//             lastName: true,
//             companyName: true,
//             phone: true,
//             taxNumber: true,
//             meta: {
//                 key: true,
//                 value: true,
//             },
//             externalReferences: {
//                 key: true,
//                 value: true,
//             },
//             addresses: {
//                 type: true,
//                 lastName: true,
//                 firstName: true,
//                 email: true,
//                 middleName: true,
//                 street: true,
//                 street2: true,
//                 city: true,
//                 country: true,
//                 state: true,
//                 postalCode: true,
//                 phone: true,
//                 streetNumber: true,
//                 meta: {
//                     key: true,
//                     value: true,
//                 },
//             },
//             ...(onCustomer !== undefined ? onCustomer : {}),
//         },
//         ...(extraQuery !== undefined ? extraQuery : {}),
//     };
// };
