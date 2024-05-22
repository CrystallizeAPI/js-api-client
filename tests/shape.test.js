const { createClient, createShapeBrowser } = require('../dist/index.js');
const fs = require('node:fs');

test('core next shape query building', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'frntr',
    });
    const browser = createShapeBrowser(CrystallizeClient);
    console.log(browser);
    const query = await browser.query('voucher');
    fs.writeFile('/tmp/plop.graphql', query, (err) => {
        if (err) {
            console.error(err);
        } else {
            // file written successfully
        }
    });
});
