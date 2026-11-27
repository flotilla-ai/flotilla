import {describe,expect,it} from 'vitest';
import {isFeedback} from './index.js';
describe('needs-you feedback cards',()=>{
 it('routes feedback drafts to their thread instead of dead generic actions',()=>{
  expect(isFeedback({id:'a',threadId:'t',question:'q',kind:'decision',detail:{feedback:{title:'x'}}})).toBe(true);
  expect(isFeedback({id:'a',threadId:'t',question:'q',kind:'budget',detail:null})).toBe(false);
 });
});
