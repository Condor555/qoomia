'use client';

import Link from 'next/link';
import CategoryIcon from './CategoryIcon';
import Icon from './Icon';
import {buildQoomiaInsights,type InsightInput,type QoomiaInsight} from '../lib/qoomia-insights';

function InsightGlyph({insight,size=34}:{insight:QoomiaInsight;size?:number}){
  if(insight.icon.kind==='category')return <CategoryIcon name={insight.icon.name} icon={insight.icon.icon} color={insight.icon.color} size={size}/>;
  return <span className={`insights-overview-glyph ${insight.icon.kind}`}><Icon name={insight.icon.kind==='budget'?'wallet':'chart'} size={18}/></span>;
}

function InsightCopy({insight}:{insight:QoomiaInsight}){
  return <span><b>{insight.title}</b><small>{insight.description}</small>{insight.actionLabel&&<em>{insight.actionLabel}</em>}</span>;
}

function PrimaryInsight({insight}:{insight:QoomiaInsight}){
  const className=`insights-overview-primary ${insight.tone}${insight.href?' is-actionable':''}`;
  if(!insight.href)return <div className={className}><InsightGlyph insight={insight}/><InsightCopy insight={insight}/></div>;
  return <Link href={insight.href} className={className} aria-label={`${insight.title}. ${insight.actionLabel||''}`.trim()}><InsightGlyph insight={insight}/><InsightCopy insight={insight}/><strong aria-hidden="true">›</strong></Link>;
}

function SecondaryInsight({insight}:{insight:QoomiaInsight}){
  const content=<><InsightGlyph insight={insight} size={30}/><InsightCopy insight={insight}/>{insight.href&&<strong aria-hidden="true">›</strong>}</>;
  return insight.href?<Link href={insight.href} className="insights-overview-row is-actionable" aria-label={`${insight.title}. ${insight.actionLabel||''}`.trim()}>{content}</Link>:<div className="insights-overview-row">{content}</div>;
}

export default function InsightsOverview({stats,currency,locale}:{stats:InsightInput;currency:(value:number)=>string;locale:'it'|'en'}){
  const insights=buildQoomiaInsights(stats,{currency,locale,limit:3});
  if(!insights.length)return null;
  const [primary,...secondary]=insights;
  return <section id="qoomia-insights" className="section surface insights-overview" aria-labelledby="insights-overview-title">
    <header className="insights-overview-head"><div><small>{locale==='it'?'Lettura del mese':'Monthly reading'}</small><h2 id="insights-overview-title">Qoomia Insights</h2></div><span>{locale==='it'?'Dai tuoi dati':'From your data'}</span></header>
    <PrimaryInsight insight={primary}/>
    {secondary.length>0&&<div className="insights-overview-list">{secondary.map(insight=><SecondaryInsight insight={insight} key={insight.id}/>)}</div>}
    <p className="insights-overview-note">{locale==='it'?'Ogni osservazione apre il dettaglio più utile: andamento, Budget o movimenti della categoria.':'Each observation opens the most useful detail: trend, Budget or category transactions.'}</p>
  </section>;
}
