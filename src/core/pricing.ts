import { Prices, Tier } from '../types/pricing';

export function pricesForUsageOnTier(usage: number, tiers: Tier[], tierType: 'volume' | 'graduated'): Prices {
    const sortedTiers = [...tiers].sort((a: Tier, b: Tier) => a.threshold - b.threshold);

    if (tierType === 'volume') {
        return volumeBasedPriceFor(usage, sortedTiers);
    }
    return graduatedBasedPriceFor(usage, sortedTiers);
}

function volumeBasedPriceFor(usage: number, tiers: Tier[]): Prices {
    const tiersLength = tiers.length;

    for (let i = tiersLength - 1; i >= 0; i--) {
        const tier: Tier = tiers[i];
        if (usage < tier.threshold && i > 0) {
            continue;
        }
        // manage also an inexistent tier (threshold = 0)
        return { [tier.currency]: (usage >= tier.threshold ? tier.price : 0) * usage };
    }
    return { USD: 0.0 };
}

function graduatedBasedPriceFor(usage: number, tiers: Tier[]): Prices {
    let rest = usage;

    // manage also an inexistent tier (threshold = 0)
    if (tiers[0].threshold > 0) {
        rest = Math.max(0, rest - (tiers[0].threshold - 1));
    }

    const splitUsage: Array<Tier & { usage: number }> = tiers.map((tier: Tier, tierIndex: number) => {
        const limit = tiers[tierIndex + 1]?.threshold || Infinity;
        const tierUsage = rest > limit ? limit : rest;
        rest -= tierUsage;
        return {
            ...tier,
            usage: tierUsage,
        };
    });

    return splitUsage.reduce((memo: Prices, tier: Tier & { usage: number }) => {
        return {
            ...memo,
            [tier.currency]: (memo[tier.currency] || 0.0) + tier.usage * tier.price,
        };
    }, {});
}
