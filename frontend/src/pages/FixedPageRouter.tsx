import { useEffect, useState, type ComponentType } from 'react';
import { useParams } from 'react-router-dom';
import { Home } from './Home';
import { Ausbildung } from './Ausbildung';
import { Performance } from './Performance';
import { Reisen } from './Reisen';
import { Service } from './Service';
import { Infos } from './Infos';
import { Team } from './Team';
import { Gelaende } from './Gelaende';
import { Wetter } from './Wetter';
import { Medien } from './Medien';
import { Gruppenevents } from './Gruppenevents';
import { Gutscheine } from './Gutscheine';
import { Versicherungen } from './Versicherungen';
import { Schnupperkurs } from './Schnupperkurs';
import { LSchein } from './LSchein';
import { ASchein } from './ASchein';
import { BSchein } from './BSchein';
import { Windenschein } from './Windenschein';
import { Tandemschein } from './Tandemschein';
import { Ausbildungskonzept } from './Ausbildungskonzept';
import { Sicherheitstraining } from './Sicherheitstraining';
import { Rettungsgeraetetraining } from './Rettungsgeraetetraining';
import { Groundhandling } from './Groundhandling';
import { BrasilienTour } from './BrasilienTour';
import { KolumbienTour } from './KolumbienTour';
import { SuedafrikaTour } from './SuedafrikaTour';
import { BassanoTour } from './BassanoTour';
import { GriechenlandTour } from './GriechenlandTour';
import { SlowenienTour } from './SlowenienTour';
import { BergamoTour } from './BergamoTour';
import { SavoyeTour } from './SavoyeTour';
import { VogesenTour } from './VogesenTour';
import { PfalzTour } from './PfalzTour';
import { ZweiJahresCheck } from './ZweiJahresCheck';
import { Rettungspacken } from './Rettungspacken';
import { Trimmtuning } from './Trimmtuning';
import { ReparaturService } from './ReparaturService';
import { Billings } from './Billings';
import { Erlau } from './Erlau';
import { Gadern } from './Gadern';
import { LindenfelsGelaende } from './Lindenfels';
import { NonrodNordost } from './NonrodNordost';
import { Nonrod } from './Nonrod';
import { Stauf } from './Stauf';
import { Winterkasten } from './Winterkasten';
import { BadKreuznach } from './BadKreuznach';
import { Herrenteich } from './Herrenteich';
import { FAQ } from './FAQ';
import { Tandem } from './Tandem';
import { DynamicPage } from './DynamicPage';
import { LegalPageContent } from './LegalPageContent';
import { PageArticleOverride } from './PageArticleOverride'; // PAGE ARTICLE MODE

const KIND_COMPONENTS: Record<string, ComponentType<{ contentId?: string }>> = {
  home: Home,
  ausbildung: Ausbildung,
  performance: Performance,
  reisen: Reisen,
  service: Service,
  infos: Infos,
  team: Team,
  gelaende: Gelaende,
  wetter: Wetter,
  medien: Medien,
  gruppenevents: Gruppenevents,
  gutscheine: Gutscheine,
  versicherungen: Versicherungen,
  schnupperkurs: Schnupperkurs,
  'l-schein': LSchein,
  'a-schein': ASchein,
  'b-schein': BSchein,
  windenschein: Windenschein,
  tandemschein: Tandemschein,
  ausbildungskonzept: Ausbildungskonzept,
  sicherheitstraining: Sicherheitstraining,
  rettungsgeraetetraining: Rettungsgeraetetraining,
  groundhandling: Groundhandling,
  'brasilien-tour': BrasilienTour,
  'kolumbien-tour': KolumbienTour,
  'suedafrika-tour': SuedafrikaTour,
  'bassano-tour': BassanoTour,
  'griechenland-tour': GriechenlandTour,
  'slowenien-tour': SlowenienTour,
  'bergamo-tour': BergamoTour,
  'savoye-tour': SavoyeTour,
  'vogesen-tour': VogesenTour,
  'pfalz-tour': PfalzTour,
  '2-jahres-check': ZweiJahresCheck,
  rettungspacken: Rettungspacken,
  trimmtuning: Trimmtuning,
  reparatur: ReparaturService,
  billings: Billings,
  erlau: Erlau,
  gadern: Gadern,
  lindenfels: LindenfelsGelaende,
  'nonrod-nordost': NonrodNordost,
  nonrod: Nonrod,
  stauf: Stauf,
  winterkasten: Winterkasten,
  'bad-kreuznach': BadKreuznach,
  herrenteich: Herrenteich,
  faq: FAQ,
  tandem: Tandem,
};

