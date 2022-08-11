import { z } from 'zod';

export type CatalogueFetcherGrapqhqlOnItem = {
    onTopic?: any;
};

export type CatalogueFetcherGrapqhqlOnProduct = {
    onDefaultVariant?: any;
    onVariant?: any;
    onPriceVariant?: any;
};

export type CatalogueFetcherGrapqhqlOnDocument = {};

export type CatalogueFetcherGrapqhqlOnSubscriptionPlan = {
    onPeriod: (name: string) => any;
};

export type CatalogueFetcherGrapqhqlOnFolder = {
    onChildren?: any;
};

export type CatalogueFetcherGrapqhqlOnComponent = {};

export const componentType = z
    .enum([
        'Boolean',
        'ComponentChoice',
        'ContentChunk',
        'Datetime',
        'File',
        'GridRelations',
        'Image',
        'ItemRelations',
        'Location',
        'Numeric',
        'ParagraphCollection',
        'PropertiesTable',
        'RichText',
        'Selection',
        'SingleLine',
        'Video',
    ])
    .transform((value) => `${value}Content`);

export type ComponentType = z.infer<typeof componentType>;
