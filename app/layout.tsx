import type {Metadata,Viewport} from 'next';
import AppHeader from '../components/AppHeader';
import LanguageProvider from '../components/LanguageProvider';
import Nav from '../components/Nav';
import ThemeProvider from '../components/ThemeProvider';
import './globals.css';

const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||'https://qoomia.vercel.app';

export const metadata:Metadata={
  metadataBase:new URL(siteUrl),
  applicationName:'Qoomia',
  title:{default:'Qoomia',template:'%s · Qoomia'},
  description:'Dai senso alle tue spese, in privato o in famiglia.',
  manifest:'/manifest.webmanifest',
  icons:{icon:[{url:'/icon.svg',type:'image/svg+xml'},{url:'/favicon.ico',sizes:'any'}],apple:[{url:'/apple-icon.png',sizes:'180x180',type:'image/png'}]},
  alternates:{canonical:'/'},
  openGraph:{type:'website',locale:'it_IT',url:'/',siteName:'Qoomia',title:'Qoomia — Spese, Budget e Famiglia',description:'Dai senso alle tue spese, in privato o in famiglia.',images:[{url:'/icons/qoomia-v4-1-512.png',width:512,height:512,alt:'Qoomia'}]},
};

export const viewport:Viewport={
  width:'device-width',
  initialScale:1,
  viewportFit:'cover',
  colorScheme:'light dark',
  themeColor:[{media:'(prefers-color-scheme: light)',color:'#F2F2F7'},{media:'(prefers-color-scheme: dark)',color:'#000000'}],
};

export default function Layout({children,modal}:{children:React.ReactNode;modal:React.ReactNode}){
  return <html lang="it" suppressHydrationWarning><body><ThemeProvider/><LanguageProvider><main className="shell"><AppHeader/>{children}</main><Nav/>{modal}</LanguageProvider></body></html>;
}
