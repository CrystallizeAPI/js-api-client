import { test, expect } from 'vitest';
import { pricesForUsageOnTier } from '../src';

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
    expect(pricesForUsageOnTier(2, tiers1, 'volume')).toEqual({ EUR: 0 }); // 2 are still free
    expect(pricesForUsageOnTier(3, tiers1, 'volume')).toEqual({ EUR: 250 }); // we pay for 1
    expect(pricesForUsageOnTier(20, tiers1, 'volume')).toEqual({ EUR: 360 }); // 20$ bracket but 2 free
    expect(pricesForUsageOnTier(40, tiers1, 'volume')).toEqual({ EUR: 760 }); // 20$ bracket but 2 free
    expect(pricesForUsageOnTier(3, tiers2, 'volume')).toEqual({ EUR: 0 });
    expect(pricesForUsageOnTier(14, tiers2, 'volume')).toEqual({ EUR: 0 });
    expect(pricesForUsageOnTier(15, tiers2, 'volume')).toEqual({ EUR: 0 });
    expect(pricesForUsageOnTier(16, tiers2, 'volume')).toEqual({ EUR: 500 });
    expect(pricesForUsageOnTier(30, tiers2, 'volume')).toEqual({ EUR: 4500 });
    expect(pricesForUsageOnTier(31, tiers2, 'volume')).toEqual({ EUR: 4800 });
    expect(pricesForUsageOnTier(40, tiers2, 'volume')).toEqual({ EUR: 2500 });
    expect(pricesForUsageOnTier(41, tiers2, 'volume')).toEqual({ EUR: 2600 });
    expect(pricesForUsageOnTier(131, tiers2, 'volume')).toEqual({ EUR: 11600 });
});

test('Price For Graduated', () => {
    expect(pricesForUsageOnTier(4, tiers3, 'graduated')).toEqual({ EUR: 19 });
    expect(pricesForUsageOnTier(211, tiers3, 'graduated')).toEqual({ EUR: 304 });
    expect(pricesForUsageOnTier(14, tiers4, 'graduated')).toEqual({ EUR: 0 });
    expect(pricesForUsageOnTier(15, tiers5, 'graduated')).toEqual({ EUR: 0 });
    expect(pricesForUsageOnTier(25, tiers5, 'graduated')).toEqual({ EUR: 0 });
    expect(pricesForUsageOnTier(26, tiers5, 'graduated')).toEqual({ EUR: 2 });
});

test('Test 3/21/2024 - with existing minimum', () => {
    const tiers = [
        {
            threshold: 0,
            price: 0,
            currency: 'EUR',
        },
        {
            threshold: 10,
            price: 5,
            currency: 'EUR',
        },
        {
            threshold: 30,
            price: 3,
            currency: 'EUR',
        },
    ];
    expect(pricesForUsageOnTier(42, tiers, 'graduated')).toEqual({ EUR: 136 });
    expect(pricesForUsageOnTier(42, tiers, 'volume')).toEqual({ EUR: 96 });
});

test('Test 3/21/2024 - without existing minimum', () => {
    const tiers = [
        {
            threshold: 10,
            price: 5,
            currency: 'EUR',
        },
        {
            threshold: 30,
            price: 3,
            currency: 'EUR',
        },
    ];
    expect(pricesForUsageOnTier(42, tiers, 'graduated')).toEqual({ EUR: 136 });
    expect(pricesForUsageOnTier(42, tiers, 'volume')).toEqual({ EUR: 96 });
});

test('Test 3/21/2024 - with many free tiers and existing minimum', () => {
    const tiers = [
        {
            threshold: 0,
            price: 0,
            currency: 'EUR',
        },
        {
            threshold: 2,
            price: 0,
            currency: 'EUR',
        },
        {
            threshold: 8,
            price: 0,
            currency: 'EUR',
        },
        {
            threshold: 10,
            price: 5,
            currency: 'EUR',
        },
        {
            threshold: 30,
            price: 3,
            currency: 'EUR',
        },
    ];
    expect(pricesForUsageOnTier(42, tiers, 'graduated')).toEqual({ EUR: 136 });
    expect(pricesForUsageOnTier(42, tiers, 'volume')).toEqual({ EUR: 96 });
});
