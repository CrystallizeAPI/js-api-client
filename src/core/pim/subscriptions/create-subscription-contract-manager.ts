import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { ClientInterface } from '../../client/create-client.js';
import {
    CreateSubscriptionContractInput,
    CreateSubscriptionContractInputSchema,
    SubscriptionContract,
    SubscriptionContractPhaseInput,
    SubscriptionContractPhaseInputSchema,
    UpdateSubscriptionContractInput,
    UpdateSubscriptionContractInputSchema,
} from '@crystallize/schema/pim';
import {
    SubscriptionProductPriceVariant,
    ProductVariantSubscriptionPlanPricing,
    ProductVariant,
} from '@crystallize/schema/catalogue';
import { transformSubscriptionContractInput } from './helpers.js';
import { catalogueFetcherGraphqlBuilder, createCatalogueFetcher } from '../../catalogue/create-catalogue-fetcher.js';

type WithIdentifiersAndStatus<R> = R & {
    id: string;
    customerIdentifier: string;
    status: {
        state: NonNullable<NonNullable<SubscriptionContract['status']>['state']>;
    } & (R extends { status: infer S } ? S : {});
};

const baseQuery = <OSC extends { status?: Record<string, unknown> }>(onSubscriptionContract?: OSC) => ({
    __on: [
        {
            __typeName: 'SubscriptionContractAggregate',
            id: true,
            customerIdentifier: true,
            status: {
                state: true,
                ...onSubscriptionContract?.status,
            },
            ...(onSubscriptionContract || {}),
        },
        {
            __typeName: 'BasicError',
            errorName: true,
            message: true,
        },
    ],
});

