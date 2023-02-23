export type CrystallizeSignature = {
    aud: 'webhook' | 'app' | 'frontend';
    sub: 'signature';
    iss: 'crystallize';
    exp: number; // Timestamp
    iat: number; // Timestamp
    userId?: string;
    tenantId: string;
    tenantIdentifier: string;
    hmac: string;
};
