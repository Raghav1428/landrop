import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { idSchema, joinSchema } from '@landrop/protocol';
import { session } from '../security/sessions';
import type { RateLimits } from '../security/rate-limits';
import type { Rooms } from './service';
import { snapshot } from './snapshots';
import { invitation } from './invitations';
export function roomRoutes(app:FastifyInstance,rooms:Rooms,rates:RateLimits){
  const who=(req:any)=>session(req,rooms.store,rooms.now);
  app.post('/api/rooms',async req=>{z.object({}).strict().parse(req.body);const s=who(req);return snapshot(rooms,rooms.create(s),s);});
  app.post('/api/rooms/join',async req=>{const s=who(req);rates.hit(`join:${s.id}`,12);const r=rooms.join(s,joinSchema.parse(req.body));return snapshot(rooms,r,s);});
  app.get<{Params:{roomId:string}}>('/api/rooms/:roomId',async req=>{const s=who(req);return snapshot(rooms,rooms.member(req.params.roomId,s),s);});
  for(const action of ['lock','rotate','remove','close','leave'])app.post<{Params:{roomId:string}}>(`/api/rooms/:roomId/${action}`,async req=>{const s=who(req);const r=action==='leave'?rooms.member(req.params.roomId,s):rooms.owner(req.params.roomId,s);if(action==='lock')r.locked=z.object({locked:z.boolean()}).strict().parse(req.body).locked;else if(action==='rotate')Object.assign(r,invitation());else if(action==='remove')rooms.remove(r,z.object({memberId:idSchema}).strict().parse(req.body).memberId);else if(action==='close')rooms.close(r);else rooms.remove(r,s.id);if(r.closed||!r.members.has(s.id))return {closed:true};rooms.touch(r);return snapshot(rooms,r,s);});
}
