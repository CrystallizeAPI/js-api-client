export type Tier = {
    threshold: number;
    price: number;
    currency: string;
};

export type Prices = Record<string, number>;
