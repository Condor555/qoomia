import {normalizeIconId} from './category-icon-catalog';

export type CategoryStyle={icon:string;color:string};

type Rule={match:RegExp;style:CategoryStyle};
const color=(icon:string,value:string):CategoryStyle=>({icon:normalizeIconId(icon),color:value});

/** Ordered from specific to generic: the first semantic match wins. */
const rules:Rule[]=[
  {match:/netflix/i,style:{icon:'brand:netflix',color:'#E50914'}},
  {match:/spotify/i,style:{icon:'brand:spotify',color:'#1DB954'}},
  {match:/amazon prime|amazon/i,style:{icon:'brand:amazon',color:'#FF9900'}},
  {match:/apple tv|apple music|icloud/i,style:{icon:'brand:apple',color:'#111827'}},
  {match:/disney\s*\+?/i,style:{icon:'brand:disney',color:'#113CCF'}},
  {match:/youtube/i,style:{icon:'brand:youtube',color:'#FF0000'}},
  {match:/playstation/i,style:{icon:'brand:playstation',color:'#006FCD'}},
  {match:/xbox/i,style:{icon:'brand:xbox',color:'#107C10'}},
  {match:/paypal/i,style:{icon:'brand:paypal',color:'#003087'}},
  {match:/airbnb/i,style:{icon:'brand:airbnb',color:'#FF5A5F'}},
  {match:/\buber\b/i,style:{icon:'brand:uber',color:'#111827'}},
  {match:/\bgoogle\b/i,style:{icon:'brand:google',color:'#4285F4'}},

  {match:/stipendio|salario|retribuzione/i,style:color('salary','#2EAA7B')},
  {match:/pensione/i,style:color('pension','#438FDF')},
  {match:/bonus|premi/i,style:color('bonus','#E3AD16')},
  {match:/regali ricevuti/i,style:color('gift','#DB4B8B')},
  {match:/rimbor/i,style:color('refund','#3E9AA8')},
  {match:/interess|rendit|dividend|cedola/i,style:color('investment','#35A96B')},
  {match:/vendit/i,style:color('sales-income','#9655F0')},
  {match:/trasferiment.*entrata|altra entrata|other income/i,style:color('income','#5B8DEF')},

  {match:/mare|spiaggia|lido|ombrellone|balneare/i,style:color('beach-umbrella','#2E9BC6')},
  {match:/vacanz|ferie/i,style:color('suitcase','#E79035')},
  {match:/viagg|volo|aereo|aeroporto/i,style:color('airplane','#5B8DEF')},
  {match:/hotel|albergo|b&b|alloggio/i,style:color('hotel','#3E9AA8')},
  {match:/campeggio|tenda/i,style:color('camping','#43A36B')},
  {match:/scooter|motorino|\bmoto\b/i,style:color('motorcycle','#4F77D8')},
  {match:/benzina|carburante|diesel|\bgpl\b/i,style:color('gas-station','#8A5CF6')},
  {match:/parcheggio|\bsosta\b/i,style:color('parking','#655CE8')},
  {match:/\bauto\b|macchina/i,style:color('car','#536DE2')},
  {match:/treno|ferrovia|trasport/i,style:color('train','#655CE8')},
  {match:/taxi/i,style:color('taxi','#F0AF31')},
  {match:/bici|bicicletta|ciclismo/i,style:color('bicycle','#35A96B')},

  {match:/supermercato|alimentari|spesa quotidiana/i,style:color('grocery-store','#5477F5')},
  {match:/pizza|pizzeria/i,style:color('pizza','#E96C3B')},
  {match:/ristor|pranzo|cena|trattoria/i,style:color('restaurant','#E99B35')},
  {match:/\bbar\b|caff[eè]|colazione/i,style:color('coffee','#B97B4B')},
  {match:/panetteria|pane|forno/i,style:color('food','#D8913B')},
  {match:/bevande|aperitivo|drink/i,style:color('wine','#DB4B8B')},
  {match:/cibo|food/i,style:color('food','#E99B35')},

  {match:/affitto|locazione|mutuo|canone casa/i,style:color('rent','#2F9E75')},
  {match:/bollette|utenze|corrente|elettric/i,style:color('electricity','#5BA88D')},
  {match:/pulizi|detergent/i,style:color('home-maintenance','#4EAFA0')},
  {match:/arredamento|mobili/i,style:color('furniture','#A06AC6')},
  {match:/riparaz|manutenz|meccanico/i,style:color('home-maintenance','#E79035')},
  {match:/domestica|\bcasa\b|abitazione/i,style:color('house','#5BA88D')},

  {match:/visita|medico|dottore|specialist/i,style:color('doctor','#D55E80')},
  {match:/farmacia|medicinal|medicine/i,style:color('pharmacy','#D55E80')},
  {match:/dentista|denti/i,style:color('dentist','#4BA6C8')},
  {match:/veterin|animali|cane|gatto/i,style:color('pets','#C47A45')},
  {match:/salute|benessere/i,style:color('health','#D55E80')},
  {match:/ospedale|clinica/i,style:color('hospital','#D95D6B')},

  {match:/palestra|fitness|allenamento/i,style:color('gym','#35A96B')},
  {match:/calcio/i,style:color('football','#35A96B')},
  {match:/nuoto|piscina/i,style:color('sport','#2E9BC6')},
  {match:/corsa|running|jogging/i,style:color('sport','#E79035')},

  {match:/cinema|film/i,style:color('cinema','#E45858')},
  {match:/musica|concerto/i,style:color('music','#8B6BC9')},
  {match:/videogio|gaming|console/i,style:color('gaming','#655CE8')},
  {match:/teatro|spettacolo/i,style:color('cinema','#E45858')},
  {match:/divertimento|evento|svago|festa/i,style:color('entertainment','#F17D45')},

  {match:/scuola|universit|educazione|formazione/i,style:color('books','#438FDF')},
  {match:/libri|cultura|lettura/i,style:color('books','#8B6BC9')},
  {match:/famiglia|parenti|family/i,style:color('family','#EF6C91')},
  {match:/figli|bambin|infanzia/i,style:color('child','#ED7896')},
  {match:/matrimonio|nozze|fedi|wedding/i,style:color('wedding','#DB4B8B')},
  {match:/moglie|compagna/i,style:color('couple','#9655F0')},
  {match:/marito|amore/i,style:color('couple','#E85F86')},

  {match:/tasse|imposte|tributi|f24/i,style:color('tax','#D97706')},
  {match:/risparm|salvadanaio/i,style:color('savings','#35A96B')},
  {match:/investiment|azioni|fondi/i,style:color('investment','#2F9E75')},
  {match:/assicuraz|polizza/i,style:color('payment','#438FDF')},
  {match:/banca|conto corrente/i,style:color('pension','#536DE2')},
  {match:/stipendio|entrata|reddito/i,style:color('salary','#12A979')},
  {match:/fattur|ricevut|scontrino/i,style:color('payment','#5BA88D')},

  {match:/telefono|cellulare|smartphone|ricarica telefonica/i,style:color('phone','#5B8DEF')},
  {match:/internet|fibra|wifi/i,style:color('internet','#438FDF')},
  {match:/computer|portatile|laptop/i,style:color('appliances','#655CE8')},
  {match:/software|app|licenza/i,style:color('appliances','#655CE8')},
  {match:/lavoro|ufficio|azienda/i,style:color('wallet','#536DE2')},

  {match:/abbonament|ricorren/i,style:color('payment','#D84D4F')},
  {match:/regal/i,style:color('gift','#E3AD16')},
  {match:/ordini online|pacch|spedizion/i,style:color('shopping','#9655F0')},
  {match:/acquisti online|acquisti|shopping|abbigliamento/i,style:color('shopping','#9655F0')},
  {match:/barbiere|parrucchiere/i,style:color('barber','#E39C34')},
  {match:/altra spesa|altro|varie/i,style:color('tag','#68738C')},
];

