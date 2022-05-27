// Usage CRYSTALLIZE_ACCESS_TOKEN_ID=xxx CRYSTALLIZE_ACCESS_TOKEN_SECRET=xxx CRYSTALLIZE_TENANT_IDENTIFIER=xxx node dist/examples/dump-tenant.js

import { CrystallizeClient } from '../';
import { createDumper } from '../core/dump-tenant/dumper';
import { createMassCallClient, CrystallizePromise, MassCallClientBatch } from '../core/massCallClient';
import fs from 'fs';

const onFailure = async (
    batch: MassCallClientBatch,
    exception: any,
    promise: CrystallizePromise<any>,
): Promise<boolean> => {
    console.log(`Failure in batch from ${batch.from} to ${batch.to}: ${exception.message}`);
    return true;
};

const client = createMassCallClient(CrystallizeClient, {
    initialSpawn: 5000,
    maxSpawn: 10000,
    onFailure,
});

async function run() {
    const dumper = createDumper(client, { tenantIdentifier: 'furniture' });
    const spec = await dumper.dump();
    try {
        fs.writeFileSync('./plopnew.spec.json', JSON.stringify(spec));
    } catch (err) {
        console.error(err);
    }
}
run();
