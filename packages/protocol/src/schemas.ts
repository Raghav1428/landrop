import { z } from 'zod';
import { LIMITS, utf8Bytes } from './limits';
import { transferStates, fileStates } from './states';
export const idSchema = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const byteSize = (max: number) => z.number().int().min(0).max(max).refine(Number.isSafeInteger);
export const identitySchema = z.object({name:z.string().trim().min(1).max(40).refine(s=>!/[\x00-\x1f\x7f]/.test(s)), device:z.enum(['computer','phone','tablet','other'])}).strict();
export const fileMetaSchema = z.object({id:idSchema, name:z.string().min(1).max(255).refine(s=>s!=='.' && s!=='..' && !/[\\/\x00-\x1f\x7f]/.test(s)),size:byteSize(LIMITS.fileBytes)}).strict();
export const offerSchema = z.discriminatedUnion('kind', [z.object({kind:z.literal('files'), recipientId:idSchema,files:z.array(fileMetaSchema).min(1).max(LIMITS.files)}).strict(),z.object({kind:z.literal('text'),recipientId:idSchema,byteLength:byteSize(LIMITS.textBytes)}).strict()]).superRefine((v,ctx)=>{if(v.kind==='files'&&(v.files.reduce((n,f)=>n+f.size,0)>LIMITS.offerBytes||new Set(v.files.map(f=>f.id)).size!==v.files.length)) ctx.addIssue({code:'custom',message:'Offer size or duplicate file IDs'});});
export const textSchema = z.object({text:z.string().refine(s=>utf8Bytes(s)<=LIMITS.textBytes,'Text exceeds UTF-8 byte limit')}).strict();
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const joinSchema = z.union([z.object({code:z.string().regex(/^[A-HJ-NP-Z2-9]{10}$/)}).strict(),z.object({roomId:idSchema,secret:z.string().regex(/^[a-f0-9]{64}$/)}).strict()]);
export const sessionSchema = identitySchema.extend({id:idSchema, csrfToken:z.string(), expiresAt:z.number(),roomId:idSchema.optional()});
export type Identity = z.infer<typeof identitySchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
export type OfferInput = z.infer<typeof offerSchema>;
export const memberSchema = identitySchema.extend({id:idSchema,online:z.boolean(),owner:z.boolean()});
export type MemberDto = z.infer<typeof memberSchema>;
export const metricsSchema = z.object({logicalBytes:z.number(),acknowledgedBytes:z.number(),ingressBytes:z.number(),servedBytes:z.number(),verificationMs:z.number(),elapsedUploadMs:z.number().nullable(),goodputBytesPerSecond:z.number().nullable()});
export type MetricsDto = z.infer<typeof metricsSchema>;
export const fileSchema = fileMetaSchema.extend({state:z.enum(fileStates),committedBytes:z.number(),nextChunkIndex:z.number(),downloadRequested:z.boolean()});
export type FileDto = z.infer<typeof fileSchema>;
export const transferSchema = z.object({id:idSchema,roomId:idSchema,senderId:idSchema,recipientId:idSchema,kind:z.enum(['files','text']),byteLength:z.number(),state:z.enum(transferStates),createdAt:z.number(),expiresAt:z.number(),files:z.array(fileSchema),text:z.string().optional(),metrics:metricsSchema,cleanupPending:z.boolean()});
export type TransferDto = z.infer<typeof transferSchema>;
export const snapshotSchema = z.object({id:idSchema,revision:z.number(),ownerId:idSchema,locked:z.boolean(),expiresAt:z.number(),members:z.array(memberSchema),transfers:z.array(transferSchema),aggregate:z.object({members:z.number(),transfers:z.number(),acknowledgedBytes:z.number()}),invitation:z.object({code:z.string(),secret:z.string()}).optional()});
export type Snapshot = z.infer<typeof snapshotSchema>;
export const notificationSchema = z.object({roomId:idSchema,revision:z.number().int()}).strict();
export type Notification = z.infer<typeof notificationSchema>;
export interface UploadStatus { nextChunkIndex:number; committedBytes:number; state:FileDto['state'] }
export interface PublicConfig { limits:typeof LIMITS; addresses:string[]; encrypted:boolean }
