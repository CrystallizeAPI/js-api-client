import { test } from 'vitest';
import { createClient, createShapeBrowser } from '../src';
// import fs from 'fs'

test('core next shape query building', async () => {
    const CrystallizeClient = createClient({
        tenantIdentifier: 'frntr',
    });
    const browser = createShapeBrowser(CrystallizeClient);
    // @TODO: Add a test for the query building if we keep that Shape Browser
    // console.log(browser);
    // const query = await browser.query('voucher');
    // fs.writeFile('/tmp/plop.graphql', query, (err) => {
    //     if (err) {
    //         console.error(err);
    //     } else {
    //         // file written successfully
    //     }
    // });
});
