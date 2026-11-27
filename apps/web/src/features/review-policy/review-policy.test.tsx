import {expect,it} from 'vitest';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {ReviewContextPanel} from './index.js';
it('review context page renders rules, files and ignore paths sections',()=>{const html=renderToStaticMarkup(<ReviewContextPanel repo=''/>);expect(html).toContain('Review context');expect(html).toContain('No review context');});
