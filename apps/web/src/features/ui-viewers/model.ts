export type ViewerKind='markdown'|'csv'|'xlsx'|'html'|'image'|'pdf'|'video'|'audio'|'model3d'|'cad'|'gcode'|'word'|'text'|'unknown';
export type ViewerDecision={kind:ViewerKind;sourceToggle:boolean;tooLarge:boolean};
export const textCapBytes=2*1024*1024;
const byExt:Record<string,ViewerKind>={md:'markdown',markdown:'markdown',csv:'csv',xlsx:'xlsx',xls:'xlsx',html:'html',htm:'html',png:'image',jpg:'image',jpeg:'image',gif:'image',webp:'image',svg:'image',pdf:'pdf',mp4:'video',webm:'video',mov:'video',mp3:'audio',wav:'audio',ogg:'audio',stl:'model3d',obj:'model3d',step:'cad',stp:'cad',gcode:'gcode',nc:'gcode',doc:'word',docx:'word',txt:'text',log:'text'};
export function viewerFor(name:string,sizeBytes:number,mime=''):ViewerDecision{const ext=name.split('.').pop()?.toLowerCase()??'';const kind=byExt[ext]??(mime.startsWith('image/')?'image':mime.startsWith('audio/')?'audio':mime.startsWith('video/')?'video':'unknown');const texty=['markdown','csv','html','gcode','text'].includes(kind);return{kind,sourceToggle:texty,tooLarge:texty&&sizeBytes>textCapBytes}}
export function parseCsv(text:string):string[][]{return text.trimEnd().split(/\r?\n/).map(line=>{const out:string[]=[];let cur='';let q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(q&&ch==='"'&&line[i+1]==='"'){cur+='"';i++}else if(ch==='"')q=!q;else if(ch===','&&!q){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out})}
export function sortRows(rows:string[][],column:number,dir:'asc'|'desc'='asc'):string[][]{if(!rows.length)return rows;const [head,...body]=rows;const sorted=[...body].sort((a,b)=>(a[column]??'').localeCompare(b[column]??'',undefined,{numeric:true})*(dir==='asc'?1:-1));return[head,...sorted]}
export type DiffToken={text:string;changed:boolean};
export function wordDiff(a:string,b:string):{left:DiffToken[];right:DiffToken[]}{const aw=a.split(/(\s+)/),bw=b.split(/(\s+)/);const aset=new Set(aw),bset=new Set(bw);return{left:aw.map(text=>({text,changed:!bset.has(text)&&!!text.trim()})),right:bw.map(text=>({text,changed:!aset.has(text)&&!!text.trim()}))}}
export type Theme={id:string;name:string;builtIn:boolean;vars:Record<string,string>};
export const builtInThemes:Theme[]=[{id:'light',name:'Light',builtIn:true,vars:{bg:'#fff',fg:'#111'}},{id:'dark',name:'Dark',builtIn:true,vars:{bg:'#111',fg:'#eee'}}];
export function validateCustomTheme(t:Theme):Theme{if(!t.id.trim()||!t.name.trim())throw new Error('theme needs id and name');for(const [k,v] of Object.entries(t.vars))if(!/^#[0-9a-f]{3,8}$/i.test(v))throw new Error(`invalid color for ${k}`);return{...t,builtIn:false}}
export type AppearancePrefs={themeId:string;codeFontSize:number;scrollNewMessages:boolean};
export function normalizeAppearance(x:Partial<AppearancePrefs>):AppearancePrefs{const size=Number(x.codeFontSize??13);if(size<9||size>32)throw new Error('code font size must be 9..32');return{themeId:String(x.themeId??'light'),codeFontSize:size,scrollNewMessages:!!x.scrollNewMessages}}

export function applyAppearanceToDocument(prefs:Partial<AppearancePrefs>,doc:Document,themes:Theme[]=builtInThemes):void{
 const themeId=String(prefs.themeId??'light');const theme=themes.find(x=>x.id===themeId)??{vars:{bg:'#181818',fg:'#f4f4f4'}};doc.documentElement.dataset.theme=themeId;for(const[k,v]of Object.entries(theme.vars))doc.documentElement.style.setProperty(`--${k}`,v);
 const size=Number(prefs.codeFontSize??13);if(size>=9&&size<=32)doc.documentElement.style.setProperty('--code-font-size',`${size}px`);
}
export function storedAppearance(storage?:Pick<Storage,'getItem'>):Partial<AppearancePrefs>{try{return{themeId:(storage??globalThis.localStorage)?.getItem('flotilla.theme')??'light',codeFontSize:Number((storage??globalThis.localStorage)?.getItem('flotilla.codeFontSize')??13),scrollNewMessages:(storage??globalThis.localStorage)?.getItem('flotilla.scrollNewMessages')==='true'}}catch{return{themeId:'light'}}}

export type ExploreItem={id:string;kind:'plugin'|'skill'|'theme';name:string;popular:number;stack:string[];private:boolean};
export function exploreList(items:ExploreItem[],stack:string[]=[]){const pub=items.filter(x=>!x.private);return{popular:[...pub].sort((a,b)=>b.popular-a.popular),recommended:pub.filter(x=>x.stack.some(s=>stack.includes(s)))}}
export type SettingEntry={path:string;title:string;keywords:string[]};
export function searchSettings(entries:SettingEntry[],query:string):SettingEntry[]{const q=query.trim().toLowerCase();return q?entries.filter(x=>[x.path,x.title,...x.keywords].join(' ').toLowerCase().includes(q)):entries}
export function settingsMap(entries:SettingEntry[]):Record<string,SettingEntry[]>{const out:Record<string,SettingEntry[]>={};for(const x of entries){const k=x.path.split('/')[1]??'general';(out[k]??=[]).push(x)}return out}
export function markdownTwin(path:string,mode:'extension'|'query'|'accept'):string{const clean=path.replace(/\.html$/,'');return mode==='extension'?`${clean}.md`:mode==='query'?`${clean}?format=md`:clean}
export function docsContentType(accept:string):'markdown'|'html'{return accept.toLowerCase().includes('text/markdown')?'markdown':'html'}
export function terminalLinks(text:string):{text:string;href?:string}[]{return text.split(/(https?:\/\/[^\s]+)/g).map(part=>part.startsWith('http')?{text:part,href:part}:{text:part})}
export function findInTerminal(lines:string[],query:string):number[]{const q=query.toLowerCase();return lines.map((x,i)=>x.toLowerCase().includes(q)?i:-1).filter(x=>x>=0)}
export function exitLineClass(code:number):'exit-ok'|'exit-failed'|''{return code===0?'exit-ok':code?'exit-failed':''}
export function waveformLevels(samples:number[],buckets=20):number[]{if(!samples.length)return[];const n=Math.max(1,Math.min(buckets,samples.length));return Array.from({length:n},(_,i)=>{const slice=samples.slice(Math.floor(i*samples.length/n),Math.floor((i+1)*samples.length/n)||i+1);return Math.max(...slice.map(Math.abs))})}
export type PinnedNote={id:string;point:[number,number,number];body:string};
export function addPinnedNote(notes:PinnedNote[],note:PinnedNote):PinnedNote[]{if(!note.body.trim())throw new Error('note needs text');if(note.point.some(x=>!Number.isFinite(x)))throw new Error('note point must be finite');return[...notes.filter(x=>x.id!==note.id),note]}
export function singleHtmlPage(title:string,body:string):string{const safeTitle=title.replace(/[<&>]/g,'');return`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>body{font-family:system-ui;margin:2rem;background:#fafafa;color:#111}.page{max-width:960px;margin:auto}</style></head><body><main class="page">${body}</main></body></html>`}
export function responsivePwaMeta():string{return'<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111111">'}
