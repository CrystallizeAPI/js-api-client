import { z } from 'zod';
import { Address, addressInputRequest } from './address';

export const orderCustomerInputRequest = z
    .object({
        identifier: z.string().optional(),
        firstName: z.string().optional(),
        middleName: z.string().optional(),
        lastName: z.string().optional(),
        birthDate: z.date().optional(),
        companyName: z.string().optional(),
        taxNumber: z.string().optional(),
        addresses: z.array(addressInputRequest).optional(),
    })
    .strict();
export type OrderCustomerInputRequest = z.infer<typeof orderCustomerInputRequest>;

export type OrderCustomer = Omit<OrderCustomerInputRequest, 'addresses'> & {
    addresses: Address[];
};

export const createCustomerInputRequest = orderCustomerInputRequest
    .extend({
        tenantId: z.string().optional(),
        lastName: z.string(),
        firstName: z.string(),
        phone: z.string().optional(),
        meta: z
            .array(
                z.object({
                    key: z.string(),
                    value: z.string().optional(),
                }),
            )
            .optional(),
        identifier: z.string().optional(),
        externalReferences: z
            .array(
                z.object({
                    key: z.string(),
                    value: z.string().optional(),
                }),
            )
            .optional(),
        email: z.string(),
    })
    .strict();
export type CreateCustomerInputRequest = z.infer<typeof createCustomerInputRequest>;

export const updateCustomerInputRequest = createCustomerInputRequest.omit({ identifier: true, tenantId: true });
export type UpdateCustomerInputRequest = z.infer<typeof updateCustomerInputRequest>;

export type Customer = Omit<CreateCustomerInputRequest, 'addresses'> & {
    addresses: Address[];
};
