import type { FastifyInstance, FastifyRequest } from 'fastify';
import { identitySchema, LIMITS } from '@landrop/protocol';
import { type Store, type Session, fault, id, secret } from '../core/store';
import type { Config } from '../config';
import { csrf } from './csrf';
import type { RateLimits } from './rate-limits';
export function session(req:FastifyRequest,store:Store,now:()=>number):Session {const token=req.cookies.landrop;const s=token?store.sessions.get(token):undefined;if(!s||s.expiresAt<=now())fault(401,'UNAUTHENTICATED','Session missing or expired');return s;}
export function sessionDto(s:Session){return {id:s.id,name:s.name,device:s.device,csrfToken:s.csrfToken,expiresAt:s.expiresAt,roomId:s.roomId};}
export function sessionRoutes(app:FastifyInstance,store:Store,c:Config,now:()=>number,rates:RateLimits){
  app.get('/api/session',async req=>sessionDto(session(req,store,now)));
  app.post('/api/session',async(req,reply)=>{
    if(!req.headers['content-type']?.startsWith('application/json'))return reply.code(415).send({error:{code:'VALIDATION',message:'Use application/json',retryable:false}});
    const data=identitySchema.parse(req.body);const token=req.cookies.landrop;let s=token?store.sessions.get(token):undefined;
    if(s&&s.expiresAt>now())csrf(req,s);else{rates.hit(`bootstrap:${req.ip}`,20);if(store.sessions.size>=c.maxSessions)fault(503,'CAPACITY','Session capacity reached');s={...data,id:id(),token:secret(),csrfToken:secret(),expiresAt:now()+LIMITS.sessionMs,sockets:new Set(),offlineAt:now()};store.sessions.set(s.token,s);}
    Object.assign(s,data);reply.setCookie('landrop',s.token,{httpOnly:true,sameSite:'strict',secure:Boolean(c.tlsKey),path:'/',maxAge:Math.max(0,Math.floor((s.expiresAt-now())/1000))});return sessionDto(s);
  });
}
