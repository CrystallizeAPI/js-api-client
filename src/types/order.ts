import { EnumType } from 'json-to-graphql-query';
import { z } from 'zod';
import { OrderCustomer, orderCustomerInputRequest } from './customer';
import {
    CashPayment,
    cashPaymentInputRequest,
    CustomPayment,
    customPaymentInputRequest,
    KlarnaPayment,
    klarnaPaymentInputRequest,
    paymentProvider,
    PaypalPayment,
    paypalPaymentInputRequest,
    StripePayment,
    stripePaymentInputRequest,
} from './payment';
import { SubscriptionPeriodUnit, VatInfo } from './product';

export const orderItemMeteredVariableInputRequest = z
    .object({
        id: z.string(),
        usage: z.number(),
        price: z.number(),
    })
    .strict();
export type OrderItemMeteredVariableInputRequest = z.infer<typeof orderItemMeteredVariableInputRequest>;

export const orderItemSubscriptionInputRequest = z
    .object({
        name: z.string().optional(),
        period: z.number(),
        unit: z.enum(['minute', 'hour', 'day', 'week', 'month', 'year']).transform((val) => new EnumType(val)),
        start: z.date().optional(),
        end: z.date().optional(),
        meteredVariables: z.array(orderItemMeteredVariableInputRequest).optional(),
    })
    .strict();
export type OrderItemSubscriptionInputRequest = z.infer<typeof orderItemSubscriptionInputRequest>;

export const priceInputRequest = z
    .object({
        gross: z.number().optional(),
        net: z.number().optional(),
        currency: z.string(),
        discounts: z
            .array(
                z.object({
                    percent: z.number().optional(),
                }),
            )
            .optional(),
        tax: z.object({
            name: z.string().optional(),
            percent: z.number().optional(),
        }),
    })
    .strict();
export type PriceInputRequest = z.infer<typeof priceInputRequest>;

export const orderMetadataInputRequest = z
    .object({
        key: z.string(),
        value: z.string(),
    })
    .strict();
export type OrderMetadataInputRequest = z.infer<typeof orderMetadataInputRequest>;

export const orderItemInputRequest = z
    .object({
        name: z.string(),
        sku: z.string().optional(),
        productId: z.string().optional(),
        productVariantId: z.string().optional(),
        imageUrl: z.string().optional(),
        quantity: z.number(),
        subscription: orderItemSubscriptionInputRequest.optional(),
        subscriptionContractId: z.string().optional(),
        price: priceInputRequest.optional(),
        subTotal: priceInputRequest.optional(),
        meta: z.array(orderMetadataInputRequest).optional(),
    })
    .strict();
export type OrderItemInputRequest = z.infer<typeof orderItemInputRequest>;

export const paymentInputRequest = z
    .object({
        provider: paymentProvider,
        klarna: klarnaPaymentInputRequest.optional(),
        paypal: paypalPaymentInputRequest.optional(),
        stripe: stripePaymentInputRequest.optional(),
        cash: cashPaymentInputRequest.optional(),
        custom: customPaymentInputRequest.optional(),
    })
    .strict();
export type PaymentInputRequest = z.infer<typeof paymentInputRequest>;

export const updateOrderInputRequest = z
    .object({
        customer: orderCustomerInputRequest.optional(),
        cart: z.array(orderItemInputRequest).optional(),
        payment: z.array(paymentInputRequest).optional(),
        total: priceInputRequest.optional(),
        additionnalInformation: z.string().optional(),
        meta: z.array(orderMetadataInputRequest).optional(),
    })
    .strict();
export type UpdateOrderInputRequest = z.infer<typeof updateOrderInputRequest>;

export const createOrderInputRequest = updateOrderInputRequest
    .extend({
        customer: orderCustomerInputRequest,
        cart: z.array(orderItemInputRequest),
        createdAt: z.date().optional(),
    })
    .strict();
export type CreateOrderInputRequest = z.infer<typeof createOrderInputRequest>;

export interface OrderCreatedConfirmation {
    id: string;
    createdAt: Date;
}

export interface OrderUpdatedConfirmation {
    id: string;
    updatedAt: Date;
}

export interface Order {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    cart: OrderItem[];
    customer: OrderCustomer;
    payment?: Payment[];
    total?: Price;
    additionnalInformation?: string;
    meta?: OrderMetadata[];
}

export interface OrderItem {
    name: string;
    sku?: string;
    productId?: string;
    productVariantId?: string;
    imageUrl?: string;
    quantity: number;
    subscription?: OrderItemSubscription;
    subscriptionContractId?: string;
    price?: Price;
    subTotal?: Price;
    meta?: OrderMetadata[];
}
export type Payment = KlarnaPayment | PaypalPayment | StripePayment | CashPayment | CustomPayment;

export interface Price {
    gross?: number;
    net?: number;
    currency: string;
    discounts?: Discount[];
    tax?: Tax;
}

export type Tax = VatInfo;

export interface Discount {
    percent?: number;
}

export interface OrderMetadata {
    key: string;
    value?: string;
}

export interface OrderItemSubscription {
    name?: string;
    period: number;
    unit: OrderItemSubscriptionUnit;
    start?: Date;
    end?: Date;
    meteredVariables?: OrderItemSubscriptionMeteredVariable[];
}

export type OrderItemSubscriptionUnit = SubscriptionPeriodUnit | 'hour' | 'minute';

export interface OrderItemSubscriptionMeteredVariable {
    id: string;
    usage: number;
    price: number;
}
