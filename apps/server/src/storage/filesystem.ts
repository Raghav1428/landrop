import { mkdir,readdir,readFile,writeFile,lstat,unlink,open } from 'node:fs/promises';
import { join,resolve,parse } from 'node:path';
import { payloadPath,recognized } from './paths';
import type { StoredFile } from '../core/store';
export class Disk {
  constructor(readonly root:string){}
  async init(){if(resolve(this.root)===parse(resolve(this.root)).root)throw new Error('Storage root cannot be filesystem root');await mkdir(this.root,{recursive:true,mode:0o700});if((await lstat(this.root)).isSymbolicLink())throw new Error('Storage root cannot be a symlink');const marker=join(this.root,'.landrop-owned-v1');const entries=await readdir(this.root);if(!entries.includes('.landrop-owned-v1')){if(entries.length)throw new Error('Refusing nonempty unowned storage directory');await writeFile(marker,'LANDrop temporary storage v1\n',{flag:'wx',mode:0o600});}else if((await lstat(marker)).isSymbolicLink()||await readFile(marker,'utf8')!=='LANDrop temporary storage v1\n')throw new Error('Invalid storage ownership marker');for(const name of entries)if(recognized.test(name)&&(await lstat(join(this.root,name))).isFile())await unlink(join(this.root,name));}
  path(f:StoredFile){return payloadPath(this.root,f.diskId);}
  async file(f:StoredFile){try{return await open(this.path(f),'r+');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return open(this.path(f),'wx+',0o600);}}
  async append(f:StoredFile,data:Buffer){const handle=await this.file(f);try{let written=0;while(written<data.length){const result=await handle.write(data,written,data.length-written,f.committedBytes+written);if(!result.bytesWritten)throw new Error('Short write');written+=result.bytesWritten;}await handle.sync();}catch(e){try{await handle.truncate(f.committedBytes);}catch{f.state='failed';}throw e;}finally{await handle.close();}}
  async ensure(f:StoredFile){const handle=await this.file(f);await handle.close();}
  async remove(f:StoredFile){try{await unlink(this.path(f));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
}
