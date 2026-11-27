import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

export interface ReviewPolicy { repo: string; pathScope: string; orgRules: string[]; contextFiles: string[]; ignorePaths: string[]; commitStatus: boolean }
export interface ReviewFile { path: string; diff: string; deleted?: boolean; generated?: boolean }
export interface ReviewGuide { id: string; repo: string; prNumber: number; overview: string; steps: string[]; chapters: { title: string; paths: string[]; diff: string }[]; diagram: string; skipped: string[] }
export interface ReviewEvidence { rules: string[]; memory: string[]; telemetry: string[] }
type Row = Record<string, any>;
const id=(p:string)=>`${p}_${randomBytes(8).toString('hex')}`;
const strings=(v:unknown,name:string)=>{if(!Array.isArray(v)||v.some(x=>typeof x!=='string'))throw new ApiFailure('ValidationFailed',`${name} must be a string array`);return v as string[]};
export function pathMatch(pattern:string,path:string):boolean{
 if(pattern.length>256||path.length>4096)throw new ApiFailure('ValidationFailed','glob pattern or path is too long');
 const memo=new Map<string,boolean>();
 const stateBudget=20000;
 const match=(pi:number,si:number):boolean=>{
  const key=`${pi}:${si}`;const cached=memo.get(key);if(cached!==undefined)return cached;
  let out=false;
  if(pi===pattern.length)out=si===path.length;
  else if(pattern.startsWith('**',pi)){
   let next=pi+2;while(pattern.startsWith('**',next))next+=2;
   out=match(next,si)||(si<path.length&&match(pi,si+1));
  }else if(pattern[pi]==='*')out=match(pi+1,si)||(si<path.length&&path[si]!=='/'&&match(pi,si+1));
  else out=si<path.length&&pattern[pi]===path[si]&&match(pi+1,si+1);
  memo.set(key,out);if(memo.size>stateBudget)throw new ApiFailure('ValidationFailed','glob pattern is too complex');return out;
 };
 return match(0,0);
}
export const generatedPath=(p:string)=>/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|poetry\.lock)$|\.(min\.js|pb\.go|generated\.ts)$/.test(p);
export function filterReviewFiles(files:ReviewFile[],ignorePaths:string[]){const skipped=new Set<string>();const included=files.filter(f=>{const skip=f.deleted===true||f.generated===true||generatedPath(f.path)||ignorePaths.some(p=>pathMatch(p,f.path));if(skip)skipped.add(f.path);return!skip});return{included,skipped:[...skipped]}}
export function filterScopedReviewFiles(files:ReviewFile[],policies:ReviewPolicy[]){const skippedSet=new Set<string>();const included=files.filter(f=>{let skip=f.deleted===true||f.generated===true||generatedPath(f.path);if(!skip){const ignores=policies.filter(p=>pathMatch(p.pathScope,f.path)).flatMap(p=>p.ignorePaths);skip=ignores.some(p=>pathMatch(p,f.path))}if(skip)skippedSet.add(f.path);return!skip});return{included,skipped:[...skippedSet]}}
export function agentsRuleFindings(agentsMd:string,files:ReviewFile[]){const rules=agentsMd.split('\n').map(x=>x.trim()).flatMap(x=>{const m=x.match(/^[-*]\s+(?:never|do not)\s+use\s+(.+?)(?:\s*[.;])?$/i);return m?[{rule:x,needle:m[1].trim()}]:[]});const out:{rule:string;file:string;body:string}[]=[];for(const f of files)for(const r of rules)if(r.needle&&f.diff.toLowerCase().includes(r.needle.toLowerCase()))out.push({rule:r.rule,file:f.path,body:`${f.path} appears to violate AGENTS.md: ${r.rule}`});return out}
export function stackBadge(branch:string,base='main'):'graphite'|'spr'|'manual-chain'|'none'{if(/^(gt\/|graphite\/)/.test(branch))return'graphite';if(/^(spr\/|spr-)/.test(branch))return'spr';if(!['main','master','trunk'].includes(base)&&base!==branch)return'manual-chain';return'none'}
export async function retryOnTimeout<T>(fn:()=>Promise<T>,retries=1,isTimeout=(e:unknown)=>/timeout/i.test(String((e as Error)?.message??e))):Promise<T>{for(let i=0;;i++){try{return await fn()}catch(e){if(i>=retries||!isTimeout(e))throw e}}}
const evidence=(v:unknown):ReviewEvidence=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new ApiFailure('ValidationFailed','evidence must be an object');const x=v as Row;return{rules:strings(x.rules??[],'evidence.rules'),memory:strings(x.memory??[],'evidence.memory'),telemetry:strings(x.telemetry??[],'evidence.telemetry')}};
const policy=(r:Row):ReviewPolicy=>({repo:r.repo,pathScope:r.path_scope,orgRules:r.org_rules??[],contextFiles:r.context_files??[],ignorePaths:r.ignore_paths??[],commitStatus:r.commit_status});
export class ReviewPolicyStore{
 constructor(readonly pool:pg.Pool){}
 private async q(sql:string,args:unknown[]=[]){return(await this.pool.query(sql,args)).rows as Row[]}
 async putPolicy(userId:string,repo:string,input:Row):Promise<ReviewPolicy>{if(!/^\S+\/\S+$/.test(repo))throw new ApiFailure('ValidationFailed','repo must be owner/repo');const scope=String(input.pathScope??'**');if(!scope||scope.length>256)throw new ApiFailure('ValidationFailed','pathScope must be 1-256 characters');const ignore=strings(input.ignorePaths??[],'ignorePaths');if(ignore.some(x=>!x||x.length>256))throw new ApiFailure('ValidationFailed','ignore paths must be 1-256 characters');const vals=[userId,repo,scope,JSON.stringify(strings(input.orgRules??[],'orgRules')),JSON.stringify(strings(input.contextFiles??[],'contextFiles')),JSON.stringify(ignore),input.commitStatus===true];await this.pool.query(`INSERT INTO review_policies (owner_id,repo,path_scope,org_rules,context_files,ignore_paths,commit_status) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (owner_id,repo,path_scope) DO UPDATE SET org_rules=$4,context_files=$5,ignore_paths=$6,commit_status=$7,updated_at=now()`,vals);return this.policy(userId,repo,scope)}
 async policy(userId:string,repo:string,scope='**'):Promise<ReviewPolicy>{const[r]=await this.q('SELECT * FROM review_policies WHERE owner_id=$1 AND repo=$2 AND path_scope=$3',[userId,repo,scope]);return r?policy(r):{repo,pathScope:scope,orgRules:[],contextFiles:[],ignorePaths:[],commitStatus:false}}
 async policies(userId:string,repo:string){return(await this.q('SELECT * FROM review_policies WHERE owner_id=$1 AND repo=$2 ORDER BY path_scope',[userId,repo])).map(policy)}
 async filter(userId:string,repo:string,files:ReviewFile[],pathScope?:string){if(pathScope!==undefined)return filterReviewFiles(files,(await this.policy(userId,repo,pathScope)).ignorePaths);return filterScopedReviewFiles(files,await this.policies(userId,repo))}
 async guide(userId:string,input:Row):Promise<ReviewGuide>{const repo=String(input.repo??'');const pr=Number(input.prNumber);if(!/^\S+\/\S+$/.test(repo)||!Number.isInteger(pr)||pr<1)throw new ApiFailure('ValidationFailed','repo and positive prNumber required');const files=(input.files??[])as ReviewFile[];if(!Array.isArray(files))throw new ApiFailure('ValidationFailed','files must be an array');const pols=await this.policies(userId,repo);const{included,skipped}=filterScopedReviewFiles(files,pols);const groups=new Map<string,ReviewFile[]>();for(const f of included){const key=f.path.includes('/')?f.path.split('/')[0]:'(root)';groups.set(key,[...(groups.get(key)??[]),f])}const chapters=[...groups].map(([title,xs])=>({title,paths:xs.map(x=>x.path),diff:xs.map(x=>x.diff).join('\n')}));const overview=`${included.length} reviewable files in ${chapters.length} areas; ${skipped.length} files skipped`;const steps=chapters.map((c,i)=>`Step ${i+1}: review ${c.title} (${c.paths.join(', ')})`);const diagram=`before -> ${chapters.map(c=>c.title).join(' -> ')||'empty change'} -> after`;const gid=id('rgd');await this.pool.query('INSERT INTO review_guides (id,owner_id,repo,pr_number,overview,steps,chapters,diagram) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[gid,userId,repo,pr,overview,JSON.stringify(steps),JSON.stringify(chapters),diagram]);return{id:gid,repo,prNumber:pr,overview,steps,chapters,diagram,skipped}}
 async attachEvidence(userId:string,findingId:string,input:unknown){const e=evidence(input);const[r]=await this.q(`UPDATE review_findings SET evidence=evidence||$3::jsonb,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING id,evidence`,[findingId,userId,JSON.stringify(e)]);if(!r)throw new ApiFailure('NotFound','review finding not found');return{id:r.id,evidence:r.evidence}}
 async evidence(userId:string,findingId:string){const[r]=await this.q('SELECT evidence FROM review_findings WHERE id=$1 AND owner_id=$2',[findingId,userId]);if(!r)throw new ApiFailure('NotFound','review finding not found');return r.evidence}
}
