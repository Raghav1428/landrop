import type { WebSocket } from 'ws';
import type { Session, Room } from '../core/store';
import type { Rooms } from '../rooms/service';
export function attachPresence(socket:WebSocket,s:Session,r:Room,rooms:Rooms){s.sockets.add(socket);rooms.changed(r);let alive=true;socket.on('pong',()=>{alive=true;});socket.on('message',()=>socket.close(1008,'Notifications are server-only'));const heartbeat=setInterval(()=>{if(!alive||s.expiresAt<=rooms.now()||r.closed){socket.terminate();return;}alive=false;socket.ping();},15000);heartbeat.unref();socket.on('close',()=>{clearInterval(heartbeat);s.sockets.delete(socket);if(!s.sockets.size)s.offlineAt=rooms.now();rooms.changed(r);});socket.on('error',()=>socket.terminate());}
