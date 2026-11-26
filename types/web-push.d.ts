declare module 'web-push'{
  export type VapidKeys={publicKey:string;privateKey:string};
  export function generateVAPIDKeys():VapidKeys;
  const webPush:{generateVAPIDKeys:typeof generateVAPIDKeys};
  export default webPush;
}