interface Resolved {
  kind: string;
  contentId?: string;
  legalPage?: { title: string; content: string };
}

// Every catch-all ":slug" request goes through here first, checking three
// things a slug can mean before falling back to DynamicPage (the Seiten/
// Unlayer CMS flow):
// 1. A true same-design duplicate (Admin > Seiten > "Duplizieren" on
//    Startseite/Ausbildung/Performance/Reisen/Service/Infos - see
//    FixedPageDuplicate model / fixedPageDuplicates.routes.ts) - renders the
//    same component as the original, pointed at the copied content via
//    contentId.
// 2. A RENAMED original fixed page (Admin > Seiten > editing Ausbildung's
//    own "Seiten-Einstellungen" - see FixedPageSettings model /
//    fixedPageSettings.routes.ts / FixedPageGate.tsx, which redirects the
//    old hardcoded route here) - renders the same component with no
//    contentId, so it reads the page's own real content, not a copy.
// 3. A RENAMED legal page (Admin > Rechtliche Seiten - LegalPage.tsx
//    redirects its own hardcoded route here the same way) - rendered
//    directly via LegalPageContent, no further redirect check needed since
//    this request's own slug already IS the current one.
export const FixedPageRouter = () => {
  const { slug } = useParams<{ slug: string }>();
  // Tagged with the `slug` each fetch was actually for - this component
  // sits at the same spot in the route tree across a same-Layout
  // navigation between two different catch-all-resolved pages, so React
  // reuses the same instance. Deriving `resolved` below (by checking the
  // fetch's own tagged slug against the CURRENT slug, during render) means
  // a stale result from the PREVIOUS page can never be mistaken for this
  // one's - see FixedPageGate.tsx for the exact same race and fix.
  const [fetched, setFetched] = useState<{ slug: string; resolved: Resolved | null } | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/fixed-page-duplicates/public/${slug}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/fixed-page-settings/public/by-slug/${slug}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/legalPages/public/by-slug/${slug}`).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([dup, primary, legal]) => {
        if (cancelled) return;
        let resolved: Resolved | null = null;
        if (dup) resolved = { kind: dup.kind, contentId: dup.contentId };
        else if (primary) resolved = { kind: primary.kind };
        else if (legal) resolved = { kind: '__legal__', legalPage: { title: legal.title, content: legal.content } };
        setFetched({ slug: slug as string, resolved });
      })
      .catch(() => { if (!cancelled) setFetched({ slug: slug as string, resolved: null }); });
    return () => { cancelled = true; };
  }, [slug]);

  const resolved = fetched && fetched.slug === slug ? fetched.resolved : undefined;

  if (resolved === undefined) return null;

  if (resolved) {
    if (resolved.legalPage) return <LegalPageContent title={resolved.legalPage.title} content={resolved.legalPage.content} />;
    const Component = KIND_COMPONENTS[resolved.kind];
    // PAGE ARTICLE MODE: duplicates use their own slug as article key,
    // renamed originals their kind. To revert: `return <Component contentId={resolved.contentId} />;`
    if (Component) {
      return (
        <PageArticleOverride articleKey={resolved.contentId || resolved.kind}>
          <Component contentId={resolved.contentId} />
        </PageArticleOverride>
      );
    }
  }

  // PAGE ARTICLE MODE: custom (Seiten/Unlayer) pages can be edited in the
  // Joomla-style page editor too, keyed by their slug.
  return (
    <PageArticleOverride articleKey={slug as string}>
      <DynamicPage />
    </PageArticleOverride>
  );
};
