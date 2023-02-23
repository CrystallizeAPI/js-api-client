const { createSignatureVerifier } = require('../dist/index.js');
var crypto = require('crypto');

test('Test Signature HMAC', () => {
    const guard = createSignatureVerifier({
        secret: 'xXx',
        sha256: (data) => crypto.createHash('sha256').update(data).digest('hex'),
        jwtVerify: (token, secret) => ({
            hmac: '1101b34dac8c55e5590a37271f1c41c3d745463854613494a1624a15be24f1f8',
        }),
    });

    expect(
        guard('xXx.xXx.xXx', {
            url: 'https://a17e-2601-645-4500-330-b07d-351d-ece7-41c1.ngrok.io/test/signature',
            method: 'POST',
            body: '{"item":{"get":{"id":"63f2d3b2a94533f79fc6397b","createdAt":"2023-02-20T01:58:10.000Z","updatedAt":"2023-02-23T07:58:34.685Z","name":"test"}}}',
        }),
    );
});
