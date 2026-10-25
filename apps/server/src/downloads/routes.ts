import { createReadStream } from 'node:fs';
import { Transform } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { Transfers } from '../transfers/service';
import type { Disk } from '../storage/filesystem';
import type { FileParams } from '../transfers/chunk-upload';
import { authorize } from '../transfers/authorization';
import { fault } from '../core/store';
import { attachment } from './filenames';
import { parseRange } from './ranges';
export function downloadRoutes(app:FastifyInstance,service:Transfers,disk:Disk){app.get<{Params:FileParams}>('/api/transfers/:transferId/files/:fileId/download',async(req,reply)=>{const {s,t}=authorize(req,service,req.params.transferId);if(s.id!==t.recipientId)fault(403,'FORBIDDEN','Receiver download only');const f=service.file(t,req.params.fileId);if(f.state!=='ready')fault(409,'CONFLICT','File not ready');const range=parseRange(req.headers.range,f.size);if(range==='invalid')return reply.code(416).header('Content-Range',`bytes */${f.size}`).send({error:{code:'RANGE',message:'Unsatisfiable single byte range',retryable:false}});const length=range?range.end-range.start+1:f.size;reply.header('Accept-Ranges','bytes').header('Content-Type','application/octet-stream').header('Content-Disposition',attachment(f.name)).header('Content-Length',length);if(range)reply.code(206).header('Content-Range',`bytes ${range.start}-${range.end}/${f.size}`);f.downloadRequested=true;service.progress(t);if(!length)return reply.send('');const source=createReadStream(disk.path(f),{...(range??{}),highWaterMark:65536});const meter=new Transform({transform(chunk,_encoding,callback){try{service.get(t.id,s);t.servedBytes+=chunk.length;callback(null,chunk);}catch(e){callback(e as Error);}}});t.handles.add(source);t.handles.add(meter);const clean=()=>{source.destroy();meter.destroy();t.handles.delete(source);t.handles.delete(meter);};reply.raw.on('close',clean);source.on('error',e=>meter.destroy(e));meter.on('error',()=>source.destroy());return reply.send(source.pipe(meter));});}
