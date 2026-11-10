import {readFile, readdir, realpath, lstat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const exists = async p => {try {await lstat(p); return true;} catch {return false;}};
export const hash = text => createHash('sha256').update(text).digest('hex');
async function localFile(root, name) {
  const target = path.resolve(root, name);
  if (!target.startsWith(root + path.sep)) throw new Error('Path escapes project.');
  if ((await lstat(target)).isSymbolicLink()) throw new Error('Symlink files are not supported.');
  const resolved = await realpath(target);
  if (!resolved.startsWith(root + path.sep)) throw new Error('Path escapes project.');
  return target;
}
function envKeys(text) {return [...text.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map(m=>m[1]);}
export async function doctor(directory) {
  const root = await realpath(directory), findings = [], patches = [];
  const add = (id, title, detail, severity='warning') => findings.push({id,title,detail,severity});
  const names = await readdir(root);
  const locks = ['package-lock.json','yarn.lock','pnpm-lock.yaml','bun.lock','bun.lockb'].filter(n=>names.includes(n));
  if (locks.length > 1) add('mixed-lockfiles','Multiple package manager lockfiles',locks.join(', '));
  if (names.includes('package.json')) {
    const pkg = JSON.parse(await readFile(await localFile(root,'package.json'),'utf8'));
    if (!locks.length) add('no-lockfile','No package manager lockfile','Commit a lockfile for reproducible CI installs.');
    if (!pkg.engines?.node && !names.includes('.nvmrc') && !names.includes('.node-version')) add('node-version','Node version is not documented','Declare engines.node or a runtime version file.');
    for (const script of ['test','build']) if (!pkg.scripts?.[script]) add(`script-${script}`,`No ${script} script`,`Check whether this project needs a ${script} script.`,'info');
    for (const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})) if (/^(?:\*|latest)$/.test(version)) add('floating-version',`Unbounded dependency: ${name}`,'Choose a compatible version and retain the lockfile.');
  }
  if (names.includes('.env.example')) {
    const required = envKeys(await readFile(await localFile(root,'.env.example'),'utf8'));
    const defined = names.includes('.env') ? envKeys(await readFile(await localFile(root,'.env'),'utf8')) : [];
    const missing = [...new Set(required)].filter(k=>!defined.includes(k));
    if (missing.length) add('env-missing','Missing environment variable declarations',missing.join(', '));
  }
  const ignorePath = path.join(root,'.gitignore');
  const ignore = names.includes('.gitignore') ? await readFile(await localFile(root,'.gitignore'),'utf8') : '';
  // Only a narrow, reviewable patch is automatic. Never invent secret values.
  const exact = ignore.split(/\r?\n/).map(s=>s.trim());
  if (!exact.includes('.env') && !exact.includes('/.env')) {
    add('env-ignore','Local .env is not explicitly ignored','Add .env to .gitignore; already tracked files require separate review.');
    patches.push({id:'ignore-env',file:'.gitignore',before:ignore,after:ignore+(ignore&&!ignore.endsWith('\n')?'\n':'')+'\n# Local credentials\n.env\n.env.local\n',beforeHash:hash(ignore),exists:names.includes('.gitignore')});
  }
  // Bounded scan; skip dependencies, build output, VCS, secrets and symlinks.
  let scanned = 0;
  async function walk(dir, depth=0) {
    if (depth>5 || scanned>=500) return;
    for (const e of await readdir(dir,{withFileTypes:true})) {
      if (scanned>=500) return;
      if (e.isSymbolicLink() || e.name.startsWith('.') || ['node_modules','dist','build','vendor','coverage'].includes(e.name)) continue;
      const full=path.join(dir,e.name);
      if (e.isDirectory()) {await walk(full,depth+1); continue;}
      if (!/\.(?:[cm]?[jt]sx?|py|ya?ml|json|md|sh)$/.test(e.name)) continue;
      scanned++;
      const stat=await lstat(full); if(stat.size>256*1024) continue;
      const data=await readFile(full,'utf8');
      const conflict=data.split(/\r?\n/).findIndex(s=>/^<{7} |^>{7} /.test(s));
      if(conflict>=0) add('conflict-marker','Unresolved conflict marker',`${path.relative(root,full)}:${conflict+1}`,'error');
    }
  }
  await walk(root);
  return {root,findings,patches,scanned,limits:'Scans up to 500 source files, depth 5, 256 KiB per file. It does not validate secret values or execute project scripts.'};
}
export async function applyPatch(root, patch) {
  if(patch.id!=='ignore-env' || patch.file!=='.gitignore') throw new Error('Unsupported patch.');
  root=await realpath(root);
  const target=path.join(root,patch.file), present=await exists(target);
  if(present!==patch.exists) throw new Error('File changed since preview.');
  const before=present?await readFile(await localFile(root,patch.file),'utf8'):'';
  if(hash(before)!==patch.beforeHash) throw new Error('File changed since preview.');
  const expected=before+(before&&!before.endsWith('\n')?'\n':'')+'\n# Local credentials\n.env\n.env.local\n';
  if(patch.after!==expected) throw new Error('Patch content mismatch.');
  if(present) await writeFile(target+'.devrescue.backup',before,{flag:'wx',mode:0o600});
  await writeFile(target,patch.after,{flag:present?'w':'wx'});
  return {file:target,backup:present?target+'.devrescue.backup':null};
}
