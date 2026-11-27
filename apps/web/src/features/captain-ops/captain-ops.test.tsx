import{expect,it}from'vitest';import React from'react';import{renderToStaticMarkup}from'react-dom/server';import{CaptainDigestPanel}from'./index.js';
it('renders digest tab structure',()=>{expect(renderToStaticMarkup(<CaptainDigestPanel captainId=''/>)).toContain('Digest')});
