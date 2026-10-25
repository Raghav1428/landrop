import { randomBytes, randomUUID } from 'node:crypto';
import type { ErrorCode, Identity, TransferState, FileState } from '@landrop/protocol';
import type { WebSocket } from 'ws';
export const secret=()=>randomBytes(32).toString('hex');
export const id=()=>randomUUID();
export class ApiFault extends Error { constructor(public status:number,public code:ErrorCode,message:string,public retryable=false){super(message);} }
export function fault(status:number,code:ErrorCode,message:string,retryable=false):never{throw new ApiFault(status,code,message,retryable);}
export interface Session extends Identity {id:string;token:string;csrfToken:string;expiresAt:number;roomId?:string;sockets:Set<WebSocket>;offlineAt:number;}
export interface Room {id:string;ownerId:string;code:string;secret:string;members:Set<string>;banned:Set<string>;locked:boolean;expiresAt:number;activity:number;revision:number;closed:boolean;}
export interface StoredFile {id:string;name:string;size:number;diskId:string;state:FileState;committedBytes:number;hashes:string[];fullHash?:string;downloadRequested:boolean;}
export interface Transfer {id:string;roomId:string;senderId:string;recipientId:string;kind:'files'|'text';byteLength:number;state:TransferState;createdAt:number;expiresAt:number;progressAt:number;files:StoredFile[];text?:string;reserved:boolean;revoked:boolean;cleanupPending:boolean;retryAt:number;cleanupAttempts:number;ingressBytes:number;acknowledgedBytes:number;servedBytes:number;verificationMs:number;startedAt?:number;finishedAt?:number;handles:Set<{destroy:(error?:Error)=>unknown}>;}
export class Store {sessions=new Map<string,Session>();rooms=new Map<string,Room>();transfers=new Map<string,Transfer>();diskReserved=0;textReserved=0;stopping=false;}
