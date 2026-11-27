import{createHash,verify as verifySignature}from'node:crypto';import{chmod,mkdir,readFile,rm,symlink,writeFile,appendFile,access}from'node:fs/promises';import{join,resolve}from'node:path';
export interface DockInstall{version:string;base:string;home:string;binDir:string;noModifyPath:boolean;allowRoot:boolean;privileged:boolean;shellRc?:string}
export interface DockCommandResult{ok:boolean;command:string;exitCode:number;stdout:string;stderr:string;verbose?:string}
export interface DockDirectory{path:string;remote?:string}
export interface DeviceRevocation{revoked:boolean;requiresPairing:boolean;reason:string}
export interface ReleaseManifest{version:string;sha256:string;team?:string;signature:string}
const sha=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const clean=(v:string)=>v.trim().replace(/^~/,process.env.HOME??'/tmp');
export function installOptions(env:Record<string,string|undefined>,flags:Record<string,unknown>={},platform=process.platform):DockInstall{
 const version=String(env.FLOTILLA_DOCK_VERSION??env.CAPY_DOCK_VERSION??'0.0.0');if(!/^\d+\.\d+\.\d+[-+0-9A-Za-z.]*$/.test(version))throw new Error('invalid dock version');
 const home=clean(String(env.FLOTILLA_DOCK_HOME??env.CAPY_DOCK_HOME??join(process.env.HOME??'/tmp','.flotilla')));
 const base=clean(String(env.FLOTILLA_DOCK_BASE??env.CAPY_DOCK_BASE??home));
 const binDir=clean(String(env.FLOTILLA_BIN_DIR??env.CAPY_BIN_DIR??join(home,'bin')));
 const noModifyPath=flags['no-modify-path']===true||env.FLOTILLA_NO_MODIFY_PATH==='1'||env.CAPY_NO_MODIFY_PATH==='1';
 const allowRoot=flags['allow-root']===true||env.FLOTILLA_DOCK_ALLOW_ROOT==='1'||env.CAPY_DOCK_ALLOW_ROOT==='1';
 const privileged=typeof process.getuid==='function'?process.getuid()===0:false;
 if(privileged&&!allowRoot)throw new Error(platform==='win32'?'refusing to install as Administrator':'refusing to install as root; use a dedicated OS user');
 return{version,base,home,binDir,noModifyPath,allowRoot,privileged,shellRc:flags.shellRc?String(flags.shellRc):undefined};
}
const shellQuote=(v:string)=>`'${v.replace(/'/g,`'\\''`)}'`;
export function verifyRelease(manifest:ReleaseManifest,artifact:Buffer,publicKey:string,platform:NodeJS.Platform=process.platform,expectedTeam=process.env.FLOTILLA_CODESIGN_TEAM){
 if(manifest.sha256!==sha(artifact))throw new Error('artifact sha256 mismatch');
 if(platform==='darwin'&&(!expectedTeam||manifest.team!==expectedTeam))throw new Error('macOS codesign team mismatch');
 const unsigned={version:manifest.version,sha256:manifest.sha256,team:manifest.team};
 if(!verifySignature(null,Buffer.from(JSON.stringify(unsigned)),publicKey,Buffer.from(manifest.signature,'base64')))throw new Error('signed manifest verification failed');
 return{ok:true,version:manifest.version};
}
export async function installLayout(o:DockInstall,binary=Buffer.from('#!/bin/sh\necho flotilla-runner\n')){
 const dir=join(o.base,'dock-install',o.version);await mkdir(dir,{recursive:true});await mkdir(o.binDir,{recursive:true});
 const target=join(dir,'flotilla-runner');await writeFile(target,binary);await chmod(target,0o755);const link=join(o.binDir,'flotilla-runner');await rm(link,{force:true});await symlink(target,link);
 let rcTouched=false;if(!o.noModifyPath&&o.shellRc){const line=`export PATH=${shellQuote(o.binDir)}:$PATH`;const prior=await readFile(o.shellRc,'utf8').catch(()=> '');if(!prior.includes(line)){await appendFile(o.shellRc,`\n${line}\n`);rcTouched=true}}
 return{target,link,rcTouched};
}
const dirsFile=(home:string)=>join(home,'dirs.json');
export async function readDockDirs(home:string):Promise<DockDirectory[]>{try{return JSON.parse(await readFile(dirsFile(home),'utf8'))}catch{return[]}}
export async function writeDockDirs(home:string,dirs:DockDirectory[]){await mkdir(home,{recursive:true});await writeFile(dirsFile(home),JSON.stringify(dirs,null,2));return dirs}
export async function addDockDir(home:string,path:string,remote?:string){if(!path.startsWith('/')&&!/^[A-Za-z]:[\\/]/.test(path))throw new Error('dock dir must be absolute');const p=resolve(path);const dirs=await readDockDirs(home);if(!dirs.some(x=>x.path===p))dirs.push({path:p,...(remote?{remote}:{})});return writeDockDirs(home,dirs)}
export async function removeDockDir(home:string,path:string){const p=resolve(path);return writeDockDirs(home,(await readDockDirs(home)).filter(x=>x.path!==p))}
export function enforceSingleOsUser(state:{owner?:string},user:string){if(state.owner&&state.owner!==user)throw new Error('one dock device per OS user; use a dedicated account on shared servers');return{owner:user}}
export function revocationFromHeartbeat(status:number):DeviceRevocation{if(status===401||status===403)return{revoked:true,requiresPairing:true,reason:'device was revoked; next foreground run must pair again'};if(status>=200&&status<300)return{revoked:false,requiresPairing:false,reason:'device active'};return{revoked:false,requiresPairing:false,reason:`heartbeat status ${status}`}}
export async function dockCommand(command:string,o:{home:string;binDir:string;version:string;verbose?:boolean}):Promise<DockCommandResult>{
 const verbose=o.verbose?`home=${o.home} bin=${o.binDir} version=${o.version}`:undefined;
 if(command==='version')return{ok:true,command,exitCode:0,stdout:o.version,stderr:'',verbose};
 if(command==='dirs')return{ok:true,command,exitCode:0,stdout:JSON.stringify(await readDockDirs(o.home)),stderr:'',verbose};
 if(command==='status'||command==='doctor'||command==='verify'){
  const checks=[]as string[];for(const p of[join(o.binDir,'flotilla-runner'),dirsFile(o.home)]){try{await access(p);checks.push(`ok ${p}`)}catch{checks.push(`missing ${p}`)}}
  const bad=checks.filter(x=>x.startsWith('missing'));return{ok:bad.length===0,command,exitCode:bad.length?1:0,stdout:checks.join('\n'),stderr:bad.join('\n'),verbose};
 }
 return{ok:false,command,exitCode:2,stdout:'',stderr:'unknown dock command',verbose};
}
