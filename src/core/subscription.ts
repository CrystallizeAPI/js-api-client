import { EnumType, jsonToGraphQLQuery } from 'json-to-graphql-query';
import {
    ProductPriceVariant,
    ProductVariant,
    ProductVariantSubscriptionPlan,
    ProductVariantSubscriptionPlanPeriod,
    ProductVariantSubscriptionMeteredVariable,
    ProductVariantSubscriptionPlanTier,
    ProductVariantSubscriptionPlanPricing,
} from '../types/product';
import {
    createSubscriptionContractInputRequest,
    CreateSubscriptionContractInputRequest,
    SubscriptionContractMeteredVariableReferenceInputRequest,
    SubscriptionContractMeteredVariableTierInputRequest,
    SubscriptionContractPhaseInput,
    updateSubscriptionContractInputRequest,
    UpdateSubscriptionContractInputRequest,
} from '../types/subscription';
import { catalogueFetcherGraphqlBuilder, createCatalogueFetcher } from './catalogue';
import { ClientInterface } from './client';

function convertDates(intent: CreateSubscriptionContractInputRequest | UpdateSubscriptionContractInputRequest) {
    if (!intent.status) {
        return {
            ...intent,
        };
    }

    let results: any = {
        ...intent,
    };

    if (intent.status.renewAt) {
        results = {
            ...results,
            status: {
                ...results.status,
                renewAt: intent.status.renewAt.toISOString(),
            },
        };
    }

    if (intent.status.activeUntil) {
        results = {
            ...results,
            status: {
                ...results.status,
                activeUntil: intent.status.activeUntil.toISOString(),
            },
        };
    }
    return results;
}

function convertEnums(intent: CreateSubscriptionContractInputRequest | UpdateSubscriptionContractInputRequest) {
    let results: any = {
        ...intent,
    };

    if (intent.initial && intent.initial.meteredVariables) {
        results = {
            ...results,
            initial: {
                ...intent.initial,
                meteredVariables: intent.initial.meteredVariables.map((variable: any) => {
                    return {
                        ...variable,
                        tierType: typeof variable.tierType === 'string' ? variable.tierType : variable.tierType.value,
                    };
                }),
            },
        };
    }

    if (intent.recurring && intent.recurring.meteredVariables) {
        results = {
            ...results,
            recurring: {
                ...intent.recurring,
                meteredVariables: intent.recurring.meteredVariables.map((variable: any) => {
                    return {
                        ...variable,
                        tierType: typeof variable.tierType === 'string' ? variable.tierType : variable.tierType.value,
                    };
                }),
            },
        };
    }

    return results;
}

