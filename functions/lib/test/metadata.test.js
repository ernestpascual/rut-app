"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetcher_1 = require("../src/metadata/fetcher");
describe('SSRF Protection Rules', () => {
    test('blocks loopback and localhost variants', () => {
        expect((0, fetcher_1.isPrivateOrBlockedHost)('localhost')).toBe(true);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('foo.localhost')).toBe(true);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('127.0.0.1')).toBe(true);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('::1')).toBe(true);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('0.0.0.0')).toBe(true);
    });
    test('blocks RFC 1918 private IPv4 networks', () => {
        expect((0, fetcher_1.isPrivateOrBlockedHost)('10.0.0.1')).toBe(true);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('10.255.255.255')).toBe(true);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('172.16.0.1')).toBe(true);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('172.31.255.255')).toBe(true);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('192.168.1.1')).toBe(true);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('192.168.0.254')).toBe(true);
    });
    test('blocks cloud metadata endpoint and link-local address', () => {
        expect((0, fetcher_1.isPrivateOrBlockedHost)('169.254.169.254')).toBe(true);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('metadata.google.internal')).toBe(true);
    });
    test('allows public internet hostnames', () => {
        expect((0, fetcher_1.isPrivateOrBlockedHost)('example.com')).toBe(false);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('instagram.com')).toBe(false);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('nytimes.com')).toBe(false);
        expect((0, fetcher_1.isPrivateOrBlockedHost)('github.com')).toBe(false);
    });
});
//# sourceMappingURL=metadata.test.js.map