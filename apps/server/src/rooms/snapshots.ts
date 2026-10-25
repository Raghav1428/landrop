import type { Snapshot } from '@landrop/protocol';
import type { Room, Session } from '../core/store';
import type { Rooms } from './service';
export function snapshot(rooms:Rooms,r:Room,s:Session):Snapshot {
  return {id:r.id,revision:r.revision,ownerId:r.ownerId,locked:r.locked,expiresAt:r.expiresAt,members:[...rooms.store.sessions.values()].filter(m=>r.members.has(m.id)).map(m=>({id:m.id,name:m.name,device:m.device,online:m.sockets.size>0&&m.expiresAt>rooms.now(),owner:m.id===r.ownerId})),transfers:[],aggregate:{members:r.members.size,transfers:0,acknowledgedBytes:0},...(r.ownerId===s.id?{invitation:{code:r.code,secret:r.secret}}:{})};
}
