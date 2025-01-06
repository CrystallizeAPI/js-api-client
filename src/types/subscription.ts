import { z } from 'zod';
import { EnumType } from 'json-to-graphql-query';
import { Payment, paymentInputRequest } from './order.js';
import { Address, addressInputRequest } from './address.js';

export const subscriptionContractMetadataInputRequest = z
    .object({
        key: z.string(),
        value: z.string(),
    })
    .strict();
export type SubscriptionContractMetadataInputRequest = z.infer<typeof subscriptionContractMetadataInputRequest>;

// Create Contract
export const subscriptionContractMeteredVariableTierInputRequest = z
    .object({
        currency: z.string(),
        price: z.number(),
        threshold: z.number(),
    })
    .strict();
export type SubscriptionContractMeteredVariableTierInputRequest = z.infer<
    typeof subscriptionContractMeteredVariableTierInputRequest
>;

export const subscriptionContractMeteredVariableReferenceInputRequest = z
    .object({
        id: z.string(),
        tierType: z.enum(['graduated', 'volume']).transform((val) => new EnumType(val)),
        tiers: z.array(subscriptionContractMeteredVariableTierInputRequest),
    })
    .strict();
export type SubscriptionContractMeteredVariableReferenceInputRequest = z.infer<
    typeof subscriptionContractMeteredVariableReferenceInputRequest
>;

export const subscriptionContractPhaseInputRequest = z
    .object({
        currency: z.string(),
        price: z.number(),
        meteredVariables: z.array(subscriptionContractMeteredVariableReferenceInputRequest),
        productVariants: z
            .array(
                z.object({
                    sku: z.string(),
                    quantity: z.number(),
                }),
            )
            .optional(),
    })
    .strict();
export type SubscriptionContractPhaseInput = z.infer<typeof subscriptionContractPhaseInputRequest>;

export const createSubscriptionContractInputRequest = z
    .object({
        customerIdentifier: z.string(),
        tenantId: z.string(),
        addresses: z.array(addressInputRequest).optional(),
        payment: paymentInputRequest.optional(),
        subscriptionPlan: z
            .object({
                identifier: z.string(),
                periodId: z.string(),
            })
            .optional(),
        status: z.object({
            activeUntil: z.date(),
            currency: z.string(),
            price: z.number(),
            renewAt: z.date(),
        }),
        item: z.object({
            sku: z.string(),
            name: z.string(),
            quantity: z.number().optional(),
            imageUrl: z.string().optional(),
            meta: z.array(subscriptionContractMetadataInputRequest).optional(),
        }),
        initial: subscriptionContractPhaseInputRequest.optional(),
        recurring: subscriptionContractPhaseInputRequest.optional(),
        meta: z.array(subscriptionContractMetadataInputRequest).optional(),
    })
    .strict();
export type CreateSubscriptionContractInputRequest = z.infer<typeof createSubscriptionContractInputRequest>;

// Update Contract
export const updateSubscriptionContractInputRequest = z
    .object({
        addresses: z.array(addressInputRequest).optional(),
        payment: paymentInputRequest.optional(),
        status: z
            .object({
                activeUntil: z.date().optional(),
                currency: z.string().optional(),
                price: z.number().optional(),
                renewAt: z.date().optional(),
            })
            .optional(),
        item: z
            .object({
                sku: z.string().optional(),
                name: z.string().optional(),
                quantity: z.number().optional(),
                imageUrl: z.string().optional(),
                meta: z.array(subscriptionContractMetadataInputRequest).optional(),
            })
            .optional(),
        initial: subscriptionContractPhaseInputRequest.optional(),
        recurring: subscriptionContractPhaseInputRequest.optional(),
        meta: z.array(subscriptionContractMetadataInputRequest).optional(),
    })
    .strict();
export type UpdateSubscriptionContractInputRequest = z.infer<typeof updateSubscriptionContractInputRequest>;

export type SubscriptionContractInnerDefinition = Omit<
    CreateSubscriptionContractInputRequest,
    'customerIdentifier' | 'payment' | 'addresses' | 'tenantId' | 'status'
>;

type PlanMeteredVariable = {
    id: string;
    identifier: string;
    name?: string;
    unit: string;
};

type MeteredVariable = PlanMeteredVariable & {
    id: string;
    tierType: string;
    tiers: {
        currency: string;
        threshold: number;
        price: number;
    }[];
};

type Phase = {
    period: number;
    unit: string;
    price: number;
    currency: string;
    meteredVariables?: MeteredVariable[];
};

export type SubscriptionContract = {
    id: string;
    customerIdentifier: string;
    tenantId: string;
    subscriptionPlan: {
        name: string;
        identifier: string;
        meteredVariables: PlanMeteredVariable[];
    };
    item: {
        name: string;
        sku: string;
        imageUrl?: string;
        quantity?: number;
        meta?: {
            key: string;
            value?: string;
        };
    };
    payment: Payment;
    initial?: Phase;
    recurring: Phase;
    status: {
        renewAt: string;
        activeUntil: string;
        price: number;
        currency: string;
    };
    meta?: {
        key: string;
        value?: string;
    }[];
    customer?: {
        identifier: string;
        email: string;
        firstName: string;
        lastName: string;
        companyName: string;
        phone: string;
        taxNumber: string;
        meta: {
            key: string;
            value: string;
        }[];
        externalReferences: {
            key: string;
            value: string;
        }[];
        addresses?: Address[];
    };
    addresses?: Address[];
};