export const createSubscriptionContractManager = (apiClient: ClientInterface) => {
    const create = async <OnSubscriptionContract, OSC extends { status?: Record<string, unknown> } = {}>(
        intentSubscriptionContract: CreateSubscriptionContractInput,
        onSubscriptionContract?: OSC,
    ): Promise<WithIdentifiersAndStatus<OnSubscriptionContract>> => {
        const input = CreateSubscriptionContractInputSchema.parse(intentSubscriptionContract);
        const api = apiClient.nextPimApi;
        const mutation = {
            createSubscriptionContract: {
                __args: {
                    input: transformSubscriptionContractInput(input),
                },
                __on: [
                    {
                        __typeName: 'SubscriptionContractAggregate',
                        id: true,
                        customerIdentifier: true,
                        status: {
                            state: true,
                            ...onSubscriptionContract?.status,
                        },
                        ...(onSubscriptionContract || {}),
                    },
                    {
                        __typeName: 'BasicError',
                        errorName: true,
                        message: true,
                    },
                ],
            },
        };
        const confirmation = await api<{
            createSubscriptionContract: WithIdentifiersAndStatus<OnSubscriptionContract>;
        }>(jsonToGraphQLQuery({ mutation }));
        return confirmation.createSubscriptionContract;
    };

    const update = async <OnSubscriptionContract, OSC extends { status?: Record<string, unknown> } = {}>(
        intentSubscriptionContract: UpdateSubscriptionContractInput,
        onSubscriptionContract?: OSC,
    ): Promise<WithIdentifiersAndStatus<OnSubscriptionContract>> => {
        const { id, ...input } = UpdateSubscriptionContractInputSchema.parse(intentSubscriptionContract);
        const api = apiClient.nextPimApi;
        const mutation = {
            updateSubscriptionContract: {
                __args: {
                    subscriptionContractId: id,
                    input: transformSubscriptionContractInput(input),
                },
                ...baseQuery(onSubscriptionContract),
            },
        };
        const confirmation = await api<{
            updateSubscriptionContract: WithIdentifiersAndStatus<OnSubscriptionContract>;
        }>(jsonToGraphQLQuery({ mutation }));
        return confirmation.updateSubscriptionContract;
    };

    const cancel = async <OnSubscriptionContract, OSC extends { status?: Record<string, unknown> } = {}>(
        id: UpdateSubscriptionContractInput['id'],
        deactivate = false,
        onSubscriptionContract?: OSC,
    ): Promise<WithIdentifiersAndStatus<OnSubscriptionContract>> => {
        const api = apiClient.nextPimApi;
        const mutation = {
            cancelSubscriptionContract: {
                __args: {
                    subscriptionContractId: id,
                    input: {
                        deactivate,
                    },
                },
                ...baseQuery(onSubscriptionContract),
            },
        };
        const confirmation = await api<{
            cancelSubscriptionContract: WithIdentifiersAndStatus<OnSubscriptionContract>;
        }>(jsonToGraphQLQuery({ mutation }));
        return confirmation.cancelSubscriptionContract;
    };

    const pause = async <OnSubscriptionContract, OSC extends { status?: Record<string, unknown> } = {}>(
        id: UpdateSubscriptionContractInput['id'],
        onSubscriptionContract?: OSC,
    ): Promise<WithIdentifiersAndStatus<OnSubscriptionContract>> => {
        const api = apiClient.nextPimApi;
        const mutation = {
            pauseSubscriptionContract: {
                __args: {
                    subscriptionContractId: id,
                },
                ...baseQuery(onSubscriptionContract),
            },
        };
        const confirmation = await api<{
            pauseSubscriptionContract: WithIdentifiersAndStatus<OnSubscriptionContract>;
        }>(jsonToGraphQLQuery({ mutation }));
        return confirmation.pauseSubscriptionContract;
    };

    const resume = async <OnSubscriptionContract, OSC extends { status?: Record<string, unknown> } = {}>(
        id: UpdateSubscriptionContractInput['id'],
        onSubscriptionContract?: OSC,
    ): Promise<WithIdentifiersAndStatus<OnSubscriptionContract>> => {
        const api = apiClient.nextPimApi;
        const mutation = {
            resumeSubscriptionContract: {
                __args: {
                    subscriptionContractId: id,
                },
                ...baseQuery(onSubscriptionContract),
            },
        };
        const confirmation = await api<{
            resumeSubscriptionContract: WithIdentifiersAndStatus<OnSubscriptionContract>;
        }>(jsonToGraphQLQuery({ mutation }));
        return confirmation.resumeSubscriptionContract;
    };

    const renew = async <OnSubscriptionContract, OSC extends { status?: Record<string, unknown> } = {}>(
        id: UpdateSubscriptionContractInput['id'],
        onSubscriptionContract?: OSC,
    ): Promise<WithIdentifiersAndStatus<OnSubscriptionContract>> => {
        const api = apiClient.nextPimApi;
        const mutation = {
            renewSubscriptionContract: {
                __args: {
                    subscriptionContractId: id,
                },
                ...baseQuery(onSubscriptionContract),
            },
        };
        const confirmation = await api<{
            renewSubscriptionContract: WithIdentifiersAndStatus<OnSubscriptionContract>;
        }>(jsonToGraphQLQuery({ mutation }));
        return confirmation.renewSubscriptionContract;
    };

    /**
     * This function assumes that the variant contains the subscriptions plans
     */
    const createTemplateBasedOnVariant = async (
        variant: ProductVariant,
        planIdentifier: string,
        periodId: string,
        priceVariantIdentifier: string,
    ) => {
        const matchingPlan = variant?.subscriptionPlans?.find((plan) => plan.identifier === planIdentifier);
        const matchingPeriod = matchingPlan?.periods?.find((period) => period.id === periodId);
        if (!matchingPlan || !matchingPeriod) {
            throw new Error(
                `Impossible to find the Subscription Plans for SKU ${variant.sku}, plan: ${planIdentifier}, period: ${periodId}`,
            );
        }
        if (!matchingPlan.identifier || !matchingPeriod.id) {
            throw new Error(
                `Impossible to continue without the Subscription Plan Identifier or Period ID for SKU ${variant.sku}, plan: ${planIdentifier}, period: ${periodId}`,
            );
        }
        if (!matchingPeriod.recurring) {
            throw new Error(
                `Impossible to create a Subscription Contract Template for SKU ${variant.sku}, plan: ${planIdentifier}, period: ${periodId} because the recurring phase is not defined.`,
            );
        }

        const getPriceVariant = (priceVariants: SubscriptionProductPriceVariant[], identifier: string) => {
            return priceVariants.find((priceVariant) => priceVariant.identifier === identifier);
        };

        const transformPeriod = (period: ProductVariantSubscriptionPlanPricing): SubscriptionContractPhaseInput => {
            return SubscriptionContractPhaseInputSchema.parse({
                currency: getPriceVariant(period.priceVariants || [], priceVariantIdentifier)?.currency || 'USD',
                price: getPriceVariant(period.priceVariants || [], priceVariantIdentifier)?.price || 0.0,
                meteredVariables: (period.meteredVariables || []).map((meteredVariable) => {
                    return {
                        identifier: meteredVariable.identifier,
                        tierType: meteredVariable.tierType || 'graduated',
                        tiers: meteredVariable.tiers?.map((tier) => {
                            return {
                                threshold: tier.threshold,
                                currency:
                                    getPriceVariant(tier.priceVariants || [], priceVariantIdentifier)?.currency ||
                                    'USD',
                                price: getPriceVariant(tier.priceVariants || [], priceVariantIdentifier)?.price || 0.0,
                            };
                        }),
                    };
                }),
                period: period.period,
                unit: period.unit,
            });
        };
        const contract: Omit<
            CreateSubscriptionContractInput,
            'customerIdentifier' | 'payment' | 'addresses' | 'tenantId' | 'status'
        > = {
            item: {
                sku: variant.sku || 'unknown-sku',
                name: variant.name,
                quantity: 1,
                ...(variant.firstImage?.url && {
                    imageUrl: variant.firstImage?.url,
                }),
            },
            subscriptionPlan: {
                identifier: matchingPlan.identifier,
                periodId: matchingPeriod.id,
                periodName: matchingPeriod.name || 'unknown',
            },
            initial: !matchingPeriod.initial ? undefined : transformPeriod(matchingPeriod.initial),
            recurring: transformPeriod(matchingPeriod.recurring),
        };

        return contract;
    };

    const createTemplateBasedOnVariantIdentity = async (
        path: string,
        sku: string,
        planIdentifier: string,
        periodId: string,
        priceVariantIdentifier: string,
        language: string = 'en',
    ) => {
        // let's ask the catalog for the data we need to create the subscription contract template
        const fetcher = createCatalogueFetcher(apiClient);
        const builder = catalogueFetcherGraphqlBuilder;
        const data = await fetcher<{ catalogue: { variants: ProductVariant[] } }>({
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
            (variant: ProductVariant) => variant.sku === sku,
        );
        if (!matchingVariant) {
            throw new Error(
                `Impossible to find the Subscription Plans for Path ${path} and Variant: (sku: ${sku}, plan: ${planIdentifier}, period: ${periodId} in lang: ${language}`,
            );
        }
        return createTemplateBasedOnVariant(matchingVariant, planIdentifier, periodId, priceVariantIdentifier);
    };

    return {
        create,
        update,
        cancel,
        pause,
        resume,
        renew,
        createTemplateBasedOnVariant,
        createTemplateBasedOnVariantIdentity,
    };
};
