import { CreateCustomerInput, UpdateCustomerInput } from '@crystallize/schema/pim';
import { EnumType } from 'json-to-graphql-query';

/** Transform the ENUM for JSON GraphQL Query */
export const transformCustomerInput = (input: Partial<CreateCustomerInput | UpdateCustomerInput>) => {
    return {
        ...input,
        ...(input.type && { type: new EnumType(input.type) }),
        ...(input.parents && {
            parents: input.parents.map((parent) => ({
                ...parent,
                type: new EnumType(parent.type),
            })),
        }),
        ...(input.addresses && {
            addresses: input.addresses.map((address) => ({
                ...address,
                type: new EnumType(address.type),
            })),
        }),
    };
};
