import BackToAccount from '../../../components/BackToAccount';
import QoomiaLogo from '../../../components/QoomiaLogo';

export default function Informazioni(){
  return <>
    <BackToAccount/>
    <header className="page-head"><div><h1>Informazioni</h1><p>Versione, licenze e attribuzioni</p></div></header>
    <section className="settings-card surface about-card">
      <div className="about-brand"><QoomiaLogo size={48}/><div><h2>Qoomia</h2><p className="settings-help">Versione 4.3.3 · Qoomia.</p></div></div>
      <p className="settings-help">Dai senso alle tue spese, in privato o in famiglia.</p>
      <div className="about-row"><span>Icone funzionali dell’interfaccia</span><b>Phosphor Icons</b></div>
      <div className="about-row"><span>Icone delle categorie</span><b>Asset locali + fallback Phosphor</b></div>
      <div className="about-row"><span>Marchi</span><b>Icons8 locali</b></div>
      <p className="settings-help icons8-attribution">Categorie e brand usano asset locali; Barbiere, Educazione e Divertimento hanno icone dedicate incluse nell’app. Se un identificatore non è disponibile viene usato il fallback Tag di Phosphor. Parte del catalogo usa Icons8: https://icons8.com/.</p>
    </section>
    <section className="settings-card surface source-card">
      <h2>Codice sorgente</h2>
      <p className="settings-help">Consulta il progetto e lo storico delle modifiche.</p>
      <a className="source-repository-link" href="https://github.com/Condor555/qoomia" target="_blank" rel="noopener noreferrer"><span><b>Repository GitHub</b><small>github.com/Condor555/qoomia</small></span><strong aria-hidden="true">↗</strong></a>
    </section>
  </>;
}

