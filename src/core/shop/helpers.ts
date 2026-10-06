import { AddressInput, CartInput, CustomerWithIdentifierInput, OrderFromCartInput } from '@crystallize/schema/shop';
import { EnumType } from 'json-to-graphql-query';

/** Transform the ENUM for JSON GraphQL Query */
export const transformCartInput = (input: Partial<CartInput>) => {
    return {
        ...input,
        ...(input.customer && {
            customer: {
                ...transformCartCustomerInput(input.customer),
            },
        }),
    };
};

export const transformCartCustomerInput = (input: Partial<CartInput['customer']>) => {
    return {
        ...input,
        isGuest: input?.isGuest || false,
        type: new EnumType(input?.type || 'individual'),
        ...(input?.birthDate && { birthDate: input.birthDate.toISOString() }),
        addresses:
            input?.addresses?.map((address) => ({
                ...address,
                type: new EnumType(address.type),
            })) ?? [],
    };
};

export const transformOrderFromCartInput = (input: OrderFromCartInput) => {
    return {
        ...input,
        ...(input.type && { type: new EnumType(input.type) }),
        ...(input.paymentStatus && { paymentStatus: new EnumType(input.paymentStatus) }),
    };
};

export const transformAddressInput = (input: AddressInput) => {
    return {
        ...input,
        ...(input.type && { type: new EnumType(input.type) }),
    };
};

export const transformShopCustomerInput = (input: CustomerWithIdentifierInput) => {
    return {
        ...input,
        ...(input.type && { type: new EnumType(input.type) }),
        ...(input.birthDate && { birthDate: input.birthDate.toISOString() }),
        ...(input.addresses && { addresses: input.addresses.map(transformAddressInput) }),
    };
};
