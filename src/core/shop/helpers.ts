import { CartInput } from '@crystallize/schema/shop';
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
        addresses:
            input?.addresses?.map((address) => ({
                ...address,
                type: new EnumType(address.type),
            })) ?? [],
    };
};