export function createSubscriptionContractManager(apiClient: ClientInterface) {
    const create = async (
        intentSubsctiptionContract: CreateSubscriptionContractInputRequest,
        extraResultQuery?: any,
    ): Promise<any> => {
        const intent = createSubscriptionContractInputRequest.parse(convertEnums(intentSubsctiptionContract));
        const api = apiClient.pimApi;

        const mutation = {
            mutation: {
                subscriptionContract: {
                    create: {
                        __args: {
                            input: convertDates(intent),
                        },
                        id: true,
                        createdAt: true,
                        ...(extraResultQuery !== undefined ? extraResultQuery : {}),
                    },
                },
            },
        };
        const confirmation = await api(jsonToGraphQLQuery(mutation));
        return confirmation.subscriptionContract.create;
    };

    const update = async (
        id: string,
        intentSubsctiptionContract: UpdateSubscriptionContractInputRequest,
        extraResultQuery?: any,
    ): Promise<any> => {
        const intent = updateSubscriptionContractInputRequest.parse(convertEnums(intentSubsctiptionContract));
        const api = apiClient.pimApi;

        const mutation = {
            mutation: {
                subscriptionContract: {
                    update: {
                        __args: {
                            id,
                            input: convertDates(intent),
                        },
                        id: true,
                        updatedAt: true,
                        ...(extraResultQuery !== undefined ? extraResultQuery : {}),
                    },
                },
            },
        };
        const confirmation = await api(jsonToGraphQLQuery(mutation));
        return confirmation.subscriptionContract.update;
    };

    /**
     * This function assumes that the variant contains the subscriptions plans
     */
    const createSubscriptionContractTemplateBasedOnVariant = async (
        variant: ProductVariant,
        planIdentifier: string,
        periodId: string,
        priceVariantIdentifier: string,
    ) => {
        const matchingPlan: ProductVariantSubscriptionPlan | undefined = variant?.subscriptionPlans?.find(
            (plan: ProductVariantSubscriptionPlan) => plan.identifier === planIdentifier,
        );
        const matchingPeriod: ProductVariantSubscriptionPlanPeriod | undefined = matchingPlan?.periods?.find(
            (period: ProductVariantSubscriptionPlanPeriod) => period.id === periodId,
        );
        if (!matchingPlan || !matchingPeriod) {
            throw new Error(
                `Impossible to find the Subscription Plans for SKU ${variant.sku}, plan: ${planIdentifier}, period: ${periodId}`,
            );
        }

        const getPriceVariant = (
            priceVariants: ProductPriceVariant[],
            identifier: string,
        ): ProductPriceVariant | undefined => {
            return priceVariants.find((priceVariant: ProductPriceVariant) => priceVariant.identifier === identifier);
        };

        const transformPeriod = (period: ProductVariantSubscriptionPlanPricing): SubscriptionContractPhaseInput => {
            return {
                currency: getPriceVariant(period.priceVariants || [], priceVariantIdentifier)?.currency || 'USD',
                price: getPriceVariant(period.priceVariants || [], priceVariantIdentifier)?.price || 0.0,
                meteredVariables: (period.meteredVariables || []).map(
                    (
                        meteredVariable: ProductVariantSubscriptionMeteredVariable,
                    ): SubscriptionContractMeteredVariableReferenceInputRequest => {
                        return {
                            id: meteredVariable.id,
                            tierType: new EnumType(meteredVariable.tierType),
                            tiers: meteredVariable.tiers.map(
                                (
                                    tier: ProductVariantSubscriptionPlanTier,
                                ): SubscriptionContractMeteredVariableTierInputRequest => {
                                    return {
                                        threshold: tier.threshold,
                                        currency:
                                            getPriceVariant(tier.priceVariants || [], priceVariantIdentifier)
                                                ?.currency || 'USD',
                                        price:
                                            getPriceVariant(tier.priceVariants || [], priceVariantIdentifier)?.price ||
                                            0.0,
                                    };
                                },
                            ),
                        };
                    },
                ),
            };
        };
        const contract: Omit<
            CreateSubscriptionContractInputRequest,
            'customerIdentifier' | 'payment' | 'addresses' | 'tenantId' | 'status'
        > = {
            item: {
                sku: variant.sku,
                name: variant.name || '',
            },
            subscriptionPlan: {
                identifier: matchingPlan.identifier,
                periodId: matchingPeriod.id,
            },
            initial: !matchingPeriod.initial ? undefined : transformPeriod(matchingPeriod.initial),
            recurring: !matchingPeriod.recurring ? undefined : transformPeriod(matchingPeriod.recurring),
        };

        return contract;
    };

    /**
     * This function fetch it all
     */
    const createSubscriptionContractTemplateBasedOnVariantIdentity = async (
        path: string,
        productVariantIdentifier: { sku?: string; id?: string },
        planIdentifier: string,
        periodId: string,
        priceVariantIdentifier: string,
        language: string = 'en',
    ) => {
        if (!productVariantIdentifier.sku && !productVariantIdentifier.id) {
            throw new Error(
                `Impossible to find the Subscription Plans for Path ${path} with and empty Variant Identity`,
            );
        }

        // let's ask the catalog for the data we need to create the subscription contract template
        const fetcher = createCatalogueFetcher(apiClient);
        const builder = catalogueFetcherGraphqlBuilder;
        const data: any = await fetcher({
            catalogue: {
                __args: {
                    path,
                    language,
                },
                __on: [
                    builder.onProduct(
                        {},
                        {
                            onVariant: {
                                id: true,
                                name: true,
                                sku: true,
                                ...builder.onSubscriptionPlan(),
                            },
                        },
                    ),
                ],
            },
        });

        const matchingVariant: ProductVariant | undefined = data.catalogue?.variants?.find(
            (variant: ProductVariant) => {
                if (productVariantIdentifier.sku && variant.sku === productVariantIdentifier.sku) {
                    return true;
                }
                if (productVariantIdentifier.id && variant.id === productVariantIdentifier.id) {
                    return true;
                }
                return false;
            },
        );

        if (!matchingVariant) {
            throw new Error(
                `Impossible to find the Subscription Plans for Path ${path} and Variant: (sku: ${productVariantIdentifier.sku} id: ${productVariantIdentifier.id}), plan: ${planIdentifier}, period: ${periodId} in lang: ${language}`,
            );
        }

        return createSubscriptionContractTemplateBasedOnVariant(
            matchingVariant,
            planIdentifier,
            periodId,
            priceVariantIdentifier,
        );
    };
    return {
        create,
        update,
        createSubscriptionContractTemplateBasedOnVariantIdentity,
        createSubscriptionContractTemplateBasedOnVariant,
    };
}
