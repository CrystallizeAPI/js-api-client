const { CrystallizeSubscriptionContractManager } = require('../dist/index.js');
test('catalogAPI: Test', async () => {
    try {
        const template =
            await CrystallizeSubscriptionContractManager.createSubscriptionContractTemplateBasedOnVariantIdentity(
                '/standard-crystal-customer',
                { id: '62eaf0a5f050cc86e5ded7b1' },
                'crystal-customer',
                '62eaf0535978d060e4604c83',
                'default',
                'en',
            );
        console.log(template);
    } catch (exception) {
        // nothing to do here, this is a test manual
    }
});
