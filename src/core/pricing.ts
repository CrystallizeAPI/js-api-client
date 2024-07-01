import { Prices, Tier } from '../types/pricing.js';

export function pricesForUsageOnTier(usage: number, tiers: Tier[], tierType: 'volume' | 'graduated'): Prices {
    const sortedTiers = tiers.sort((a: Tier, b: Tier) => a.threshold - b.threshold);
    // let's add the implicit tiers id it does not exists
    if (sortedTiers[0].threshold > 0) {
        sortedTiers.unshift({ threshold: 0, price: 0, currency: tiers[0].currency });
    }

    if (tierType === 'volume') {
        return volumeBasedPriceFor(Math.max(0, usage), sortedTiers);
    }
    return graduatedBasedPriceFor(usage, sortedTiers);
}

function volumeBasedPriceFor(usage: number, tiers: Tier[]): Prices {
    const freeUsage = tiers.reduce((memo: number, tier: Tier, tierIndex) => {
        if (tier.price === 0) {
            return tiers[tierIndex + 1]?.threshold || 0;
        }
        return memo;
    }, 0);
    const forCalculationUsage = Math.max(0, usage - freeUsage);
    const tiersLength = tiers.length;
    for (let i = tiersLength - 1; i >= 0; i--) {
        const tier: Tier = tiers[i];
        if (usage < tier.threshold && i > 0) {
            continue;
        }
        return { [tier.currency]: (usage >= tier.threshold ? tier.price || 0 : 0) * forCalculationUsage };
    }
    return { USD: 0.0 };
}

function graduatedBasedPriceFor(usage: number, tiers: Tier[]): Prices {
    let rest = usage;
    const splitUsage: Array<Tier & { usage: number }> = tiers.map((tier: Tier, tierIndex: number) => {
        const currentThreshold = tier.threshold;
        const nextThreshold = tiers[tierIndex + 1]?.threshold;
        const maxTierUsage = nextThreshold ? nextThreshold - currentThreshold : Infinity;
        const tierUsage = rest <= maxTierUsage ? rest : maxTierUsage;
        rest -= tierUsage;
        return {
            ...tier,
            usage: tierUsage,
        };
    });
    return splitUsage.reduce((memo: Prices, tier: Tier & { usage: number }) => {
        return {
            ...memo,
            [tier.currency]: (memo[tier.currency] || 0.0) + tier.usage * (tier.price || 0),
        };
    }, {});
}
