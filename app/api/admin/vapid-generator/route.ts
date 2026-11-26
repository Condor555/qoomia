import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import webPush from 'web-push';
import {createClient} from '../../../../../lib/supabase/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=10;

const noStore={
  'Cache-Control':'no-store, no-cache, must-revalidate, private, max-age=0',
  'Pragma':'no-cache',
  'Expires':'0',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
};
function reply(body:Record<string,unknown>,status:number){return NextResponse.json(body,{status,headers:noStore})}
function sameSecret(received:string,expected:string){
  const left=Buffer.from(received);const right=Buffer.from(expected);
  return left.length===right.length&&timingSafeEqual(left,right);
}
export async function POST(req:Request){
  if(process.env.VAPID_GENERATOR_ENABLED!=='true')return reply({error:'Not found'},404);
  const expected=process.env.VAPID_GENERATOR_TOKEN||'';
  if(expected.length<48)return reply({error:'Generatore non configurato in modo sicuro.'},503);
  const authorization=req.headers.get('authorization')||'';
  const received=authorization.startsWith('Bearer ')?authorization.slice(7):'';
  if(!sameSecret(received,expected))return reply({error:'Unauthorized'},401);
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();
  if(!user)return reply({error:'Unauthorized'},401);
  let body:unknown;
  try{body=await req.json()}catch{return reply({error:'Richiesta non valida.'},400)}
  if(!body||typeof body!=='object'||(body as {confirm?:unknown}).confirm!=='GENERATE_QOOMIA_VAPID_ONCE')return reply({error:'Conferma non valida.'},400);
  const keys=webPush.generateVAPIDKeys();
  return reply({
    publicKey:keys.publicKey,
    privateKey:keys.privateKey,
    generatedAt:new Date().toISOString(),
    warning:'Copia ora entrambe le chiavi in Vercel, poi disabilita e rimuovi completamente questo generatore. Non richiamarlo: ogni chiamata genera una coppia diversa.',
  },200);
}
