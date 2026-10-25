import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { hashSchema,LIMITS } from '@landrop/protocol';
import type { FastifyInstance } from 'fastify';
import type { Transfers } from './service';
import type { Disk } from '../storage/filesystem';
import { Gate,type Locks } from '../core/locks';
import { fault } from '../core/store';
import { authorize } from './authorization';
import { uploadStatus } from './upload-status';
import type { FileParams } from './chunk-upload';
export function finalizeRoutes(app:FastifyInstance,service:Transfers,disk:Disk,locks:Locks){const gate=new Gate(LIMITS.verifications);app.post<{Params:FileParams}>('/api/transfers/:transferId/files/:fileId/finalize',async req=>{const {s,t}=authorize(req,service,req.params.transferId);if(s.id!==t.senderId)fault(403,'FORBIDDEN','Sender action only');const f=service.file(t,req.params.fileId);const {sha256}=z.object({sha256:hashSchema}).strict().parse(req.body);return locks.run(f.diskId,async()=>{service.get(t.id,s);if(f.state==='ready'){if(f.fullHash!==sha256)fault(409,'CONFLICT','Different finalize digest');return uploadStatus(f);}service.writable(t,s);if(f.committedBytes!==f.size)fault(409,'CONFLICT','File incomplete');return gate.run(async()=>{await disk.ensure(f);if((await stat(disk.path(f))).size!==f.size)fault(409,'CONFLICT','Stored size differs');service.writable(t,s);f.state='verifying';t.state='transferring';service.progress(t);const start=service.mono();const stream=createReadStream(disk.path(f),{highWaterMark:65536});t.handles.add(stream);const hash=createHash('sha256');try{for await(const data of stream){service.get(t.id,s);hash.update(data);}service.writable(t,s);if(hash.digest('hex')!==sha256){f.state='failed';service.revoke(t,'failed');fault(422,'INTEGRITY','Full-file checksum mismatch');}f.fullHash=sha256;f.state='ready';t.verificationMs+=Math.max(0,service.mono()-start);if(t.files.every(f=>f.state==='ready'))service.complete(t);else service.progress(t);return uploadStatus(f);}finally{t.handles.delete(stream);stream.destroy();}});});});}
