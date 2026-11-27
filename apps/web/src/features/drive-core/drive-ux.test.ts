import {describe,expect,it} from 'vitest';
import {markdownOutline,simpleDiff,utf8Text} from './drive-ux.js';
describe('drive ux helpers',()=>{
 it('CAPY-281: markdown outline lists headings with line numbers',()=>{
  expect(markdownOutline('# Title\ntext\n## Plan\n### Step')).toEqual([{level:1,text:'Title',line:1},{level:2,text:'Plan',line:3},{level:3,text:'Step',line:4}]);
 });
 it('CAPY-282: compare marks appended lines',()=>expect(simpleDiff('a\n','a\nb\n')).toBe('+b'));
 it('CAPY-281: invalid UTF-8 is rejected instead of being rewritten as replacement characters',()=>{expect(()=>utf8Text(new Uint8Array([255]))).toThrow();expect(utf8Text(new TextEncoder().encode('ok'))).toBe('ok')});
});
