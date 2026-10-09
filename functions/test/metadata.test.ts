import { isPrivateOrBlockedHost } from '../src/metadata/fetcher';

describe('SSRF Protection Rules', () => {
  test('blocks loopback and localhost variants', () => {
    expect(isPrivateOrBlockedHost('localhost')).toBe(true);
    expect(isPrivateOrBlockedHost('foo.localhost')).toBe(true);
    expect(isPrivateOrBlockedHost('127.0.0.1')).toBe(true);
    expect(isPrivateOrBlockedHost('::1')).toBe(true);
    expect(isPrivateOrBlockedHost('0.0.0.0')).toBe(true);
  });

  test('blocks RFC 1918 private IPv4 networks', () => {
    expect(isPrivateOrBlockedHost('10.0.0.1')).toBe(true);
    expect(isPrivateOrBlockedHost('10.255.255.255')).toBe(true);
    expect(isPrivateOrBlockedHost('172.16.0.1')).toBe(true);
    expect(isPrivateOrBlockedHost('172.31.255.255')).toBe(true);
    expect(isPrivateOrBlockedHost('192.168.1.1')).toBe(true);
    expect(isPrivateOrBlockedHost('192.168.0.254')).toBe(true);
  });

  test('blocks cloud metadata endpoint and link-local address', () => {
    expect(isPrivateOrBlockedHost('169.254.169.254')).toBe(true);
    expect(isPrivateOrBlockedHost('metadata.google.internal')).toBe(true);
  });

  test('allows public internet hostnames', () => {
    expect(isPrivateOrBlockedHost('example.com')).toBe(false);
    expect(isPrivateOrBlockedHost('instagram.com')).toBe(false);
    expect(isPrivateOrBlockedHost('nytimes.com')).toBe(false);
    expect(isPrivateOrBlockedHost('github.com')).toBe(false);
  });
});
