export const transferStates = ['offered','accepted','transferring','completed','rejected','cancelled','failed','expired'] as const;
export type TransferState = typeof transferStates[number];
export const fileStates = ['queued','uploading','verifying','ready','failed','revoked'] as const;
export type FileState = typeof fileStates[number];
const transitions: Record<TransferState, readonly TransferState[]> = { offered:['accepted','rejected','cancelled','expired'], accepted:['transferring','cancelled','failed','expired'], transferring:['completed','cancelled','failed','expired'], completed:[], rejected:[], cancelled:[], failed:[], expired:[] };
const files: Record<FileState, readonly FileState[]> = {queued:['uploading','failed','revoked'],uploading:['verifying','failed','revoked'],verifying:['ready','failed','revoked'],ready:['revoked'],failed:['revoked'],revoked:[]};
export const canTransition = (from: TransferState,to: TransferState) => transitions[from].includes(to);
export const canFileTransition = (from: FileState,to: FileState) => files[from].includes(to);
export const isUnfinished = (state: TransferState) => ['offered','accepted','transferring'].includes(state);
