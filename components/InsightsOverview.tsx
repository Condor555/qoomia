'use client';

import Link from 'next/link';
import CategoryIcon from './CategoryIcon';
import Icon from './Icon';
import {buildQoomiaInsights,type InsightInput,type QoomiaInsight} from '../lib/qoomia-insights';

function InsightGlyph({insight,size=34}:{insight:QoomiaInsight;size?:number}){
  if(insight.icon.kind==='category')return <CategoryIcon name={insight.icon.name} icon={insight.icon.icon} color={insight.icon.color} size={size}/>;
  return <span className={`insights-overview-glyph ${insight.icon.kind}`}><Icon name={insight.icon.kind==='budget'?'wallet':'chart'} size={18}/></span>;
}

export default function InsightsOverview({stats,currency,locale}:{stats:InsightInput;currency:(value:number)=>string;locale:'it'|'en'}){
  const insights=buildQoomiaInsights(stats,{currency,locale,limit:3});
  if(!insights.length)return null;
  const [primary,...secondary]=insights;
  return <section className="section surface insights-overview" aria-labelledby="insights-overview-title">
    <header className="insights-overview-head"><div><small>{locale==='it'?'Lettura del mese':'Monthly reading'}</small><h2 id="insights-overview-title">Qoomia Insights</h2></div><span>{locale==='it'?'Deterministici':'Deterministic'}</span></header>
    <Link href={primary.href} className={`insights-overview-primary ${primary.tone}`}>
      <InsightGlyph insight={primary}/>
      <span><b>{primary.title}</b><small>{primary.description}</small></span>
      <strong aria-hidden="true">›</strong>
    </Link>
    {secondary.length>0&&<div className="insights-overview-list">{secondary.map(insight=><Link href={insight.href} className="insights-overview-row" key={insight.id}>
      <InsightGlyph insight={insight} size={30}/>
      <span><b>{insight.title}</b><small>{insight.description}</small></span>
      <strong aria-hidden="true">›</strong>
    </Link>)}</div>}
    <p className="insights-overview-note">{locale==='it'?'Calcolati localmente dai dati dello spazio selezionato, senza AI generativa.':'Calculated from the selected space data, without generative AI.'}</p>
  </section>;
}
