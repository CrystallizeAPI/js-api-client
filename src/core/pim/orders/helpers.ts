import {
    CreateCustomerInput,
    RegisterOrderInput,
    UpdateCustomerInput,
    UpdateOrderInput,
} from '@crystallize/schema/pim';
import { EnumType } from 'json-to-graphql-query';
import { transformCustomerInput } from '../customers/helpers.js';

/** Transform the ENUM for JSON GraphQL Query */
export const transformOrderInput = (input: Partial<RegisterOrderInput | UpdateOrderInput>) => {
    return {
        ...input,
        ...(input.customer && {
            customer: transformCustomerInput(input.customer),
        }),
        ...(input.cart && {
            cart: input.cart.map((item) => ({
                ...item,
                ...(item.subscription && {
                    subscription: {
                        ...item.subscription,
                        ...(item.subscription.unit && { unit: new EnumType(item.subscription.unit) }),
                        ...(item.subscription.start && { start: item.subscription.start.substring(0, 10) }),
                        ...(item.subscription.end && { end: item.subscription.end.substring(0, 10) }),
                    },
                }),
            })),
        }),
        ...(input.payment && {
            payment: input.payment.map((payment) => ({
                ...payment,
                provider: new EnumType(payment.provider),
            })),
        }),
    };
};