export function inferredCategoryStyle(name:string):CategoryStyle{
  return rules.find(rule=>rule.match.test(name))?.style||color('tag','#68738C');
}

export function categoryStyle(name:string,custom?:Partial<CategoryStyle>|null):CategoryStyle{
  const inferred=inferredCategoryStyle(name);
  let customIcon=custom?.icon;
  // V3.9 stored the generic plane for "Mare". Correct that known bad automatic mapping
  // while preserving every other historical/custom identifier.
  const normalizedCustom=normalizeIconId(customIcon);
  if(/mare|spiaggia|lido|ombrellone|balneare/i.test(name)&&['airplane','tag'].includes(normalizedCustom))customIcon=inferred.icon;
  if(/matrimonio|nozze|fedi|wedding/i.test(name)&&['heart','tag'].includes(normalizedCustom))customIcon=inferred.icon;
  if(/moglie|compagna/i.test(name)&&['heart','tag','users-three'].includes(normalizedCustom))customIcon=inferred.icon;
  if(/barbiere|parrucchiere/i.test(name)&&['shopping','tag'].includes(normalizedCustom))customIcon=inferred.icon;
  if(/divertimento|evento|svago|festa/i.test(name)&&['cinema','tag'].includes(normalizedCustom))customIcon=inferred.icon;
  const resolvedCustom=normalizeIconId(customIcon);
  const resolvedIcon=resolvedCustom!=='tag'?resolvedCustom:inferred.icon;
  return {icon:normalizeIconId(resolvedIcon),color:custom?.color||inferred.color};
}

export const colorChoices=['#5477F5','#4F77D8','#655CE8','#8A5CF6','#9655F0','#D55E80','#DB4B8B','#E85F86','#E45858','#F17D45','#E99B35','#D97706','#E3AD16','#35A96B','#2F9E75','#5BA88D','#3E9AA8','#2E9BC6','#68738C','#111827'];
