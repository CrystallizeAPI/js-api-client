import { z } from 'zod';
import { EnumType } from 'json-to-graphql-query';

export const addressInputRequest = z
    .object({
        type: z.enum(['delivery', 'billing', 'other']).transform((val) => new EnumType(val)),
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
        email: z.string().optional(),
        meta: z.array(z.object({ key: z.string(), value: z.string().optional() })).optional(),
    })
    .strict();
export type AddressInputRequest = z.infer<typeof addressInputRequest>;

export type Address = AddressInputRequest;
