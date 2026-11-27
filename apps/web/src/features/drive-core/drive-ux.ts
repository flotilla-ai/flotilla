export type OutlineEntry={level:number;text:string;line:number};
export function markdownOutline(text:string):OutlineEntry[]{
 return text.split('\n').flatMap((line,i)=>{const m=/^(#{1,6})\s+(.+?)\s*$/.exec(line);return m?[{level:m[1].length,text:m[2],line:i+1}]:[]});
}
/** Tiny line diff: common prefix, then removed/added tails. Enough for compare-two-versions review. */
export function simpleDiff(a:string,b:string):string{
 const x=a.split(/(?<=\n)/),y=b.split(/(?<=\n)/);let n=0;while(n<x.length&&n<y.length&&x[n]===y[n])n++;
 return [...x.slice(n).filter(Boolean).map(l=>`-${l.replace(/\n$/,'')}`),...y.slice(n).filter(Boolean).map(l=>`+${l.replace(/\n$/,'')}`)].join('\n');
}
