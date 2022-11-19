const { pricesForUsageOnTier } = require('../dist/index.js');

const tiers1 = [
    {
        threshold: 0,
        price: 0,
        currency: 'EUR',
    },
    {
        threshold: 2,
        price: 250,
        currency: 'EUR',
    },
    {
        threshold: 20,
        price: 20,
        currency: 'EUR',
    },
];

const tiers2 = [
    {
        threshold: 15,
        price: 500,
        currency: 'EUR',
    },
    {
        threshold: 40,
        price: 100,
        currency: 'EUR',
    },
    {
        threshold: 30,
        price: 300,
        currency: 'EUR',
    },
];

const tiers3 = [
    {
        threshold: 0,
        price: 5,
        currency: 'EUR',
    },
    {
        threshold: 3,
        price: 4,
        currency: 'EUR',
    },
    {
        threshold: 15,
        price: 3,
        currency: 'EUR',
    },
    {
        threshold: 25,
        price: 2,
        currency: 'EUR',
    },
    {
        threshold: 50,
        price: 1,
        currency: 'EUR',
    },
];

const tiers4 = [
    {
        threshold: 15,
        price: 3,
        currency: 'EUR',
    },
    {
        threshold: 25,
        price: 2,
        currency: 'EUR',
    },
    {
        threshold: 50,
        price: 1,
        currency: 'EUR',
    },
];

const tiers5 = [
    {
        threshold: 75,
        price: 3,
        currency: 'EUR',
    },
    {
        threshold: 25,
        price: 2,
        currency: 'EUR',
    },
    {
        threshold: 50,
        price: 1,
        currency: 'EUR',
    },
];

test('Price For Volume', () => {
    expect(pricesForUsageOnTier(0, tiers1, 'volume')).toEqual({ EUR: 0 });
    expect(pricesForUsageOnTier(2, tiers1, 'volume')).toEqual({ EUR: 500 });
    expect(pricesForUsageOnTier(3, tiers1, 'volume')).toEqual({ EUR: 750 });
    expect(pricesForUsageOnTier(20, tiers1, 'volume')).toEqual({ EUR: 400 });
    expect(pricesForUsageOnTier(40, tiers1, 'volume')).toEqual({ EUR: 800 });

    expect(pricesForUsageOnTier(3, tiers2, 'volume')).toEqual({ EUR: 0 });
    expect(pricesForUsageOnTier(14, tiers2, 'volume')).toEqual({ EUR: 0 });
    expect(pricesForUsageOnTier(15, tiers2, 'volume')).toEqual({ EUR: 7500 });
    expect(pricesForUsageOnTier(16, tiers2, 'volume')).toEqual({ EUR: 8000 });
    expect(pricesForUsageOnTier(30, tiers2, 'volume')).toEqual({ EUR: 9000 });
    expect(pricesForUsageOnTier(31, tiers2, 'volume')).toEqual({ EUR: 9300 });
    expect(pricesForUsageOnTier(40, tiers2, 'volume')).toEqual({ EUR: 4000 });
    expect(pricesForUsageOnTier(41, tiers2, 'volume')).toEqual({ EUR: 4100 });
    expect(pricesForUsageOnTier(131, tiers2, 'volume')).toEqual({ EUR: 13100 });
});

test('Price For Graduated', () => {
    expect(pricesForUsageOnTier(4, tiers3, 'graduated')).toEqual({ EUR: 19 });
    expect(pricesForUsageOnTier(211, tiers3, 'graduated')).toEqual({ EUR: 368 });
    expect(pricesForUsageOnTier(14, tiers4, 'graduated')).toEqual({ EUR: 0 });
    expect(pricesForUsageOnTier(15, tiers5, 'graduated')).toEqual({ EUR: 0 });
    expect(pricesForUsageOnTier(25, tiers5, 'graduated')).toEqual({ EUR: 2 });
});
