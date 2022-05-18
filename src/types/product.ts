export interface Item {
    id: string;
    name?: string;
    path?: string;
    externalReference?: string;
}

export interface Product extends Item {
    vatType?: VatInfo;
    isVirtual?: boolean;
    isSubscriptionOnly?: boolean;
    variants?: ProductVariant[];
    defaultVariant?: ProductVariant;
}

export interface VatInfo {
    name?: string;
    percent?: number;
}
export interface KeyValuePair {
    key: string;
    value?: string;
}
export interface MetaProperty {
    key: string;
    value?: string;
}

export interface ProductVariant {
    id: string;
    name?: string;
    images?: Image[];
    firstImage?: Image;
    sku: string;
    price?: number; // shortcut to ProductPriceVariant[n].price
    priceVariants?: ProductPriceVariant[];
    stock?: number; // shortcut to stockLocations[n].stock
    stockLocations?: ProductStockLocation[];
    attributes?: ProductVariantAttribute[];
    externalReference?: string;
    isDefault?: boolean;
    subscriptionPlans?: ProductVariantSubscriptionPlan[];
}

export interface ProductPriceVariant {
    identifier: string;
    name?: string;
    price?: number;
    currency?: string;
}

export interface ProductStockLocation {
    identifier: string;
    name: string;
    stock: number;
    meta: KeyValuePair[];
}

export interface ProductVariantAttribute {
    attribute: string;
    value?: string;
}

export interface ProductVariantSubscriptionPlan {
    identifier: string;
    name?: string;
    periods: ProductVariantSubscriptionPlanPeriod[];
}

export interface ProductVariantSubscriptionPlanPeriod {
    id: string;
    name: string;
    initial?: ProductVariantSubscriptionPlanPricing;
    recurring?: ProductVariantSubscriptionPlanPricing;
}

export interface ProductVariantSubscriptionPlanPricing {
    period: number;
    unit: SubscriptionPeriodUnit;
    price?: number; //shortcut to ProductPriceVariant[n].price
    priceVariants?: ProductPriceVariant[];
    meteredVariables?: ProductVariantSubscriptionMeteredVariable[];
}
export interface ProductVariantSubscriptionMeteredVariable {
    id: string;
    name: string;
    identifier: string;
    tiers: ProductVariantSubscriptionPlanTier[];
    tierType: TierType;
}

export interface ProductVariantSubscriptionPlanTier {
    treshold: number;
    price?: number; //shortcut to ProductPriceVariant[n].price
    priceVariants?: ProductPriceVariant[];
}

export type SubscriptionPeriodUnit = 'day' | 'week' | 'month' | 'year';
export type TierType = 'volume' | 'graduated';

export interface Image {
    url: string;
    key: string;
    altText?: string;
    caption?: {
        json: any[];
        html: string[];
        plainText: string[];
    };
    meta?: MetaProperty[];
    metaProperty?: string; // shortcut to meta[n].value
    variants?: ImageVariant[];
    createdAt?: Date;
}

export interface ImageVariant {
    url: string;
    key: string;
    width: number;
    height?: number;
    size?: number;
}
