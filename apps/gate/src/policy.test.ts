import { describe, expect, it } from 'vitest';
import { allowedByList, decideConnect, isPublicIp } from './policy.js';

describe('egress policy', () => {
  it('matches exact and suffix names', () => {
    expect(allowedByList('api.github.com',['api.github.com'])).toBe(true);
    expect(allowedByList('a.example.com',['*.example.com'])).toBe(true);
    expect(allowedByList('example.com',['*.example.com'])).toBe(true);
    expect(allowedByList('badexample.com',['*.example.com'])).toBe(false);
  });
  it('rejects non-public resolved addresses', async () => {
    expect((await decideConnect('ok.test',{allow:['ok.test']},async()=>['93.184.216.34'])).allow).toBe(true);
    for (const ip of ['10.0.0.5','169.254.169.254','127.0.0.1','100.64.0.1','172.16.0.1','192.168.1.1']) {
      expect((await decideConnect('ok.test',{allow:['ok.test']},async()=>[ip])).allow).toBe(false);
    }
  });
  it('rejects non-allowlisted and mixed public/private resolution', async () => {
    expect((await decideConnect('no.test',{allow:['yes.test']},async()=>['8.8.8.8'])).reason).toBe('not-allowlisted');
    expect((await decideConnect('ok.test',{allow:['ok.test']},async()=>['8.8.8.8','10.0.0.5'])).reason).toBe('private-ip');
    expect(isPublicIp('fdaa::1')).toBe(false);
  });
});
