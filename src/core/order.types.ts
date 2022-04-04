import { z } from 'zod';

export const orderItemMeteredVariableInput = z
    .object({
        id: z.string(),
        usage: z.number(),
        price: z.number()
    })
    .strict();
export type OrderItemMeteredVariableInput = z.infer<
    typeof orderItemMeteredVariableInput
>;

export const orderItemSubscriptionInput = z
    .object({
        name: z.string().optional(),
        period: z.number(),
        unit: z.enum(['minute', 'hour', 'day', 'week', 'month', 'year']),
        start: z.date().optional(),
        end: z.date().optional(),
        meteredVariables: z.array(orderItemMeteredVariableInput).optional()
    })
    .strict();
export type OrderItemSubscriptionInput = z.infer<
    typeof orderItemSubscriptionInput
>;

export const priceInputRequest = z
    .object({
        gross: z.number().optional(),
        net: z.number().optional(),
        currency: z.string(),
        discount: z.object({
            percent: z.number().optional()
        }),
        tax: z.object({
            name: z.string().optional(),
            percent: z.number().optional()
        })
    })
    .strict();
export type PriceInputRequest = z.infer<typeof priceInputRequest>;

export const orderMetadataInputRequest = z
    .object({
        key: z.string(),
        value: z.string()
    })
    .strict();
export type OrderMetadataInputRequest = z.infer<
    typeof orderMetadataInputRequest
>;

export const orderItemInputRequest = z
    .object({
        name: z.string(),
        sku: z.string().optional(),
        productId: z.string().optional(),
        productVairantId: z.string().optional(),
        imageUrl: z.string().optional(),
        quantity: z.number(),
        subscription: orderItemSubscriptionInput.optional(),
        subscriptionContractId: z.string().optional(),
        price: priceInputRequest.optional(),
        subTotal: priceInputRequest.optional(),
        meta: z.array(orderMetadataInputRequest).optional()
    })
    .strict();
export type OrderItemInputRequest = z.infer<typeof orderItemInputRequest>;

export const addressInputRequest = z
    .object({
        type: z.enum(['delivery', 'billing', 'other']),
        firstName: z.string().optional(),
        middleName: z.string().optional(),
        lastName: z.string().optional(),
        street: z.string().optional(),
        street2: z.string().optional(),
        streetNumber: z.string().optional(),
        postalCode: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional()
    })
    .strict();
export type AddressInputRequest = z.infer<typeof addressInputRequest>;

export const customerInputRequest = z
    .object({
        identifier: z.string().optional(),
        firstName: z.string().optional(),
        middleName: z.string().optional(),
        lastName: z.string().optional(),
        birthDate: z.date().optional(),
        companyName: z.string().optional(),
        taxNumber: z.string().optional(),
        addresses: z.array(addressInputRequest).optional()
    })
    .strict();
export type CustomerInputRequest = z.infer<typeof customerInputRequest>;

export const createOrderInputRequest = z
    .object({
        customer: customerInputRequest,
        cart: z.array(orderItemInputRequest),
        total: priceInputRequest.optional(),
        additionnalInformation: z.string().optional(),
        meta: z.array(orderMetadataInputRequest).optional(),
        createdAt: z.date().optional()
    })
    .strict();
export type CreateOrderInputRequest = z.infer<typeof createOrderInputRequest>;

export interface OrderConfirmation {
    id: string;
    createdAt: Date;
}
