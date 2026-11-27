export type ShortcutAction = 'commandMenu'|'newThread'|'sidebar'|'rightPane'|'diffs'|'settings'|'jumpThread'|'stepThread'|'newShell'|'sideChat'|'newTab'|'threadUp'|'threadArchive'|'threadDone'|'commentMessage'|'annotate'|'modelFavorite';
export type ShortcutMap = Record<ShortcutAction,string>;
export const defaultShortcuts: ShortcutMap = {
 commandMenu:'mod+k',newThread:'mod+shift+o',sidebar:'mod+b',rightPane:'mod+shift+b',diffs:'mod+shift+g',settings:'mod+,',jumpThread:'alt+1..9',stepThread:'mod+alt+up/down',newShell:'ctrl+shift+`',sideChat:'mod+shift+s',newTab:'mod+t',threadUp:'u',threadArchive:'a',threadDone:'d',commentMessage:'mod+shift+m',annotate:'c',modelFavorite:'alt+1..9'
};
const comboRe=/^(?:(?:mod|ctrl|alt|shift)\+)*(?:[a-z0-9,`]|up|down|1\.\.9)(?:\/(?:up|down))?$/i;
export function normalizeCombo(combo:string,mac=false):string {
 const c=combo.trim().toLowerCase().replace('cmd','mod').replace('ctrl','ctrl').replace('option','alt');
 if(!comboRe.test(c)) throw new Error('invalid shortcut combination');
 return c;
}
export function remapShortcut(map:ShortcutMap,action:ShortcutAction,combo:string,mac=false):ShortcutMap {
 const normalized=normalizeCombo(combo,mac);
 const conflict=Object.entries(map).find(([k,v])=>k!==action&&v===normalized&&!String(normalized).includes('..'));
 if(conflict) throw new Error(`conflicts with ${conflict[0]}`);
 return {...map,[action]:normalized};
}
export function shortcutRows(map=defaultShortcuts): {action:ShortcutAction;combo:string}[] { return Object.entries(map).map(([action,combo])=>({action:action as ShortcutAction,combo})) }
export function keyEventAction(map:ShortcutMap,key:string,mods:{ctrl?:boolean;alt?:boolean;shift?:boolean;meta?:boolean},mac=false):ShortcutAction|undefined {
 const keyName=key.toLowerCase();
 const exact=[mods.ctrl?'ctrl':'',mods.alt?'alt':'',mods.shift?'shift':'',keyName].filter(Boolean).join('+');
 const generic=[(mac?mods.meta:mods.ctrl)?'mod':'',mods.alt?'alt':'',mods.shift?'shift':'',keyName].filter(Boolean).join('+');
 return (Object.entries(map) as [ShortcutAction,string][]).find(([,c])=>(c===exact||c===generic)&&!c.includes('..')&&!c.includes('/'))?.[0];
}
export function loadShortcuts(storage:Pick<Storage,'getItem'>|undefined,key='flotilla.shortcuts'):ShortcutMap {
 try{return {...defaultShortcuts,...JSON.parse(storage?.getItem(key)??'{}')}}catch{return defaultShortcuts}
}
export function saveShortcuts(storage:Pick<Storage,'setItem'>|undefined,map:ShortcutMap,key='flotilla.shortcuts'){storage?.setItem(key,JSON.stringify(map))}
