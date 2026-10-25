import type { FastifyInstance } from 'fastify';
import type { Transfers } from '../transfers/service';
import type { Cleanup } from './cleanup';
import type { Locks } from '../core/locks';
import { sweep } from './scheduler';
export function lifecycle(app:FastifyInstance,service:Transfers,cleanup:Cleanup,locks:Locks,schedule=true){app.addHook('preHandler',async()=>sweep(service,cleanup));const timer=schedule?setInterval(()=>sweep(service,cleanup),1000):undefined;timer?.unref();app.addHook('preClose',async()=>{if(timer)clearInterval(timer);service.rooms.store.stopping=true;for(const r of service.rooms.store.rooms.values())service.rooms.close(r);for(const t of service.rooms.store.transfers.values())service.revoke(t);await locks.drain();await cleanup.drain();});}
