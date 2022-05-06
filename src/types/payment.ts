import { z } from 'zod';
import { EnumType } from 'json-to-graphql-query';

export const paymentProvider = z
    .enum(['klarna', 'stripe', 'paypal', 'cash', 'custom'])
    .transform((val) => new EnumType(val));
export type PaymentProvider = z.infer<typeof paymentProvider>;

// Klarna
export const klarnaPaymentInputRequest = z
    .object({
        klarna: z.string().optional(),
        orderId: z.string().optional(),
        recurringToken: z.string().optional(),
        status: z.string().optional(),
        merchantReference1: z.string().optional(),
        merchantReference2: z.string().optional(),
        metadata: z.string().optional(),
    })
    .strict();
export type KlarnaPaymentInputRequest = z.infer<typeof klarnaPaymentInputRequest>;

// Paypal
export const paypalPaymentInputRequest = z
    .object({
        paypal: z.string().optional(),
        orderId: z.string().optional(),
        subscriptionId: z.string().optional(),
        invoiceId: z.string().optional(),
        metadata: z.string().optional(),
    })
    .strict();
export type PaypalPaymentInputRequest = z.infer<typeof paypalPaymentInputRequest>;

// Stripe
export const stripePaymentInputRequest = z
    .object({
        stripe: z.string().optional(),
        customerId: z.string().optional(),
        orderId: z.string().optional(),
        paymentMethod: z.string().optional(),
        paymentMethodId: z.string().optional(),
        paymentIntentId: z.string().optional(),
        subscriptionId: z.string().optional(),
        metadata: z.string().optional(),
    })
    .strict();
export type StripePaymentInputRequest = z.infer<typeof stripePaymentInputRequest>;

// Cash
export const cashPaymentInputRequest = z
    .object({
        cash: z.string().optional(),
    })
    .strict();
export type CashPaymentInputRequest = z.infer<typeof cashPaymentInputRequest>;

// Custom
export const customPaymentInputRequest = z
    .object({
        properties: z
            .array(
                z.object({
                    property: z.string(),
                    value: z.string().optional(),
                }),
            )
            .optional(),
    })
    .strict();
export type CustomPaymentInputRequest = z.infer<typeof customPaymentInputRequest>;

interface PaymentType {
    provider: PaymentProvider;
}

export type KlarnaPayment = PaymentType & Omit<KlarnaPaymentInputRequest, 'klarna'>;
export type PaypalPayment = PaymentType & Omit<PaypalPaymentInputRequest, 'paypal'>;
export type StripePayment = PaymentType & Omit<StripePaymentInputRequest, 'stripe'>;
export type CashPayment = PaymentType & CashPaymentInputRequest;
export type CustomPayment = PaymentType & CustomPaymentInputRequest;
