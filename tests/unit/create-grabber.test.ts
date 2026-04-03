import { describe, test, expect, vi } from 'vitest';
import { createGrabber } from '../../src/core/client/create-grabber.js';

describe('createGrabber (fetch mode)', () => {
    test('returns grab and close functions', () => {
        const grabber = createGrabber();
        expect(typeof grabber.grab).toBe('function');
        expect(typeof grabber.close).toBe('function');
    });

    test('grab delegates to fetch with correct options', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({ data: 'test' }),
            text: () => Promise.resolve('{"data":"test"}'),
        };
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

        const { grab } = createGrabber();
        const response = await grab('https://api.test.com/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{"query":"{ test }"}',
        });

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.test.com/graphql',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"query":"{ test }"}',
            }),
        );
        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json).toEqual({ data: 'test' });

        fetchSpy.mockRestore();
    });

    test('passes signal to fetch for abort support', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
            json: () => Promise.resolve({}),
            text: () => Promise.resolve('{}'),
        };
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);
        const controller = new AbortController();

        const { grab } = createGrabber();
        await grab('https://api.test.com', { signal: controller.signal });

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.test.com',
            expect.objectContaining({
                signal: controller.signal,
            }),
        );

        fetchSpy.mockRestore();
    });

    test('close is callable without error', () => {
        const { close } = createGrabber();
        expect(() => close()).not.toThrow();
    });

    test('propagates fetch errors', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

        const { grab } = createGrabber();
        await expect(grab('https://api.test.com')).rejects.toThrow('Network failure');

        fetchSpy.mockRestore();
    });
});
