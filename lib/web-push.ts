import {createCipheriv,createECDH,createHmac,createPrivateKey,randomBytes,sign} from 'node:crypto';

export type WebPushSubscription={endpoint:string;p256dh:string;auth:string};
export type WebPushResult={ok:boolean;status:number;expired:boolean;body:string};

const encoder=new TextEncoder();
const base64url=(value:Uint8Array|Buffer)=>Buffer.from(value).toString('base64url');
const decode=(value:string)=>Buffer.from(value.replace(/-/g,'+').replace(/_/g,'/'),'base64');
const concat=(...values:Array<Uint8Array|Buffer>)=>Buffer.concat(values.map(value=>Buffer.from(value)));

function hmac(key:Uint8Array|Buffer,value:Uint8Array|Buffer){return createHmac('sha256',Buffer.from(key)).update(Buffer.from(value)).digest()}
function hkdfExpand(prk:Buffer,info:Uint8Array|Buffer,length:number){
  const blocks:Buffer[]=[];let previous=Buffer.alloc(0);let counter=1;
  while(Buffer.concat(blocks).length<length){previous=hmac(prk,concat(previous,info,Buffer.from([counter++])));blocks.push(previous)}
  return Buffer.concat(blocks).subarray(0,length);
}
function vapidKeys(){
  const publicKey=decode(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||'');
  const privateKey=decode(process.env.VAPID_PRIVATE_KEY||'');
  if(publicKey.length!==65||publicKey[0]!==4||privateKey.length!==32)throw new Error('VAPID keys missing or invalid');
  return {publicKey,privateKey};
}
function vapidAuthorization(endpoint:string,publicKey:Buffer,privateKey:Buffer){
  const audience=new URL(endpoint).origin;
  const subject=process.env.VAPID_SUBJECT||'mailto:admin@qoomia.app';
  const header=base64url(encoder.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const payload=base64url(encoder.encode(JSON.stringify({aud:audience,exp:Math.floor(Date.now()/1000)+11*60*60,sub:subject})));
  const unsigned=`${header}.${payload}`;
  const key=createPrivateKey({key:{kty:'EC',crv:'P-256',x:base64url(publicKey.subarray(1,33)),y:base64url(publicKey.subarray(33,65)),d:base64url(privateKey)},format:'jwk'});
  const signature=sign('sha256',Buffer.from(unsigned),{key,dsaEncoding:'ieee-p1363'});
  return `vapid t=${unsigned}.${base64url(signature)}, k=${base64url(publicKey)}`;
}
function encryptPayload(subscription:WebPushSubscription,payload:string){
  const clientPublic=decode(subscription.p256dh);const authSecret=decode(subscription.auth);
  if(clientPublic.length!==65||authSecret.length<16)throw new Error('Push subscription keys are invalid');
  const server=createECDH('prime256v1');server.generateKeys();
  const serverPublic=server.getPublicKey(undefined,'uncompressed');
  const sharedSecret=server.computeSecret(clientPublic);
  const authPrk=hmac(authSecret,sharedSecret);
  const keyInfo=concat(encoder.encode('WebPush: info\0'),clientPublic,serverPublic);
  const ikm=hkdfExpand(authPrk,keyInfo,32);
  const salt=randomBytes(16);const prk=hmac(salt,ikm);
  const cek=hkdfExpand(prk,encoder.encode('Content-Encoding: aes128gcm\0'),16);
  const nonce=hkdfExpand(prk,encoder.encode('Content-Encoding: nonce\0'),12);
  const plain=concat(encoder.encode(payload),Buffer.from([2]));
  const cipher=createCipheriv('aes-128-gcm',cek,nonce);
  const encrypted=concat(cipher.update(plain),cipher.final(),cipher.getAuthTag());
  const recordSize=Buffer.alloc(4);recordSize.writeUInt32BE(4096);
  return concat(salt,recordSize,Buffer.from([serverPublic.length]),serverPublic,encrypted);
}

export async function sendWebPush(subscription:WebPushSubscription,payload:unknown):Promise<WebPushResult>{
  const {publicKey,privateKey}=vapidKeys();
  const body=encryptPayload(subscription,JSON.stringify(payload));
  const response=await fetch(subscription.endpoint,{method:'POST',headers:{Authorization:vapidAuthorization(subscription.endpoint,publicKey,privateKey),'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'86400',Urgency:'normal'},body:new Uint8Array(body)});
  const responseBody=await response.text().catch(()=>'');
  return {ok:response.ok,status:response.status,expired:response.status===404||response.status===410,body:responseBody.slice(0,500)};
}
