import type { FastifyInstance } from 'fastify';
import { offerSchema } from '@landrop/protocol';
import type { Transfers } from './service';
import { session } from '../security/sessions';
import { authorize } from './authorization';
import { transferDto } from '../metrics/service';
export function transferRoutes(app:FastifyInstance,service:Transfers){app.post<{Params:{roomId:string}}>('/api/rooms/:roomId/offers',async req=>{const s=session(req,service.rooms.store,service.rooms.now);return transferDto(service.create(req.params.roomId,s,offerSchema.parse(req.body)),s,service.mono);});app.get<{Params:{transferId:string}}>('/api/transfers/:transferId',async req=>{const {s,t}=authorize(req,service,req.params.transferId);return transferDto(t,s,service.mono);});for(const action of ['accept','reject','cancel'] as const)app.post<{Params:{transferId:string}}>(`/api/transfers/:transferId/${action}`,async req=>{const {s,t}=authorize(req,service,req.params.transferId,true);return transferDto(service.decide(t,s,action),s,service.mono);});app.delete<{Params:{transferId:string}}>('/api/transfers/:transferId',async req=>{const {t}=authorize(req,service,req.params.transferId,true);service.revoke(t);return {revoked:true,cleanupPending:t.cleanupPending};});}
