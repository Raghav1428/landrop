import { join } from 'node:path';
export const recognized=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.part$/;
export function payloadPath(root:string,diskId:string){if(!recognized.test(`${diskId}.part`))throw new Error('Invalid internal disk ID');return join(root,`${diskId}.part`);}
