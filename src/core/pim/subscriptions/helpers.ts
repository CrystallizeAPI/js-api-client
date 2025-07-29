import { CreateSubscriptionContractInput, UpdateSubscriptionContractInput } from '@crystallize/schema/pim';
import { EnumType } from 'json-to-graphql-query';

/** Transform the ENUM for JSON GraphQL Query */
export const transformSubscriptionContractInput = (
    input: Partial<CreateSubscriptionContractInput | UpdateSubscriptionContractInput>,
) => {
    return {
        ...input,
        ...(input.addresses && {
            addresses: input.addresses?.map((address) => ({
                ...address,
                type: new EnumType(address.type),
            })),
        }),
        ...(input.payment && {
            payment: {
                ...input.payment,
                provider: new EnumType(input.payment.provider),
            },
        }),
        ...(input.initial && {
            initial: {
                ...input.initial,
                ...(input.initial.unit && { unit: new EnumType(input.initial.unit) }),
                ...(input.initial.meteredVariables && {
                    meteredVariables: input.initial.meteredVariables.map((meteredVariable) => ({
                        ...meteredVariable,
                        tierType: new EnumType(meteredVariable.tierType),
                    })),
                }),
            },
        }),
        ...(input.recurring && {
            recurring: {
                ...input.recurring,
                ...(input.recurring.unit && { unit: new EnumType(input.recurring.unit) }),
                ...(input.recurring.meteredVariables && {
                    meteredVariables: input.recurring.meteredVariables.map((meteredVariable) => ({
                        ...meteredVariable,
                        tierType: new EnumType(meteredVariable.tierType),
                    })),
                }),
            },
        }),
    };
};
