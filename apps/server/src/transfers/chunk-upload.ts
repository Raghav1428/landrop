import { createHash } from 'node:crypto';
import type { FastifyInstance,FastifyRequest } from 'fastify';
import { LIMITS,hashSchema } from '@landrop/protocol';
import { fault } from '../core/store';
import type { Transfers } from './service';
import type { Disk } from '../storage/filesystem';
import type { Locks } from '../core/locks';
import { authorize } from './authorization';
import { csrf } from '../security/csrf';
import { uploadStatus } from './upload-status';
export type FileParams={transferId:string;fileId:string;index:string};
export function chunkRoutes(app:FastifyInstance,service:Transfers,disk:Disk,locks:Locks){
  app.addContentTypeParser('application/octet-stream',{parseAs:'buffer',bodyLimit:LIMITS.chunkBytes},(_req,body,done)=>done(null,body));
  let active=0;const admitted=new WeakSet<FastifyRequest>();
  app.addHook('onResponse',async req=>{if(admitted.delete(req))active--;});
  app.put<{Params:FileParams}>('/api/transfers/:transferId/files/:fileId/chunks/:index',{bodyLimit:LIMITS.chunkBytes,onRequest:async req=>{const {s,t}=authorize(req,service,req.params.transferId);csrf(req,s);service.writable(t,s);service.file(t,req.params.fileId);if(active>=LIMITS.uploads)fault(503,'UNAVAILABLE','Host upload slots busy',true);active++;admitted.add(req);}},async req=>{
    const {s,t}=authorize(req,service,req.params.transferId);const f=service.file(t,req.params.fileId);const body=req.body;if(!Buffer.isBuffer(body))fault(415,'VALIDATION','Use application/octet-stream');t.ingressBytes+=body.length;
    const hash=hashSchema.parse(req.headers['x-chunk-sha256']);const index=Number(req.params.index);if(!/^\d+$/.test(req.params.index)||!Number.isSafeInteger(index)||index>=Math.ceil(f.size/LIMITS.chunkBytes))fault(400,'VALIDATION','Invalid chunk index');
    const expected=Math.min(LIMITS.chunkBytes,f.size-index*LIMITS.chunkBytes);if(body.length!==expected)fault(400,'VALIDATION','Incorrect chunk length');if(createHash('sha256').update(body).digest('hex')!==hash)fault(422,'INTEGRITY','Chunk checksum mismatch');
    return locks.run(f.diskId,async()=>{service.writable(t,s);if(index<f.hashes.length){if(f.hashes[index]!==hash)fault(409,'CONFLICT','Conflicting replay');return uploadStatus(f);}if(index!==f.hashes.length)fault(409,'CONFLICT','Out-of-order chunk');if(!['queued','uploading'].includes(f.state))fault(409,'CONFLICT','File not writable');t.startedAt??=service.mono();await disk.append(f,body);service.writable(t,s);f.committedBytes+=body.length;f.hashes.push(hash);f.state='uploading';t.acknowledgedBytes+=body.length;t.state='transferring';if(t.files.every(f=>f.committedBytes===f.size))t.finishedAt=service.mono();service.progress(t);return uploadStatus(f);});
  });
  app.get<{Params:FileParams}>('/api/transfers/:transferId/files/:fileId/status',async req=>{const {t}=authorize(req,service,req.params.transferId);return uploadStatus(service.file(t,req.params.fileId));});
}
