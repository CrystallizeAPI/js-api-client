import { EnumType } from 'json-to-graphql-query';
import { z } from 'zod';

const topicPathsFilterField = z
    .object({
        value: z.string(),
    })
    .strict();

const topicPathsFilterSection = z
    .object({
        logicalOperator: z.enum(['AND', 'OR']).transform((val) => new EnumType(val)),
        fields: z.array(topicPathsFilterField).optional(),
    })
    .strict();

const topicPathsFilter = z
    .object({
        logicalOperator: z.enum(['AND', 'OR']).transform((val) => new EnumType(val)),
        sections: z.array(topicPathsFilterSection),
    })
    .strict();

const priceRangeFilter = z
    .object({
        min: z.number(),
        max: z.number(),
    })
    .strict();

const stockFilter = z
    .object({
        min: z.number(),
        location: z.string().optional(),
    })
    .strict();

const stockLocationsFilter = z
    .object({
        min: z.number(),
        location: z.array(z.string()).optional(),
        logicalOperator: z.enum(['OR']),
    })
    .strict();

const itemFilterFields = z
    .object({
        itemIds: z.string().optional(),
        productVariantIds: z.string().optional(),
        skus: z.string().optional(),
        shapeIdentifiers: z.string().optional(),
        paths: z.string().optional(),
        topicsPaths: topicPathsFilter.optional(),
    })
    .strict();

const variantAttributeFilter = z
    .object({
        attribute: z.string(),
        value: z.string(),
    })
    .strict();

const productVariantsFilter = z.object({
    isDefault: z.boolean().optional(),
    priceRange: priceRangeFilter.optional(),
    stock: stockFilter.optional(),
    stockLocations: stockLocationsFilter.optional(),
    attributes: variantAttributeFilter.optional(),
});

export const catalogueSearchFilter = z.object({
    searchTerm: z.string().optional(),
    type: z
        .enum(['PRODUCT', 'FOLDER', 'DOCUMENT'])
        .transform((val) => new EnumType(val))
        .optional(),
    include: itemFilterFields.optional(),
    exclude: itemFilterFields.optional(),
    priceVariant: z.string().optional(),
    stockLocation: z.string().optional(),
    productVariants: productVariantsFilter.optional(),
});
export type CatalogueSearchFilter = z.infer<typeof catalogueSearchFilter>;

export const catalogueSearchOrderBy = z
    .object({
        field: z.enum(['ITEM_NAME', 'PRICE', 'STOCK', 'CREATED_AT']).transform((val) => new EnumType(val)),
        direction: z.enum(['ASC', 'DESC']).transform((val) => new EnumType(val)),
    })
    .strict();
export type CatalogueSearchOrderBy = z.infer<typeof catalogueSearchOrderBy>;
