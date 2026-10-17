import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Default content for every page this covers, matching each page's current
// live copy exactly (see Ausbildung.tsx, Performance.tsx, Reisen.tsx,
// Service.tsx, Infos.tsx) - used both to seed a page's row on first admin
// visit and as the public fallback if that row doesn't exist yet.
export const DEFAULTS: Record<string, any> = {
  ausbildung: {
    heroQuote: 'Die Flugschule Hirondelle bietet euch eine qualifizierte, sichere und vielseitige Ausbildung.',
    introQuote: 'Wir begleiten euch von den ersten Hüpfern bis zu euren ersten Strecken- und Thermikflügen hier im Odenwald, in der Pfalz, im Kraichtal, im Nahetal und überall sonst auf der Welt.',
    introHtml: 'Im Nachfolgenden sind die Ausbildungswege in der Flugschule Hirondelle vom <a href="/ausbildung/schnupperkurs">Schnupper-/Einsteigerkurs</a> über den <a href="/ausbildung/l-schein">L-Schein</a> und die <a href="/ausbildung/a-schein">Höhenflugschulung (A-Schein)</a> bis zum <a href="/ausbildung/b-schein">unbeschränkten Luftfahrerschein (B-Schein)</a> aufgelistet, hier gelangt ihr zur <a href="/ausbildung/ausbildungskonzept">Gesamtübersicht</a>.',
    priceRows: [
      { name: 'Schnupper-/Einsteigerkurs', duration: '1 – 2 Tage', content: 'Ausrüstung kennen lernen, die ersten Flüge', price: 'ab 149,- €', link: '/ausbildung/schnupperkurs', bgColor: '#80c533' },
      { name: 'L-Schein', duration: '3 – 4 Tage', content: '15 Flüge am Grundkurs-Übungshang', price: '620,- €', link: '/ausbildung/l-schein', bgColor: '#34963b' },
      { name: 'Windenschein', duration: '3 Tage', content: '20 Flüge an der Winde', price: '450,- €', link: '/ausbildung/windenschein', bgColor: '#fff600' },
      { name: 'A-Schein', duration: 'mind. 1 Woche', content: '40 Höhenflüge', price: 'ab 990,- €', link: '/ausbildung/a-schein', bgColor: '#ffd700' },
      { name: 'B-Schein', duration: 'mind. 1 Woche', content: '20 Höhenflüge', price: 'ab 990,- €', link: '/ausbildung/b-schein', bgColor: '#e58e26' },
      { name: 'Tandemschein', duration: 'mind. 1 Woche', content: '40 Höhenflüge mit einem Passagier', price: 'ab 790,- €', link: '/ausbildung/tandemschein', bgColor: '#c4c5ca' },
    ],
    graphicImage: '/images/inhalte/ausbildungswege.png',
    graphicCaption: 'hm = ca. Höhenmeter-Differenz zwischen Start- und Landeplatz',
    graphicButtonLink: '/ausbildung/ausbildungskonzept',
    categories: [
      { heading: 'Schnupper-/Einsteigerkurs', subheading: 'Der Anfang einer neuen Leidenschaft....', description: "Am Schnuppertag / Einsteigerkurs lernst du die Grundzüge des Gleitschirmfliegens kennen. Anfängliche Aufzieh- und Laufübungen bereiten dich auf deine ersten Flüge vor: Kappe auslegen, Leinen sortieren, Eintrittsöffnungen kontrollieren, damit der Gleitschirm anschließend richtig über euch steigt. Gurtzeug anlegen, Startcheck und los geht's zum ersten Versuch.", image: '/images/ausbildung-1.jpg', link: '/ausbildung/schnupperkurs' },
      { heading: 'L-Schein', subheading: 'Du legst den Grundstein...', description: 'Aufbauend auf den Schnupperkurs werden im Grundkurs die fehlenden Flüge zur Erlangung des L-Scheins absolviert. Ziel des Kurses ist es, mindestens 15 Flüge am Hang oder an der Winde zu absolvieren, bei denen die Höhendifferenz schon bis zu 200 Meter betragen kann. Kurvenflug und Schirmkontrolle sind einige der Lerninhalte, die in diesem Kurs auf dem Lehrplan stehen.', image: '/images/ausbildung-2.jpg', link: '/ausbildung/l-schein' },
      { heading: 'A-Schein', subheading: 'Was dich erwartet beim Höhenflugkurs...', description: 'Aufbauend auf dem Grundkurs, werden beim Höhenflugkurs die ersten 15 Flüge für den beschränkten Luftfahrerschein (A-Schein) durchgeführt. Das Ziel des Höhenflugkurses ist der Höhenflugausweis.', image: '/images/ausbildung-3.jpg', link: '/ausbildung/a-schein' },
      { heading: 'B-Schein', subheading: 'Auf Strecke mit dem unbeschränkten Luftfahrerschein...', description: 'Das Gleitpotential des Gleitschirms ausreizen, die Thermik ausfliegen und dann auf Strecke gehen. Von Aufwind zu Aufwind gleiten und die Landschaft aus der Vogelperspektive genießen, das ist der Traum vieler Flieger.', image: '/images/ausbildung-4.jpg', link: '/ausbildung/b-schein' },
      { heading: 'Windenschein', subheading: 'Windenschlepp mit dem Gleitschirm...', description: 'Das Schleppen an der Winde ist eine ideale Möglichkeit, auch im Flachland mit dem Gleitschirm in die Luft zu kommen. Der Windenschein ist die ideale Ergänzung zum A-Scheinkurs da ihr hier schnell einen Großteil der nötigen Flüge für die A-Scheinprüfung sammeln könnt.', image: '/images/ausbildung-5.jpg', link: '/ausbildung/windenschein' },
      { heading: 'Tandemschein', subheading: 'Zusammen mit Freunden zum Fliegen gehen.', description: 'Zum Fliegen gehen und die Leidenschaft mit Freunden teilen? Mit dem Tandemschein kein Problem! Die Freiheit und die Eindrücke in der Luft mit jemanden teilen zu können ist ein fantastisches Erlebnis sowohl für den Piloten auch für den Passagier. Einfach ein Traum.', image: '/images/ausbildung-6.jpg', link: '/ausbildung/tandemschein' },
    ],
  },
  performance: {
    introQuote: 'Als SkyPerformance Trainer bieten wir ein umfangreiches Fortbildungsangebot unter der Leitung speziell ausgebildeter Fluglehrer.',
    badges: [
      { label: 'Streckenflugtraining' },
      { label: 'Soaringtraining' },
      { label: 'Sicherheitstraining' },
      { label: 'Rettungsgerätetraining' },
      { label: 'Thermik- und Flugtechniktraining' },
      { label: 'Groundhandlingtraining' },
    ],
    categories: [
      { heading: 'Sicherheitstraining - Gardasee', subheading: 'Sicherheitstraining am Gardasee...', description: 'Fünf Tage für deine Sicherheit, für die Verbesserung von richtigen Reaktionen und deinem fliegerischem Können. Am Südrand der italienischen Alpen liegt der wunderschöne Gardasee, den wir als Ausgangspunkt unseres Sicherheitstrainings genießen dürfen.', image: '/images/performance/sicherheitstraining.jpg', link: '/performance/sicherheitstraining' },
      { heading: 'Rettungsgerätetraining', subheading: 'Ein Muss für jeden Gleitschirmpiloten...', description: 'Gleitschirmfliegen ist eigentlich eine sehr sichere Sache aber dennoch kann es vorkommen, dass ihr in eine Situation geratet, die für euch als Pilot unbeherrschbar ist. Ein Muss für jeden Gleitschirm- und Drachenpiloten ist daher ein Rettungsgerätewurftraining mit der eigenen Ausrüstung.', image: '/images/performance/rettungsgeraetetraining.jpg', link: '/performance/rettungsgeraetetraining' },
      { heading: 'Refresherkurs', subheading: 'Sicher in allen Situationen...', description: 'Der Refresher-Kurs richtet sich an alle Piloten, die bereits ihre Ausbildung abgeschlossen haben. Wer unseren schönen Sport einmal gelernt hat und aus welchen Gründen auch immer länger nicht mehr geflogen ist.', image: '/images/performance/refresher.jpg', link: '/performance/refresher' },
      { heading: 'Groundhandling Kurs', subheading: 'Auf Tuchfühlung mit dem Gleitschirm...', description: 'Den Gleitschirm kennen lernen und als riesigen Lenkdrachen benutzen, Windsprünge meistern, den Hang kreuzen oder mit geöffnetem Segel bergauf laufen – das sind die Lernziele im diesem Seminar. Groundhandling ist das A & O für jeden Piloten, um den eigenen Schirm sicher zu steuern.', image: '/images/performance/groundhandling.jpg', link: '/performance/groundhandling' },
    ],
  },
  reisen: {
    introQuote: 'Die Hotspots der Fliegerszene erkunden mit Flugbetreuung.',
    introHtml: 'Unsere <a href="/reisen">Reisen</a> führen uns in die bekannten Fluggebiet-Hotspots. So zählt <a href="/reisen/bassano-tour">Bassano</a> – das Mekka der Gleitschirmszene – jährlich fest zum Programm. Aber auch entlegene Ziele wollen wir euch nicht vorenthalten und bieten euch Reisen nach <a href="/reisen/suedafrika-tour">Südafrika</a> und weiteren besonderen Zielen weltweit an. Im Rahmen unserer <a href="/reisen">Reisen</a> könnt ihr unter Fluglehrerbetreuung sehr viel Erfahrung sammeln, eure Flugtechnik verbessern und zahlreiche großartige Flugstunden genießen.',
    calendarButtonLink: '/buchungskalender',
    tours: [
      { heading: 'Brasilien-Tour', description: 'Fliegen in Rio de Janeiro – Uma cidade maravilhosa (eine wunderbare Stadt). Bei unserer Rundreise in Brasilien wollen wir neben den Startplätzen in und um Rio auch einige Startplätze im Landesinneren kennen lernen, wir machen außerdem an den bekannten PWC-Geländen Halt. Die Landschaften sind atemberaubend.', image: '/images/reisen/brasilien.jpg', link: '/reisen/brasilien-tour' },
      { heading: 'Kolumbien-Tour', description: 'Wir fliegen über den grünen Landschaften des Valle del Cauca. Dabei genießen wir die großartige Gastfreundschaft der Kolumbianer und befliegen über mehrere Stationen die besten Fluggebiete von Cali Richtung Medellin. Die sanfte Thermik und das breite Tal mit zahllosen Landemöglichkeiten laden zu gemeinsamen Thermik- und Streckenflügen ein.', image: '/images/reisen/kolumbien.jpg', link: '/reisen/kolumbien-tour' },
      { heading: 'Südafrika-Tour', description: 'Auf der Südhalbkugel, im Land der unerschöpflichen fliegerischen Möglichkeiten, können wir beste thermische Flugbedingungen unbegrenzt gemeinsam genießen und uns zudem an hochsommerlichen Temperaturen erfreuen. Einerseits erwarten uns phantastische Flüge in den attraktivsten Soaring-, Thermik- und Streckenfluggebieten in Wilderness, Hermanus, Porterville und Kapstadt.', image: '/images/reisen/suedafrika.jpg', link: '/reisen/suedafrika-tour' },
      { heading: 'Bassano-Tour', description: 'Bassano ist das unbestrittene Mekka der Gleitschirm- und Drachenszene in den Südalpen. Besonders im Winter und zeitigen Frühjahr trifft sich hier die Szene. Die Thermik ist ganzjährig interessant und kann schon früh im Jahr für Streckenflüge in Bella Italia genutzt werden. Von wunderschönen, stundenlangen Thermikflügen am Monte Grappa mit herrlichem Blick auf die Poebene bis zu schönen Streckenflügen ist in Bassano alles möglich.', image: '/images/reisen/bassano.jpg', link: '/reisen/bassano-tour' },
      { heading: 'Slowenien-Tour', description: 'Thermik und Streckenfliegen in Slowenien in den julischen Alpen heißt fliegen entlang der türkisblauen Soča in der Nähe von Kobarid und Tolmin.', image: '/images/reisen/slowenien.jpg', link: '/reisen/slowenien-tour' },
      { heading: 'Griechenland-Tour', description: 'Die Flugsafari ist eine tolle Kombination von Thermik- und Streckenfliegen im Pindosgebirge sowie dem Küstensoaren auf der Insel Lefkada an der Westküste Griechenlands..', image: '/images/reisen/griechenland.jpg', link: '/reisen/griechenland-tour' },
      { heading: 'Bergamo-Tour', description: 'Wer in Italien einmal abseits der ausgetretenen Pfade fliegen möchte, ist goldrichtig in der Region rund um Bergamo, den Ausläufern der Südalpen kurz vor Mailand.', image: '/images/reisen/bergamo.jpg', link: '/reisen/bergamo-tour' },
      { heading: 'Savoyer Alpentour', description: "Eine Woche durch die Savoyer Alpen touren. Die Savoyer Alpen befinden sich grob zwischen Genf, Chamonix und Grenoble. Unser Standort ist der Campingplatz La ferme de la Serraz neben dem Lac d' Annecy in Doussard. Um den See liegen alleine schon 3 Fluggelände, die von der Hauptwindrichtung recht unabhängig und fast täglich fliegbar sind.", image: '/images/reisen/savoye.jpg', link: '/reisen/savoye-tour' },
      { heading: 'Vogesen-Tour', description: "Die Vogesen schließen sich nahtlos an das Pfälzer Bergland an und bilden ganz im Süden mit den Fluggebieten le Treh, le Drumont, Gustiberg und Ballon d'Alsace eine phantastische Flug-Arena. Sie bieten dem Einsteiger einfache Startplätze mit großzügigen Landeplätzen im Gleitwinkelbereich, dem Fortgeschrittenen die Möglichkeit für erste Streckenflüge.", image: '/images/reisen/vogesen.jpg', link: '/reisen/vogesen-tour' },
      { heading: 'Pfalz-Tour', description: 'Rund um das kleine Städtchen Annweiler in der Südpfalz liegen 7 schöne Startplätze, die allemal einen Besuch wert sind. Die Buckel der Südpfälzer haben einen Höhenunterschied von bis zu 320 m. Es werden von dort regelmäßig schöne Streckenflüge in den DHV-XC eingereicht.', image: '/images/reisen/pfalz.jpg', link: '/reisen/pfalz-tour' },
    ],
  },
  service: {
    items: [
      { id: '2-jahres-check', title: '2-JAHRES-CHECK', description: 'Wartungsarbeiten und Reparaturen in unserer Service-Werkstätte', image: '/images/service/check.jpg', link: '/service/2-jahres-check' },
      { id: 'rettungspacken', title: 'RETTUNGSGERÄTE-PACKSERVICE', description: 'Rettung professionell gepackt! Wir packen sie, als wäre es unsere eigene.', image: '/images/service/rettungspackservice.png', link: '/service/rettungspacken' },
      { id: 'trimmtuning', title: 'TRIMMTUNING', description: '„Trimmtuning“ – für bessere und sicherere Schirme! Mit professioneller Leinenvermessung und optimaler Einstellung der Leinenlängen mehr erreichen: Idealerweise kann so in der Luft mehr Leistung rausgeholt werden, ohne dass euer Schirm dadurch an Sicherheit verliert oder anspruchsvoller wird.', image: '/images/service/trimmtuning.jpg', link: '/service/trimmtuning' },
      { id: 'reparatur', title: 'REPARATUR-SERVICE', description: 'Defekte an der Ausrüstung? Wir bieten euch einen Reparatur Service für eure Ausrüstung an.', image: '/images/service/reparatur.jpg', link: '/service/reparatur' },
    ],
  },
  infos: {
    companyName: 'Flugschule Hirondelle',
    shopLabel: 'Shop / Theorieraum',
    shopStreet: 'Untergasse 27',
    shopCity: '69469 Weinheim',
    outpostLabel: 'Außenstelle Landau',
    outpostStreet: 'Am Birnbach 6',
    outpostCity: '76829 Landau',
    phone: '+49 (0)6201 8452097',
    email: 'info@fs-hirondelle.de',
    openingHours: 'nach Vereinbarung',
    openingHoursNote: '(Wird per Newsletter bekannt gegeben)',
    parkingNote: 'Die Parkplätze im Hof der Flugschule sind ausschließlich den Anwohnern vorbehalten. Bitte umliegend in den Straßen parken – Danke!',
    bankAccountHolder: 'Alexander Schlink',
    bankName: 'Sparkasse Südpfalz',
    iban: 'DE32 5485 0010 1700 1976 41',
    bic: 'SOLADES1SUW',
    accountNumber: '1700197641',
    bankCode: '54850010',
    routenplanerUrl: 'https://maps.app.goo.gl/kA2dQXfCx8pgAAJ99',
    mapsEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d5063.258024241909!2d8.672182056413131!3d49.555676284748415!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4797db13e510f3f5%3A0xd6abf4967e8663e9!2sFlugschule%20Hirondelle!5e1!3m2!1sde!2sde!4v1588792949558!5m2!1sde!2sde',
  },
  // The 7 /infos/* sub-pages below follow the exact same pattern - gallery
  // images are deliberately NOT part of this data (Team.tsx's shop-brand
  // logos and Gruppenevents.tsx's IMPRESSIONEN grid stay locally hardcoded
  // in their page components) since a separate admin Gallery feature
  // already manages per-page image grids.
  team: {
    eyebrow: 'INFOS',
    heading: 'DIE FLUGSCHULE HIRONDELLE',
    intro: 'Die Flugschule Hirondelle wurde 2005 gegründet ist seitdem aufs Gleitschirmfliegen spezialisiert. Ob Aus- und Weiterbildung, Ausrüstung oder Reisen – wir sind dein Ansprechpartner für alle Anliegen rund ums Fliegen!',
    ausbildungHeading: 'Ausbildung & Performance',
    ausbildungHtml: 'Unser Ziel ist es, unsere Schüler zu „selbständigen Piloten" auszubilden, die nach ihrer Ausbildung eigenständig fliegen und den Traum vom Fliegen wahr werden lassen können. Vom <a href="/ausbildung/l-schein">Grundkurs</a> über den <a href="/ausbildung/a-schein">A-Schein</a> bis zum <a href="/ausbildung/b-schein">B-Schein</a> (Unbeschränkter Luftfahrerschein / Überlandflugberechtigung) werdet ihr von Fluglehrern aus unserem Team begleitet und profitiert durch die Trainervielfalt von deren unterschiedlichen Stärken sowie individueller Tipps und Erfahrungen. Wir bieten nicht die klassische 0-8-15-Ausbildung sondern eine individuelle Ausbildung nach Maß für jedermann.',
    reisenHeading: 'Reisen',
    reisenHtml: 'Unsere <a href="/reisen">Reisen</a> führen uns in die bekannten Fluggebiet-Hotspots. So zählt <a href="/reisen/bassano-tour">Bassano</a> – das Mekka der Gleitschirmszene – jährlich fest zum Programm. Aber auch entlegene Ziele wollen wir euch nicht vorenthalten und bieten euch Reisen nach <a href="/reisen/suedafrika-tour">Südafrika</a> und weiteren besonderen Zielen weltweit an. Im Rahmen unserer <a href="/reisen">Reisen</a> könnt ihr unter Fluglehrerbetreuung sehr viel Erfahrung sammeln, eure Flugtechnik verbessern und zahlreiche großartige Flugstunden genießen.',
    teamHeading: 'DAS TEAM',
    certificateCaption: 'DHV Zertifiziert',
    members: [
      {
        name: 'Alexander Schlink',
        image: '/images/team/schlink.jpg',
        certificate: '/images/team/certificate-alex.jpg',
        paragraphs: 'Alex ist Fluglehrer, DHV-Performance-Trainer und Inhaber der Flugschule. Er ist stellvertretender Ausbildungsleiter bei Hirondelle sowie als DHV-Prüfer tätig und kann Prüfungen zum A-Schein, B-Schein sowie Winde und Tandem abnehmen.\n\nEr ist euer Ansprechpartner für alle Anliegen: ob Aus- oder Fortbildung, Ausrüstung / Material sowie auch die Organisation und Durchführung der zahlreichen Touren und Reisen innerhalb Deutschlands und weltweit über die Grenzen hinweg.\n\nNach geleistetem Wehrdienst als Fallschirmjäger und diversen exzessiv ausgeführten Hobbys (Fallschirmspringen, Motorradfahren, Tauchen,...) musste während des Studiums eine neue Herausforderung her. So hat er den Vorschlag eines Kommilitonen, es doch mal mit Gleitschirmfliegen zu probieren, zunächst nur belächelt. Und am Ende aber doch zu seiner Leidenschaft gefunden!\n\nSeine fliegerische Karriere hat im Frühjahr 2005 auf dem Übungshang begonnen. Die Prüfung zum A-Schein machte er im März 2005. Alex hat mittlerweile alle Scheine, die man im Gleitschirmbereich besitzen kann... Neben dem B-Schein hat er zusätzlich den Windenfachlehrer, Windenfahrer, die Passagierflugberechtigung, Prüferlizenz und hat auch die "Moschilizenz" (Motorschirmlizenz).\n\nAm Liebsten fliegt Alex in seiner Heimat in der Südpfalz - 7 Berge an der Zahl hat er im Pfälzer Wald quasi direkt vor seiner Haustür und nutzt diese so oft es seine Zeit erlaubt, um in die Luft oder auf Strecke zu gehen.',
      },
      {
        name: 'Sarah Fuhrmann',
        image: '/images/team/sarah.jpg',
        certificate: '',
        paragraphs: 'Sarah ist Fluglehrerin und Ausbildungsleiterin der Flugschule. Sie ist unsere Quotenfrau und das Küken im Team Hirondelle, was die fliegerische Karriere betrifft. Als sie Alex kennen lernte war sofort klar: "Das muss ich auch mal probieren!" Nach dem ersten Tandemflug in Bezau stand die Entscheidung zum Schnupperkurs und dann dem eigenen Schein. Bald wurden die Berge zu Sarah\'s neuer Bühne und die früheren Tanzschuhe endgültig an den Nagel gehängt.\n\nArbeiten, wo andere Urlaub machen, dachte sie sich 2017, hat ihrem früheren Job den Rücken gekehrt, und engagiert sich seitdem Vollzeit in der Flugschule. Nach dem B-Schein kam 2018 die Ausbildung zur Windenführerin. Mit mittlerweile weit über 3.000 durchgeführten Windenschlepps - seit 2022 auf unserer Elektrowinde - und Unterstützung bei Grundkursen, Höhenflugschulungen und den weltweit durchgeführten Reisen hat sie immer mehr Erfahrung in der Gleitschirmausbildung gesammelt. 2022 hat sie daher die Ausbildung zur Fluglehrerin begonnen und diese Ende 2023 erfolgreich abgeschlossen. Seit 2024 ist sie außerdem die Ausbildungsleiterin der Flugschule.\n\nDie Marketing-Frau von der Zeitung kümmert sich außerdem um Text und Bild. Homepage, Flyer und mehr sind ihr Metier. Und auch die Ausschreibungen und Theorieskripte entspringen ihrer Feder.',
      },
      {
        name: 'Mathias „Tobi" Leipner',
        image: '/images/team/tobi.jpg',
        certificate: '',
        paragraphs: 'Schon als Kind hat sich Tobi fürs Fliegen und ferngesteuerte Modellflugzeuge interessiert. 2002 war es dann soweit und er ist beim Schnupperkurs im Allgäu mit dem Gleitschirm selbst das erste Mal abgehoben. Seit dieser Zeit hat ihn diese intensive Erfahrung nicht mehr losgelassen. Das Erlebnis und die Faszination, selbständig nur mit den Kräften der Natur stundenlang über weite Strecken durch die Luft zu segeln, bringen ihm Ruhe und lassen ihn zeitweise alles unter sich vergessen – es ist wie Meditation.\n\nIn den Jahren folgten B-Schein, Tandemausbildung und der Fluglehrer. Seitdem freut er sich immer über die strahlenden Gesichter der Flugschüler, wenn diese ihre ersten Hüpfer am Übungshang gemacht haben.\n\nTobi fliegt sowohl in der Pfalz als auch an der Bergstraße in heimischer Luft, aber er kreist auch unter anderem gerne in Spanien mit den Geiern Auge in Auge im Thermikbart.\n\nWir sehen uns am Berg.',
      },
      {
        name: 'Holger Grimm',
        image: '/images/team/holger.jpg',
        certificate: '',
        paragraphs: 'Die Leidenschaft fürs Fliegen wurde Holger wohl in die Wiege gelegt. Anstatt des Traumberufs Luft- und Raumfahrttechniker wurde er dann aber doch Bürohengst. Doch Träume sterben nie und so hat er irgendwann nach dem B-Schein dann doch den Wunsch, Fluglehrer zu werden, in die Tat umgesetzt. Denn es gibt nichts Schöneres, als die Jubelschreie der Flugschüler/innen nach dem ersten Flug am Übungshang oder nach dem ersten "richtigen" Höhenflug zu erleben.\n\nAm Liebsten fliegt Holger in den Alpen oder in der Pfalz. Bei Flugreisen gilt in doppeltem Sinn: je weiter desto besser.',
      },
      {
        name: 'Karl-Peter Armbrust',
        image: '/images/team/karlpeter.jpg',
        certificate: '/images/team/certificate-kpa.jpg',
        paragraphs: 'Irgendwann in den 90ern sah er bei einer langen Motorradtour durch Frankreich auf der Spitze des Puy de dome bei Clermont Ferrand eine Horde Kinder mit seltsamen Fluggeräten jauchzend in der Luft rumturnen – die Eltern kreidebleich daneben, die Lehrer auch ;-) Damals kam die Idee, das auch zu tun; Jahre später dann die Realisierung: 2002 A-Schein mit Startart Hang und Winde, 2004 B-Schein und Windenführer, 2005 Passagierberechtigung mit Startart Hang und Winde. Nach vielen Reisen kam die Entscheidung, das Ganze ernsthaft anzugehen und 2014 die Ausbildung zum Fluglehrerassistenten zu absolvieren. Mittlerweile ergänzt Karl-Peter als Fluglehrer, Performance Trainer und Windenfachlehrer das Team.\n\nAch ja, Fliegen tut er auch noch gerne und zwar am Liebsten hier in Rheinland-Pfalz und dem Saarland – auch gerne ganz drüber weg ;-)',
      },
      {
        name: 'Markus Häcker – unser Tandem-Ass',
        image: '/images/team/markus.jpg',
        certificate: '',
        paragraphs: 'Markus ist schon immer in luftigen Höhen zu finden. Anfangs über die Modellfliegerei mit 14 Jahren bei den Segelfliegern, zwischendurch im Leistungssport Hoch- und Stabhochsprung. 1986 begann er mit dem Drachenfliegen und ging nahtlos 1989 zu den Pionieren der Gleitschirmfliegerei über. Mit einer über 25-jährigen Gleitschirmerfahrung hat er alle Epochen der Schirmentwicklungen mitgemacht. In den letzten Jahren konzentriert er sich sehr stark auf die Tandemfliegerei.\n\nSeine Passagiere steigen immer mit einem breiten Grinsen im Gesicht aus dem Gurtzeug mit der Aussage: „super geil, das war nicht das letzte Mal"!',
      },
    ],
    shopHeading: 'Shop',
    shopIntroHtml: 'In unserem Shop findest du alles rund um deine Ausrüstung! Wir haben die Produkte der führenden Gleitschirmhersteller in unserem Programm. Gerne beraten wir dich in unserer Flugschule. Zu unseren <a href="/infos#kontakt">Öffnungszeiten...</a>',
    shopBrands: [
      { name: 'Ozone', img: '/images/brands/ozone.jpg', url: 'http://www.flyozone.com/' },
      { name: 'Advance', img: '/images/brands/advance.png', url: 'http://www.advance.ch/' },
      { name: 'Niviuk', img: '/images/brands/niviuk.png', url: 'http://www.niviuk-gliders.at/index.php/' },
      { name: 'Phi', img: '/images/brands/phi.png', url: 'https://phi-air.com/de/' },
      { name: 'Independence', img: '/images/brands/independence.png', url: 'http://www.independence-world.com/' },
      { name: 'Skyman', img: '/images/brands/skyman.png', url: 'http://www.skyman.biz/de/' },
    ],
  },
  wetter: {
    heading: 'WETTER',
    kachelmannLinks: [
      { label: 'Kachelmann Wetter Weinbiet 4-Tage Prognose', url: '' },
      { label: 'Kachelmann Wetter Landau 4-Tage Prognose', url: '' },
      { label: 'Kachelmann Wetter Michelstadt-Vielbrunn 4-Tage Prognose', url: '' },
      { label: 'Kachelmann Wetter Kirchheimbolanden 4-Tage Prognose', url: '' },
      { label: 'Kachelmann Wetter Mannheim 4-Tage Prognose', url: '' },
    ],
    weitereLinksHeading: 'Weitere Links',
    pfalzLabel: 'Pfalz:',
    raspkartenLabel: 'Raspkarten -Thermik-Karten',
    raspkartenLinkText: '[ mehr ]',
    raspkartenUrl: '',
    appsHeading: 'Nützliche Smartphone Apps:',
    windfinderLabel: 'Windfinder (der Name ist Programm)',
    windfinderIosUrl: '',
    windfinderAndroidUrl: '',
    regenradarLabel: 'RegenRadar (Darstellung Fronten/Schauer)',
    regenradarIosUrl: '',
    regenradarAndroidUrl: '',
  },
  medien: {
    heading: 'MEDIEN',
    leftHeading: 'Events und Reisen',
    leftVideoUrl: 'https://www.youtube.com/embed/videoseries?list=PLhgO8bAZR5WcQpilBTfbEs0u0e9h0Yxg9',
    rightHeading: 'Infos rund ums Gleitschirmfliegen',
    rightVideoUrl: 'https://www.youtube.com/embed/videoseries?list=PLhgO8bAZR5We5CYDd5HqNZE04ehUf4yZU',
  },
  gruppenevents: {
    heading: 'GRUPPENEVENTS',
    introLine1: 'Du willst ein Gruppenevent planen...',
    introLine2: '... das zu einem echten Überflieger werden soll?',
    paragraph1: 'Warum dann nicht mit deinen Freunden, Familienmitgliedern oder Arbeitskollegen gemeinsam in die Luft zu gehen?',
    paragraph2: 'Bei den atemberaubenden Gleitschirmflügen hoch über dem Odenwald oder der Pfalz wird das Event zu einem unvergesslichen Erlebnis, von dem ihr noch lange zehren könnt! Jede Menge Spaß und Action sind garantiert und schweißen euch als Gruppe/Team zusammen.',
    paragraph3: 'Vom eintägigen Event bis zur mehrtägigen Veranstaltung – wir stehen für eine Eventplanung in unserer Flugschule persönlich zur Verfügung und erstellen ein Angebot nach euren individuellen Vorstellungen!',
    heroImage: '/images/gruppenevents/platzhalterbild.jpg',
    contactButtonText: 'Sprechen Sie uns an',
    rowLabel: 'Firmen oder Gruppen Events',
    rowPrice: 'Preis auf Anfrage',
    cardParagraph1: 'Sie können gerne einen Termin mit uns abstimmen der dann für Ihre Firma oder Ihre Gruppe von uns geblockt wird. Am Besten sprechen Sie direkt mit uns über Ihr Vorhaben dann können wir gemeinsam ein Konzept dafür erstellen.',
    phoneDisplay: '+49 (0)6201 8452097',
    phoneHref: '+4962018452097',
    mailtoEmail: 'info@fs-hirondelle.de',
    mailtoSubject: 'Gleitschirm Event vereinbaren',
    footerButtonText: 'Termin vereinbaren',
    galleryHeading: 'IMPRESSIONEN',
  },
  gutscheine: {
    heading: 'GESCHENK-GUTSCHEIN',
    introLine1: '...nicht schon wieder Socken ;-) ...',
    introLine2: 'Du suchst ein schönes Geschenk',
    introLine3: 'und möchtest einem lieben Menschen einen Traum erfüllen?',
    paragraph: 'Bei uns erhälst du Gutscheine für alle Kurse, Weiterbildungen, Reisen oder auch für Tandemflüge.',
    subheading: "Gutschein einlösen – so geht's",
    paragraph1: 'Unsere Gutscheine könnt ihr wie ein Zahlungsmittel einsetzen – ihr bringt sie einfach zum Termin mit!',
    paragraph2: 'Gleitschirmfliegen ist wetterabhängig. Wir brauchen Wind in richtiger Stärke und aus der geeigneten Richtung. Weil es selbst den besten Wetterfröschen kaum möglich ist, das Wetter auf längere Sicht abzuschätzen, bieten wir euch ein eigenes System zur Termin-/Ortsankündigung an, um die vereinbarten Tandemflüge und geplante Schnupperkurse sicher durchzuführen. Hierüber informieren wir euch 1 bis 2 Tage im voraus, dass das Wetter passt und wo wir mit euch fliegen können.',
    bullet1Html: '<strong>Schnupperkurs:</strong> Bei der Einlösung der Gutscheine für den <a href="/ausbildung/schnupperkurs">Schnupperkurs</a> könnt ihr euch einen Termin in unserem Kalender aussuchen und bequem online buchen. Ihr habt über den Kalender euren Wunschtermin gebucht – dann werdet ihr über unseren Schulungsnewsletter 1 Tag im voraus informiert, dass das Wetter passt und wo der Schnupperkurs stattfindet [hierfür müsst ihr euch spätestens 3 Tage vor Kursbeginn in den Schulungsnewsletter eintragen].',
    bullet2Html: '<strong>Tandemflüge:</strong> Bei der Einlösung der Gutscheine für einen Tandemflug erfolgt die Terminvergabe über unsere Tandem-Newsletter [bitte in unseren Tandem-Newsletter unten Links eintragen]. Wir informieren euch über unseren Tandem-Newsletter 1 bis 2 Tage im voraus, dass das Wetter passt und wo wir mit euch fliegen können. Weitere Infos zu unseren Tandemflügen findet ihr <a href="/tandem">hier</a>.',
    image: '/images/gutscheine/gutschein.jpg',
    shopUrl: 'https://shop.flugschule-hirondelle.de/GUTSCHEINE/Gutschein-Tandemflug-und-Schnuppertag.html',
  },
  versicherungen: {
    heading: 'VERSICHERUNGEN',
    subheading: 'Irgendwas ist immer - kurzfristig krank, und nun?',
    paragraph1: 'Ihr freut euch seit Wochen auf den Kurs und könnt aufgrund Krankheit nicht teilnehmen? Wir wollen euch eine gute Ausbildung ermöglichen und setzen daher in unseren Schulungen auf kleinere Gruppen, um eine individuelle Betreuung zu gewährleisten. Daher sind unsere Plätze limitiert und oft ausgebucht, und wir können euch bei kurzfristigen Absagen kein Geld nachlassen oder gar zurück erstatten.',
    paragraph2Html: 'Seit Coronoa haben wir immer wieder und deutlich verstärkt mit kurzfristigen Absagen und Stornos zu kämpfen. Bitte beachtet deshalb, dass eine Teilnahme bei unseren Kursen und Reisen verbindlich ist, mit eurer Kursbuchung bestätigt ihr unsere <a href="/agb">AGB</a> mit den Stornobedinungen. Hier ein Auszug:',
    stornoIntro: '7.5 Der pauschalierte Anspruch auf Rücktrittsgebühren beträgt in der Regel bei Stornierungen:',
    stornoRows: [
      { label: 'bis 4 Wochen vor Kursbeginn:', value: '25 %' },
      { label: 'bis 3 Wochen vor Kursbeginn:', value: '50 %' },
      { label: 'bis 2 Wochen vor Kursbeginn:', value: '75 %' },
      { label: 'bis 1 Woche vor Kursbeginn:', value: '100 %' },
    ],
    paragraph3Html: 'Hier findet ihr die <a href="/agb">AGB</a> in voller Länge.',
    paragraph4: 'Wir wollen euch aber nicht im Regen stehen lassen und arbeiten mit einer Versicherung zusammen, über die ihr euch für den Fall der Fälle absichern könnt.',
    seminarParagraphHtml: "Zur Teilnahme an unseren Kursen könnt ihr also eine Seminarversicherung für kleines Geld abschließen, die den Seminarpreis abdeckt. Hier geht's zur <strong>Seminarversicherung</strong>:",
    seminarUrl: 'https://secure.hmrv.de/rvw-ba/initBa.jsp?baid=68&locale=de_DE&adnr=4226825&aid=MAK126713',
    reiseParagraph1Html: 'Für unsere Reisen empfehlen wir euch außerdem <strong>Reiseversicherungen</strong> für Reiserücktritt-/Abbruch, Gepäck bzw. Auslandskrankenversicherung.',
    reiseParagraph2: "Hier geht's zu den Versicherungen:",
    insuranceLinks: [
      { label: 'Reiserücktritt/-abbruchversicherung', url: 'https://secure.hmrv.de/rvw-ba/initBa.jsp?baid=912&locale=de_DE&adnr=4226825&aid=MAK126713' },
      { label: 'Jahres-Auslandskrankenversicherung (für beliebig viele Reisen bis 56 Tage)', url: 'https://secure.hmrv.de/rvw-ba/initBa.jsp?baid=62&subBaId=2&locale=de_DE&adnr=4226825&aid=MAK126713' },
      { label: 'Reisegepäckversicherung', url: 'https://secure.hmrv.de/rvw-ba/initBa.jsp?baid=52&locale=de_DE&adnr=4226825&aid=MAK126713' },
    ],
    closingParagraph: 'So seid ihr optimal abgesichert und könnt euch ohne Risiko auf euren gebuchten Kurs freuen :-)',
    image: '/images/inhalte/hirondelle_staysafe.jpg',
  },
  gelaende: {
    heading: 'FLUGGELÄNDE ÜBERSICHT',
    introQuote: 'Die Flugschule mit Shop und Theorieraum befindet sich in Weinheim.',
    subheadingHtml: 'Die Praxiskurse finden je nach Wetter in den Geländen vor Ort statt. Für weitere Infos zu unseren Fluggeländen einfach die Ortsschilder anklicken.',
    paragraph: 'Hier findet ihr die Beschreibung der Start- & Landeplätze, die Anfahrtsbeschreibung und Infos zu Geländebesonderheiten.',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4242.9186224659925!2d8.671651451819987!3d49.555984059185896!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4797db13e510f3f5%3A0xd6abf4967e8663e9!2sFlugschule%20Hirondelle!5e1!3m2!1sde!2sde!4v1588791930011!5m2!1sde!2sde',
    schnupperkursLabel: 'Schnupper-/Grundkurs:',
    // The yellow "Ortsschild" signpost boxes under each section heading -
    // just a title (shown on the sign) and a link (where it goes, normally
    // one of the /infos/gelaende/:slug detail pages below, but free text so
    // it could point anywhere). Freely addable/removable, unlike `articles`
    // below.
    schnupperkursBoxes: [
      { title: 'Billings', link: '/infos/gelaende/billings' },
      { title: 'Erlau', link: '/infos/gelaende/erlau' },
      { title: 'Gadern', link: '/infos/gelaende/gadern' },
      { title: 'Lindenfels', link: '/infos/gelaende/lindenfels' },
      { title: 'Nonrod Nordost', link: '/infos/gelaende/nonrod-nordost' },
      { title: 'Nonroder Höhe', link: '/infos/gelaende/nonrod' },
      { title: 'Stauf', link: '/infos/gelaende/stauf' },
      { title: 'Winterkasten', link: '/infos/gelaende/winterkasten' },
    ],
    windeLabel: 'Winde:',
    windeBoxes: [
      { title: 'Bad Kreuznach', link: '/infos/gelaende/bad-kreuznach' },
      { title: 'Herrenteich', link: '/infos/gelaende/herrenteich' },
    ],
    // The actual content of each /infos/gelaende/:slug detail page (a
    // SEPARATE page from the overview above) - one row per article, each
    // with its own title and full HTML body (address, hazards, map embed
    // etc.). A box's `link` above only needs to match an article's slug
    // here if it's meant to open one of these - it isn't required to.
    articles: [
      {
        slug: 'billings',
        title: 'Billings',
        html: `<div class="col-md-7">
<div class="col-md-6">
<p><strong>Eckdaten:</strong><br />Ausrichtung: Nordwest<br />Windspektrum: 300° bis 10°<br />Höhendifferenz: 130 Meter<br />Geländehalter: 1.ODC</p>
</div>
<div class="col-md-6"><a href="http://maps.apple.com/?q=%2049.754684, 8.794765" target="_blank" rel="alternate noopener noreferrer" title="Öffnet Google Maps App"><img src="/images/Google_Routenplaner_Maps_org.gif" alt="Google Routenplaner Maps org" width="120" height="90" /></a><br /><a href="http://maps.apple.com/?q=%2049.754684, 8.794765" target="_blank" rel="alternate noopener noreferrer">Routenplaner für Smartphones</a></div>
<p><br /><strong>Adresse/ Anfahrt:</strong><br />Navi Landeparkplatz: 64405 Fischbachtal Ortsteil Billings Almenweg 1 GPS N 49°45´16.6´´ O 08°47´41.1´´ Vom Landeparkplatz zum Landeplatz: Vom Parkplatz zurück zur Brücke und auf der Meßbacher Straße leicht bergab immer Richtung Niedernhausen laufen. Die nächste links und noch ca. 100 Meter bis zu der Sitzgruppe am Landeplatz.<br /><br /></p>
<p><strong>Besonderheiten / Gefahrenquellen:<br /></strong>Stärkerer Wind kann in Billings auf Grund des vorgelagerten höheren Berges stärkere Turbulenzen verursachen. Der Wind soll in Billings eher schwach sein und aus einem Sektor zwischen 300° bis 10° kommen. Windwerte vom Melibokus liefern sehr gute Anhaltswerte (Tel: 06251/983612).</p>
<p>Bei Abwinden muss damit gerechnet werden, dass auf Grund der flachen Hangneigung auf einer der oberen Notlandewiesen gelandet werden muss. - Durch die flache Hangneigung ist es nicht immer sicher, dass man mit dem Gleitschirm über den unteren Weidezaun am Ende des Startplatzes kommt. Daher ist vorher seitlich am Hang zu landen</p>
<p>Achtung es steht eine durchgehende Baumreihe entlang des Baches nördlich des Landeplatzes Richtwerte für Flüge mit dem L-Schein: - Für Piloten mit Flugauftrag: Windrichtung zwischen 300° bis 10°; Windgeschwindigkeit im Durchschnitt kleiner 10 km/h; Spitzen kleiner 20 km/h (Richtwert für Alleinflüge mit dem Höhenflugausweis - Für Piloten mit Flugauftrag maximal 5-10 km/h</p>
<p style="text-align: center;">&nbsp;</p>
</div>
<div class="col-md-5"><iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4225.630824958612!2d8.793195951823863!3d49.754683445030565!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bd613866f97d8d%3A0xaffec9e3ca256d13!2sAlmenweg%201%2C%2064405%20Fischbachtal!5e1!3m2!1sde!2sde!4v1588792602122!5m2!1sde!2sde" width="600" height="450" style="border: 0;" tabindex="0" frameborder="0" allowfullscreen="allowfullscreen"></iframe></div>`,
      },
      {
        slug: 'erlau',
        title: 'Erlau',
        html: `<div class="col-md-6">
<div class="col-md-6">
<p><strong>Eckdaten:</strong><br />Ausrichtung: Ost<br />Windspektrum: 50° bis 110°<br />Höhendifferenz: 50 Meter<br />Geländehalter: 1.ODC</p>
</div>
<div class="col-md-6"><a href="https://maps.app.goo.gl/479uTYgErKrefYuJ8?g_st=aw"><img src="/images/Google_Routenplaner_Maps_org.gif" alt="Google Routenplaner Maps org" width="120" height="90" /></a><br /><a href="https://maps.app.goo.gl/479uTYgErKrefYuJ8?g_st=aw">Routenplaner für Smartphones</a></div>
<br /> <br /> <img src="/images/1-gelaende/erlau.JPG" alt="Erlau" class="voll" /> <br /><br /><strong>Parkplatz:&nbsp;</strong><a href="https://goo.gl/maps/kPkh6ogZp5H2">Wanderparkplatz Rodenstein</a>, 64407 Fränkisch-Crumbach<br /><br /> <strong>Adresse/ Anfahrt:</strong><br />Von Füth im Odenwald aus kommend zum Wanderparkplatz bei der Ruine Rodenstein: 100 Meter vor dem Ortsausgangsschild von 64385 Reichelsheim links ab Richtung Ruine Rodenstein / Eberbach. Durch das Örtchen Eberbach bitte mit 30 kam ha fahren. Einen km nach der Abzweigung führt ein Weg hoch, der nur für landwirtschaftlichen Verkehr freigegeben ist. Dort gerade aus (halb links) auf der normalen Straße weiterfahren. Nach weiteren 700 m kommt man dann zu einem Straßen-T an dem es links zur Ruine Rodenstein geht und rechts zum Parkplatz. Hier rechts abbiegen und den Berg hoch fahren nach 300 m beim nächsten Straßen-T links. Nach 100 m ist der große Wanderparkplatz auf der rechten Seite (49°44´03,97´´Nord 8°49´21,21´´ Ost). Oberhalb vom Parkplatz wird ein Weg vielleicht bergauf. Der Weg ist mit dem Hinweisschild „weißes Rechteck mit blauem Dreieck" gekennzeichnet. Nicht den Weg mit dem Sperr Schild nehmen. Nach 400 m kommt man an eine Gabelung, dort weiter gerade aus dem Wegweisern folgen. Nach weiteren 200 m kommt man zur nächsten Gabelung. Dort rechts halten und noch 100 m bis zum Übungshang (49°44´27,49´´Nord 8°49´28,31´´ Ost) laufen. Landeplatz 1: (49°44´28,87´´Nord 8°49´43,53´´ Ost) Landeplatz 2: (49°44´23,79´´Nord 8°49´44,29´´ Ost).<br /><br />
<p><strong>Zum Fluggelände:<br /></strong>In Erlau wird der Wind durch das U-förmige Gelände kanalisiert und sorgt somit oft für gute Startbedingungen. Bei sehr schwachem, überregionalem Wind, bildet sich morgens in Erlau ein thermisch bedingter Ostwind aus, der dann später auf die Hauptwindrichtung dreht. Bei Seitenwindlagen ist erfahrungsgemäß ein Nordschlag turbulenzarmer als ein Südschlag. Das kommt von der Leesituation durch den hohen Buchenwald auf der rechten Seite des Übungshangs. Abends setzt sich auf dem Übungshang leichter Rückenwind ein, obwohl die Windfahne am Holunderhof noch Ostwind anzeigt. Dieser Effekt erklärt sich dadurch, dass kalte schwerere Luft bodennah nach unten abfließt. Die kalte Luft bildet sich im Wald hinter dem Übungshang, der abends im Schatten liegt.</p>
<p><strong><br />Besonderheiten / Gefahrenquellen / Regeln<br /></strong>Wenn es gut trägt, kann man über den unteren Zaun fliegen und auf dem großen Landeplatz östlich des unteren Zauns landen. Trägt es weniger gut, muss vor dem Zaun am Hang mit Seitenwind gelandet werden. Piloten vom oberen Startplatz starten können im unteren Bereich des Übungshanges landen-Luftraumkontrolle! Am Vormittag nach anfangs ruhigen Flugbedingungen kann der Wind sehr schnell aufleben. Bei Weidebetrieb kann der Übungshang ab und zu gesperrt sein. In Erlau wird 30 km/h auf der Straße gefahren! Bitte daran halten.</p>
<p><strong>Richtwerte für Flüge mit dem L-Schein:</strong><br />Wetterdaten Melibokus: Windrichtung zwischen 50° bis 110°; Windgeschwindigkeit im Durchschnitt kleiner 15km/h; Spitzen kleiner 25 km/h. Wind am Hang zw. 10-12Km/h optimal |&nbsp; Tel. Melibokus : 06251 / 983612</p>
</div>
<div class="col-md-6"><iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d8454.331400063544!2d8.823493765027685!3d49.73706580741055!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bd60e4cb678049%3A0xd65ddab5f83f13a2!2sWanderparkplatz%20Rodenstein!5e1!3m2!1sde!2sde!4v1588789569688!5m2!1sde!2sde" width="600" height="450" frameborder="0" style="border:0;" allowfullscreen="" aria-hidden="false" tabindex="0"></iframe> <img src="/images/1-gelaende/Erlau_1.png" alt="" width="550" height="362" /></div>
<div>&nbsp;</div>
<div class="col-md-6"><img src="/images/1-gelaende/Erlau_2.png" alt="" width="550" height="341" /></div>`,
      },
      {
        slug: 'gadern',
        title: 'Gadern',
        html: `<div class="col-md-7">
<div class="col-md-6">
<p style="text-align: left;"><strong>Eckdaten:</strong><br />Ausrichtung: Nord-Ost<br />Windspektrum: 30° - 100°<br />Höhendifferenz: 50 Meter<br />Geländehalter: Lindenfelser Gleitschirmflieger</p>
</div>
<div class="col-md-6"><a href="https://maps.app.goo.gl/12mDeygznMrRL3da8?g_st=aw"><img src="/images/Google_Routenplaner_Maps_org.gif" alt="Google Routenplaner Maps org" width="120" height="90" /></a><br /><a href="https://maps.app.goo.gl/12mDeygznMrRL3da8?g_st=aw">Routenplaner für Smartphones</a></div>
<br /> <br /> <img src="/images/1-gelaende/gadern.JPG" alt="Gadern" class="voll" />
<p><strong>Adresse/ Anfahrt:</strong><br />69483 Wald-Michelbach<br />Ortsteil Gadern</p>
<p>Gasthaus Bergblick; Stallenkandel 5; 69483 Wald-Michelbach (GPS: 49°34´41.08´´ Nord 8°48´01,16´´ Ost)</p>
<p><a href="/pdf/Gelaendebeschreibung%20Gadern.pdf" target="_blank" rel="noopener noreferrer" class="boxblau">Download Infos &amp; Geländebeschreibung</a><br /><br /><strong>Parken am Bergblick:</strong> <br />Die Autos sollen auf dem Hof des Gasthauses geparkt werden. Ihr fahrt am Gasthaus vorbei in die Einfahrt nach unten bis zum Parkplatz. Der Parkplatz vor dem Gasthaus und gegenüber auf der Straße muss für die Tagesgäste frei bleiben.<br /><br /><strong>Vom Bergblick zum Startplatz:</strong><br />Vom Gasthaus Bergblick die Hauptstraße wieder ca. 200 Meter bergab laufen. Dort führt ein Teerweg scharf rechts ab. Diesem ca. 500 Meter bis auf die Kuppe folgen. Auf der Kuppe links und nach 100 Metern seht ihr rechts den Startplatz (GPS: 49°34´55.58´´ Nord 8°48´17,76´´ Ost)</p>
<p><strong>Besonderheiten/ Gefahrenquellen:<br /></strong>Am Vormittag nach anfangs ruhigen Flugbedingungen kann der Wind sehr schnell aufleben. Beim Aufziehen vom Gleitschirm bei stärkerem Wind kann der Schirm in den hinteren Stacheldrahtzaun geraten. Der Pilotentransport wird vom Gasthaus Bergblick aus organisiert. Maximal 3 Autos am Startplatz mit sichtbarer Auffahrgenehmigung an der Windschutzscheibe. Bei Weidebetrieb ist der Übungshang gesperrt. Die Landung erfolgt seitlich am Hang (Besonderheiten Hanglandetechnik) Stärkerer Wind von rechts verursacht ein Leegebiet hinter dem Wäldchen auf der rechten Seite vom Übungshang<br />- Es muss eine zweite Person beim Flugbetrieb anwesend sein.<br /><br /><strong>Tagesgebühr:</strong> <br />€ 2. - für alle Piloten und Flugschüler!!! Siehe Kiste im Startbereich.<br /><br /><strong>Richtwerte für Flüge mit dem L-Schein:</strong><br />Windrichtung zwischen 360° und 90°; Windgeschwindigkeit im Durchschnitt kleiner 10 km/h; Spitzen kleiner 15 km/h.&nbsp;<br /><br />Windwerte Melibokus: Tel. 06251/983612<br /><br /><strong>Beschädigungen am Viehzaun:</strong><br />Sollten irgendwelche Beschädigungen am Zaun entstanden sein, bitte unbedingt bei Familie Jöst; Gadener Straße 20 in 69483 Wald-Michelbach Ortsteil Gadern<br />melden. Der Elektrozaun funktioniert dann oft nicht mehr (Erdung), was in der Vergangenheit schon viel Ärger und unnötige Arbeit ergab.</p>
</div>
<div class="col-md-5"><iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7409.279975444094!2d8.797092468679566!3d49.58047520194445!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4797dd93b3e5ef8b%3A0xf41240f507c38b86!2sBergblick!5e1!3m2!1sde!2sde!4v1588789820942!5m2!1sde!2sde" width="600" height="450" style="border: 0;" tabindex="0" frameborder="0" allowfullscreen="allowfullscreen"></iframe></div>`,
      },
      {
        slug: 'lindenfels',
        title: 'Lindenfels',
        html: `<div class="col-md-7">
<div class="col-md-6">
<p><strong>Eckdaten:</strong><br />Ausrichtung: Süd<br />Windspektrum: 150° bis 210°<br />Höhendifferenz: 30 bis 107 Meter<br />Geländehalter: Lindenfelser Gleitschirmflieger</p>
</div>
<div class="col-md-6"><a href="https://maps.app.goo.gl/vQjqsJ1oVvcKNpkM9?g_st=aw"><img src="/images/Google_Routenplaner_Maps_org.gif" alt="Google Routenplaner Maps org" width="120" height="90" /></a><br /><a href="https://maps.app.goo.gl/vQjqsJ1oVvcKNpkM9?g_st=aw">Routenplaner für Smartphones</a></div>
<br /> <br /> <img src="/images/1-gelaende/lindenfels.JPG" alt="Lindenfels" class="voll" />
<p><strong>Adresse/ Anfahrt:</strong><br />Schwimmbadstraße 10<br />64678 Schlierbach</p>
<p>Von dort aus 100 Meter weiter Bergauffahren. Treffpunkt ist rechts am Parkplatz bei der Pferdekoppel, parken bitte in der Straße im Wald oder am Schwimmbad (im Wald weiter der Straße folgen).<br />GPS: 49°41´13.27´´ N , 8°46´08,97´´O</p>
<p><a href="/pdf/Gelaendebeschreibung%20Lindenfels.pdf" target="_blank" rel="noopener noreferrer" class="boxblau">Download Infos &amp; Geländebeschreibung</a></p>
<br />
<p><strong>Besonderheiten/ Gefahrenquellen:</strong></p>
<ul>
<li>Benutzung des unteren Übungshanges bei höherem Graswuchs ab 50 cm nicht möglich, da sonst Ertragsminderung bei der Heuernte durch zusammengetrampeltes Gras für die Bauern</li>
<li>Parken der Autos am Waldrand in der Kurve am Zugang zum oberen Übungshang ist nicht erlaubt</li>
<li>Ungeordnetes Parken bei dem Reiterhof; Behinderung der Reiter bei der Zufahrt zum Hof vermeiden</li>
<li>Erschrecken der Pferde auf der Koppel am Reiterhof vermeiden</li>
<li>Durch die flache Hangneigung ist es nicht immer sicher, dass man über die untere Baumreihe fliegt-Hanglandung vor der Baumreihe</li>
<li>Bei Aufwind und Thermik muss nach der Baumreihe abgeachtert werden</li>
<li>Durch die vorgegebene Topographie muss sich der Pilot immer auf eine Hanglandung einstellen</li>
<li>Luftraumkontrolle, da Piloten vom den oberen Startplätzen im Startbereich des unteren Startplatzes einlanden können</li>
<li>Anwesenheit: mindestens 2 Personen</li>
</ul>
<p><br /><strong>Richtwerte für Flüge mit dem L-Schein:</strong></p>
<ul>
<li>Tel. Melibokus : 06251 / 983612</li>
<li>Windmessstation Lindenfels 0176-63307995</li>
<li>Windrichtung zwischen 150° bis 210°; Windgeschwindigkeit im</li>
<li>Durchschnitt kleiner 10 km/h; Spitzen kleiner 15 km/h</li>
</ul>
</div>
<div class="col-md-5"><iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4231.533100041694!2d8.767622333468386!3d49.68691069271673!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4797df5ee53e39f7%3A0x150235a5aaa4c8e8!2sReit-%20und%20Fahrverein%20Nibelungen%20e.V.!5e1!3m2!1sde!2sde!4v1588790231627!5m2!1sde!2sde" width="600" height="450" style="border: 0;" tabindex="0" frameborder="0" allowfullscreen="allowfullscreen"></iframe></div>`,
      },
      {
        slug: 'nonrod-nordost',
        title: 'Nonrod Nordost',
        html: `<div class="col-md-7">
<div class="col-md-6">
<p><strong>Eckdaten:</strong><br />Ausrichtung: Nordost<br />Windspektrum: 10° bis 60°<br />Höhendifferenz: 31 Meter<br />Geländehalter: Flugschule Hirondelle</p>
</div>
<div class="col-md-6"><a href="https://maps.app.goo.gl/TuBxGE89oS9MJRqKA?g_st=aw"><img src="/images/Google_Routenplaner_Maps_org.gif" alt="Google Routenplaner Maps org" width="120" height="90" /></a><br /><a href="https://maps.app.goo.gl/TuBxGE89oS9MJRqKA?g_st=aw">Routenplaner für Smartphones</a></div>
<p><br /><strong>Adresse/ Anfahrt:</strong><br />64405 Fischbachtal<br />Ortsteil Nonrod</p>

<p><br /><strong>Parkplatz:</strong><br />Das Material kann am Fluggelände abgeladen werden.<br />Geparkt wird am Rast-und Parkplatz Nonroder Höhe (GPS ´49°45´21,15´´ 8°49´45,15´´) <br /><br />Wegbeschreibung: An der Haselnussgruppe auf dem Höhenweg weiter Richtung Norden fahren. Nach ca. 200 Meter kommt der Parkplatz auf der rechten Seite.</p>
</div>
<div class="col-md-5"><iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4451.539088793464!2d8.821831558418785!3d49.75005980309465!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bd61cb2b29affb%3A0xcf99bf11be67ae85!2sNonroder%20H%C3%B6he!5e1!3m2!1sde!2sde!4v1588790674160!5m2!1sde!2sde" width="600" height="450" frameborder="0" style="border:0;" allowfullscreen="" aria-hidden="false" tabindex="0"></iframe></div>`,
      },
      {
        slug: 'nonrod',
        title: 'Nonroder Höhe',
        html: `<div class="col-md-7">
<div class="col-md-6">
<p><strong>Eckdaten:</strong><br />Ausrichtung: West bis Nord<br />Optimale Ausrichtung: Nordwest<br />Windspektrum: 270° bis 360°<br />Höhendifferenz: 50 Meter<br />Geländehalter: Flugschule Hirondelle</p>
</div>
<div class="col-md-6"><a href="https://maps.app.goo.gl/mnKkez6nw1gWdnV36?g_st=aw"><img src="/images/Google_Routenplaner_Maps_org.gif" alt="Google Routenplaner Maps org" width="120" height="90" /></a><br /><a href="https://maps.app.goo.gl/mnKkez6nw1gWdnV36?g_st=aw">Routenplaner für Smartphones</a></div>
<br /> <br /> <img src="/images/1-gelaende/nonrod.JPG" alt="Nonrod" class="voll" />
<p><strong>Adresse/ Anfahrt:</strong><br />Am Lohberg 3<br />64405 Fischbachtal<br />Ortsteil Nonrod</p>
<p>Dort rechts die Schottereinfahrt hoch fahren, GPS: 49°45´18.77´´ N , 8°49´19,52´´O<br /><br /></p>
<p>&nbsp;</p>
<p><strong>Besonderheiten / Gefahrenquellen:</strong></p>
<ul>
<li>Die besten Flugbedingungen stellen sich an dem nordwestlich ausgerichteten Hang oft am späten Nachmittag ein. Vom Fischbachtal kommt weht der Wind Richtung Nonroder Höhe und steht dann ideal am Übungshang an.</li>
<li>Kleines Leegebiet hinter dem Wald links vom Landeplatz</li>
<li>Fliegen auf dem Gelände: Mindestens zwei Personen müssen anwesend sein!!!</li>
</ul>
<p><br /><strong>Richtwerte für Flüge mit dem L-Schein:</strong></p>
<ul>
<li>Windrichtung zwischen 270° bis 360°; Windgeschwindigkeit im Durchschnitt kleiner 10 km/h; Spitzen kleiner 15 km/h.</li>
</ul>
<p><strong>Zum Fluggelände:</strong><br />An der Halle vorbei (siehe Googleearthbild) dort hängt der Briefkasten und die Umschläge zum Bezahlen. Bitte nochmals dort die Flugregeln durchlesen. Tagesgebühr von 2,- € für jeden Flieger.<br /><br /><strong>Parken bei wenig Flugbetrieb:</strong><br />Parken unten entlang der Straße „Am Lohberg" könnt ihr die Autos parken oder hinter der Halle (nach Einweisung durch die Eigentümerin). Bitte nicht im Ort parken!<br /><br /><strong>Parken bei viel Flugbetrieb:</strong><br />Das Material kann am Fluggelände abgeladen werden. Geparkt wird am Rast-und Parkplatz Nonroder Höhe (GPS´49°45´21,15´´8°49´45,15´´) Wegbeschreibung: Zurück zur Ortsdurchfahrtsstraße (Rodensteiner Straße). Dort links und nach ca. 300 Meter wieder links. 150 Meter gerade aus bis zur Haselnussgruppe. Dort links auf dem Schotterweg bis im Wald auf der rechten Seite der Parkplatz kommt. Wenn ihr zurück lauft den gleichen Weg benutzen und nicht über die Felder der Bauen laufen…gab schon Ärger!</p>
<p style="text-align: center;">&nbsp;</p>
</div>
<div class="col-md-5"><iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2357.8804577125984!2d8.82110668090161!3d49.75501531322468!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bd60d7f43e4385%3A0x15cabe4b43fddd4!2sAm%20Lohberg%203%2C%2064405%20Fischbachtal!5e1!3m2!1sde!2sde!4v1588790435591!5m2!1sde!2sde" width="600" height="450" style="border: 0;" tabindex="0" frameborder="0" allowfullscreen="allowfullscreen"></iframe></div>`,
      },
      {
        slug: 'stauf',
        title: 'Stauf',
        html: `<div class="col-md-7">
<div class="col-md-6">
<p><strong>Eckdaten:</strong><br />Ausrichtung: Südost<br />Windspektrum: 90° bis 190°<br />Höhendifferenz: 70 Meter<br />Geländehalter: Fliegergemeinschaft Stauf e.V.</p>
</div>
<div class="col-md-6"><a href="https://maps.app.goo.gl/b7Wia7fqkfawjEYe8?g_st=aw"><img src="/images/Google_Routenplaner_Maps_org.gif" alt="Google Routenplaner Maps org" width="120" height="90" /></a><br /><a href="https://maps.app.goo.gl/b7Wia7fqkfawjEYe8?g_st=aw">Routenplaner für Smartphones</a></div>
<br /> <br /> <img src="/images/1-gelaende/stauf.JPG" alt="Stauf" class="voll" />
<p><strong>Adresse/ Anfahrt:</strong></p>
<p>Parkplatz:</p>
<p>67304 Eisenberg,&nbsp;Ortsteil Steinborn (nicht Stauf!), Ramsener Straße&nbsp;<br />Parkplatz am Wendehammer im Feld<br />GPS N 49°33´00.9´´ O 08°01´41.0´´</p>
<p>Adresse Startplatz:</p>
<p>67304 Eisenberg<br />Ortsteil Stauf Talstraße 12<br />GPS N 49°33´00.9´´ O 08°01´41.0´´&nbsp;</p>
<p><img src="/images/1-gelaende/stauf.png" alt="Anfahrt und Parkplatz Stauf" width="500" height="436" /></p>
<p><br /><strong>Achtung:</strong> <br />Sollten wir links in der Rinne schulen, bitte unbedingt die Wege benutzen und nicht quer über die Wiese laufen. Bitte haltet euch daran... es gab schon richtig Ärger deswegen!!!</p>
<p><strong>Besonderheiten / Gefahrenquellen:</strong></p>
<ul>
<li>Durch die Kuppenlage des Staufer Hügels kommt der Wind oft von der Seite. Haben die Schornsteine in der Rheinebene einen kleinen Westschlag, ist das ein eher schlechtes Zeichen für Stauf da der Wind dann von rechts kommt.</li>
<li>Schnelle Windzunahme bei thermischen Südostwindwetterlagen am mittleren/späten Vormittag</li>
<li>Piloten, die vom Kuppen- Startplatz starten und über die Piloten vom Plateau- Startplatz fliegen</li>
<li>Hecken und Weidezaun und die unten zu überfliegende Straße stellen Hindernisse dar</li>
<li>Sollte jemand über dem Zaun landen bitte durch die Tür mit dem</li>
<li>Zahlenschloss gehen Nr. 1102 und nicht über den Zaun steigen</li>
</ul>
<p><strong>Richtwerte für Flüge mit dem L-Schein:</strong></p>
<ul>
<li>Für Piloten mit Flugauftrag: Windrichtung zwischen 90° bis 190°; Windgeschwindigkeit im Durchschnitt kleiner 10 km/h; Spitzen kleiner 15 km/h. Ebenso sollten sich die Winddaten mit der Wetterstation der Kalmit decken.</li>
</ul>
<p><strong>Melibokus / Kalmit Wetterstationen:</strong></p>
<p>Der Melibokus (Tel.: 06352/983612) liegt ca. 60 km in Richtung Nord-Ost und die<br />Kalmit (Tel.: 06322/7909533) ca. 35 km südlich.<br /><br />Die Windwerte der Wetterstationen sollen nur als Anhaltswerte dienen.</p>
<p style="text-align: center;">&nbsp;</p>
</div>
<div class="col-md-5"><iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1310.1508451382992!2d8.036379621411072!3d49.546655368246505!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47963ce4f463a439%3A0x2cf394f792cc59dc!2sRamsener%20Str.%2C%2067304%20Ramsen!5e0!3m2!1sde!2sde!4v1588789021619!5m2!1sde!2sde" width="600" height="450" style="border: 0;" tabindex="0" frameborder="0" allowfullscreen="allowfullscreen"></iframe></div>`,
      },
      {
        slug: 'winterkasten',
        title: 'Winterkasten',
        html: `<div class="col-md-7">
<h2>Flugbetrieb nur bei Anwesenheit der Flugschule!</h2>
<p>&nbsp;</p>
<div class="col-md-6">
<p><strong>Eckdaten:</strong><br /> Ausrichtung: Südost-Süd<br />Windspektrum: 120° bis 180°<br />Höhendifferenz: 80 Meter<br />Geländehalter: Flugschule Hirondelle</p>
</div>
<div class="col-md-6"><a href="http://maps.apple.com/?q=%2049.699875,%208.791619"><img src="/images/Google_Routenplaner_Maps_org.gif" alt="Google Routenplaner Maps org" width="120" height="90" /></a><br /><a href="http://maps.apple.com/?q=%2049.699875,%208.791619">Routenplaner für Smartphones</a></div>
<p><strong>Adresse/ Anfahrt:</strong><br />64678 Lindenfels<br />Ortsteil Winterkasten</p>
<p><a href="/pdf/Gelaendebeschreibung%20Winterkasten.pdf" target="_blank" rel="noopener noreferrer" class="boxblau">Download Infos &amp; Geländebeschreibung</a></p>
<p><br /><strong>Parkplatz:<br /></strong>Bismarckturmstraße 7, 64678<br />Lindenfels Ortsteil Winterkasten<br />GPS N 49°41´59,31´´ O 08°47´29,71´´</p>
<p><strong>Vom Parkplatz zum Fluggelände:</strong><br />Die Bismarckturmstraße ca. 100 Meter weiter bis zur Hauptstraße laufen. Dort links und nach 50 Meter rechts in den Laudenauer Weg. Nach ca. 100 Meter<br />links den Feldweg zum Startplatz GPS N 49°42´06,07´´ O 08°47´47.18´´laufen.</p>
</div>
<div class="col-md-5"><iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d8460.761300862583!2d8.787677443086652!3d49.70014901142218!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bd61cf3112d683%3A0x92442aec10e628fa!2sBismarckturmstra%C3%9Fe%207%2C%2064678%20Lindenfels!5e1!3m2!1sde!2sde!4v1588790846657!5m2!1sde!2sde" width="600" height="450" frameborder="0" style="border:0;" allowfullscreen="" aria-hidden="false" tabindex="0"></iframe></div>`,
      },
      {
        slug: 'bad-kreuznach',
        title: 'Bad Kreuznach',
        html: `<h2>Schleppgelände "Auf dem unteren Mergesfeld"</h2>
<div class="col-md-6">
<div class="col-md-6"><br />
<p><strong>Eckdaten:</strong><br />55595 St. Katharinen N 49°52´26" O 07°46´19"<br />Ausrichtung: SO,NW Schlepplänge 1000m&nbsp;</p>
</div>
<div class="col-md-6"><a href="https://maps.app.goo.gl/EDBjt7yqxjycCQ6K7" rel="alternate"><img src="/images/Google_Routenplaner_Maps_org.gif" alt="Google Routenplaner Maps org" width="120" height="90" /></a><br /><a href="https://maps.app.goo.gl/EDBjt7yqxjycCQ6K7" rel="alternate">Routenplaner für Smartphones</a></div>
<br /> <br /> <img src="/images/1-Bilderfuernewsletter/winde_.jpg" alt="Winde Unteres Mergesfeld" class="voll" />
<p><strong>Anfahrt:</strong></p>
<p>Koordinaten fürs Navi zur groben Anfahrt: 55595 St. Katharinen, Am Roten Berg.&nbsp;</p>
<p>Der Parkplatz zur Schleppstrecke befindet sich je nach Windrichtung am jeweiligen Ende der Schleppstrecke.</p>
<p><img src="/images/1-gelaende/Winde_BK.jpg" alt="Winde BK" class="voll" /></p>
<p>&nbsp;</p>
<p style="align: center;"><b>&nbsp;</b></p>
</div>
<div class="col-md-6"><iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1114.0837256408527!2d7.7706789!3d49.8734767!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bdfb851f76b23b%3A0xe949a328638b87aa!2sFluggel%C3%A4nde%20Drachen-%20und%20Gleitsegelclub%20Nahetal!5e1!3m2!1sde!2sde!4v1742289349048!5m2!1sde!2sde" width="600" height="450" style="border:0;" referrerpolicy="no-referrer-when-downgrade" loading="lazy" allowfullscreen="allowfullscreen"></iframe></div>`,
      },
      {
        slug: 'herrenteich',
        title: 'Herrenteich',
        html: `<div class="col-md-7">
<div class="col-md-6">
<p><strong>Eckdaten:</strong></p>
<p>Der Flugplatz Herrenteich liegt ca. 15 km südlich vom Flugplatz Mannheim-Neuostheim entfernt (am Rheindamm zwischen Ketsch und Speyer).<br />Koordinaten: 49°20´46'' N&nbsp; 08°29´19´´ E.</p>
</div>
<div class="col-md-6"><a href="https://maps.app.goo.gl/149VWUMKxaXUJCvY8?g_st=aw" rel="alternate"><img src="/images/Google_Routenplaner_Maps_org.gif" alt="Google Routenplaner Maps org" width="120" height="90" /></a><br /><a href="https://maps.app.goo.gl/149VWUMKxaXUJCvY8?g_st=aw" rel="alternate">Routenplaner für Smartphones</a></div>
<div>&nbsp;</div>
<br /> <img src="/images/1-gelaende/winde_herrenteich.jpg" alt="Winde Herrenteich" class="voll" />
<p style="align: center;"><b>Tipp für Navigationssysteme<br /></b>Der Flugplatz Herrenteich gehört örtlich zur Gemeinde Hockenheim. Deshalb in den Navigationssystemen zuerst den Ort Hockenheim auswählen und dann als Sonderziel/Straße Herrenteich eingeben</p>
<ul>
<li><b>Beschreibung von Schwetzingen, Ketsch, Plankstadt, Oftersheim und Heidelberg</b><br /> In Schwetzingen am Schloßgarten vorbei in Richtung Hockenheim fahren. Kurz nachdem Verlassen des Ortes nach rechts in Richtung Ketsch abbiegen. In Ketsch folgt man der Hauptstraße ganz durch den Ort. Am Ende der Straße biegt man an der Kirche rechts und gleich darauf, ca. 20 Meter später, an der Eisdiele wieder links ab (in Richtung Speyer). Sie befinden sich jetzt am Altrhein. Von hier aus sind es noch ca. 3,5 Kilometer auf dem Rheindamm bis zum Flugplatz Herrenteich, vorbei am Ketscher Frei- und Hallenbad und am Hohwiesensee (kostenloser Badesee).&nbsp;</li>
<li><b>Beschreibung von Hockenheim</b><br /> Von Hockenheim in Richtung Talhaus und weiter nach Ketsch. In Ketsch immer der Straße folgen. An der Kirche (auf der rechten Seite) links in Richtung Speyer abbiegen. Von dort sind es dann noch ca. 3,5km auf dem Rheindamm bis zum Flugplatz Herrenteich.</li>
<li><b>Beschreibung von Speyer, Waldsee, Otterstadt und Römerberg</b><br /> Von Speyer über die Rheinbrücke (B39) in Richtung Ketsch. Gleich nachdem Überqueren des Rheins an der Ampel rechts in Richtung Altlußheim abbiegen. Nach ca. 500m rechts in Richtung Herrenteich abbiegen. Auf dem Rheindamm entlang zum Flugplatz Herrenteich.</li>
<li><b>Beschreibung von Altlußheim, Neulußheim, Reilingen, Rheinhausen, Waghäusel<br /> </b>Auf der B39 in Richtung Speyer. Kurz nach Altlußheim links auf den Rheindamm in Richtung Herrenteich abbiegen.</li>
<li><b>Beschreibung von Brühl und Rohrhof</b><br /> Von Brühl in Richtung Ketsch. In Ketsch der Straße folgen und nachdem die Straße eine 90°-Kurve nach links gemacht hat, gleich nach rechts in Richtung Speyer abbiegen (auf der linken Seite befindet sich eine Kirche). Auf dem Rheindamm entlang zum Flugplatz Herrenteich.</li>
<li><b>Beschreibung von Mannheim, Rheinau, Neckarau über die B36</b><br /> Auf der B36 in Richtung Süden kurz nach Rheinau am Wal-Mart/McDonald's rechts in Richtung Ketsch abbiegen. An der Ampel nach dem McDonald's geradeaus in Richtung Ketsch. Die Schnellstraße läuft jetzt parallel an der Autobahn. An der 2. Ausfahrt (Ketsch/Schwetzingen) abfahren und dann rechts nach Ketsch. Der Straße durch Ketsch folgen und am Ende der Straße rechts und gleich wieder links in Richtung Speyer/Altußheim. Auf dem Rheindamm sind es jetzt noch ca. 3,5km bis zum Flugplatz Herrenteich.</li>
<li><b>Beschreibung von Autobahn A6</b><br /> Autobahn A6 an der Anschlussstelle Mannheim/Schwetzingen (28) in Richtung Mannheim-Rheinau/Brühl verlassen. Auf der Bundesstrasse gleich wieder rechts nach Ketsch/Brühl. An der 2. Ampel links nach Ketsch/Hockenheim. Die Schnellstraße läuft jetzt parallel an der Autobahn. An der 2. Ausfahrt (Ketsch/Schwetzingen) abfahren und dann rechts nach Ketsch. Der Straße durch Ketsch folgen und am Ende der Straße rechts und gleich wieder links in Richtung Speyer/Altußheim. Auf dem Rheindamm sind es jetzt noch ca. 3,5km bis zum Flugplatz Herrenteich.</li>
<li><b>Beschreibung von Autobahn A61</b><br /> Die Autobahn A61 an der Anschlussstelle Hockenheim (64) verlassen und in Richtung Speyer fahren. An der kommenden Ampel nach links in Richtung Altlußheim abbiegen und darauf gleich wieder rechts in Richtung Herrenteich. Auf dem Rheindamm weiter zum Flugplatz Herrenteich.</li>
</ul>
<br /><strong>Regelung des Flugbetriebes der Gleitschirmflieger auf dem Flugplatz</strong> <br />
<ul>
<li>Die Sonderregelungen für Gleitsegelschleppbetrieb auf Flugplätzen sind zu beachten. (B-Schein Theorie; gültiger Schleppschein)</li>
<li>Den diensthabenden Flug- und Startleitern ist Folge zu leisten. Der Platzflugbetrieb darf nicht behindert oder gefährdet werden. Achtung auf anfliegende Flugzeuge! Die aktuellen Flugbetriebsbedingungen sind beim Flugleiter zu erfragen.</li>
<li>Die Starts von Flugzeugen und GS finden nach Absprache statt.</li>
<li>Eine Freigabe muß vor jedem Schleppvorgang beim diensthabenden Flugleiter eingeholt werden.</li>
</ul>
</div>
<div class="col-md-5"><iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2599.1430771527293!2d8.487383951816065!3d49.3494404738568!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4797b7ad0395ad27%3A0x734a880cb7968ffa!2sFlugplatz%20Herrenteich!5e0!3m2!1sde!2sde!4v1588788513704!5m2!1sde!2sde" width="600" height="450" style="border: 0;" tabindex="0" frameborder="0" allowfullscreen="allowfullscreen"></iframe></div>`,
      },
    ],
  },
  schnupperkurs: {
    eyebrow: 'AUSBILDUNG',
    title: 'Schnupper- / Einsteigerkurs',
    heroImage: '/images/schnupperkurs/hero.jpg',
    heroImageAlt: 'Schnupperkurs',
    block1Heading: 'Der Anfang einer neuen Leidenschaft...',
    block1Text: "Am Schnuppertag / Einsteigerkurs lernst du die Grundzüge des Gleitschirmfliegens kennen. Anfängliche Aufzieh- und Laufübungen bereiten dich auf deine ersten Flüge vor: Kappe auslegen, Leinen sortieren, Eintrittsöffnungen kontrollieren, damit der Gleitschirm anschließend richtig über euch steigt. Gurtzeug anlegen, Startcheck und los geht's zum ersten Versuch. Wenn alles klappt und der Wind passt, spürt ihr den Auftrieb, der euch immer leichter werden lässt.",
    block2Heading: 'Ab in die Luft...',
    block2Text: 'Die Grundlagen für die ersten kleinen Flüge sind geschafft. Der Wind passt, die Startvorbereitungen sind ausgeführt und der Fluglehrer gibt dir Kommandos über Funk. Der Schirm steigt über dich, und du beschleunigst. Schritt für Schritt wirst du schneller und schließlich hebst du ab. Ein Moment des Gleitens, der Boden kommt wieder näher, Landung. Dein erster Flug ist geschafft – was für ein Gefühl! Step by Step erklimmen wir den Übungshang und arbeiten uns immer weiter hinauf in die Luft! Ziel für den Schnupperkurs sind Flüge mit 40 bis 60 Metern Höhendifferenz. Zwischendurch erfahrt ihr Wissenswertes über Gerätekunde und Flugpraxis.',
    block3Heading: 'Organisatorisches...',
    block3Html: 'Ort und Uhrzeit des Schnupperkurses erfahrt ihr am Vortag bis ca. 15 Uhr per Newsletter. Der eintägige Schnuppertag findet regulär samstags statt, je nach Wetter kann der Termin allerdings auch auf den Sonntag verschoben werden. Je nach Windrichtung schulen wir an einem unserer Übungshänge im Odenwald, Kraichtal, Nahetal und der Pfalz. Die Wegbeschreibungen zu den jeweiligen <a href="/infos/gelaende" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Fluggeländen findet ihr hier</a>. Eine aktuelle und sichere Leihausrüstung sind im Preis inbegriffen. Wenn aufgrund der Wetterlage der Kurs ausfällt oder nicht vollständig absolviert werden kann, ist es möglich, diesen zu einem späteren Termin kostenlos nachzuholen, tragt euch dazu bitte an einem neuen Termin über unseren Buchungskalender ein.',
    block4Heading: 'Wie geht es weiter...',
    block4Html: "Weiter geht's mit dem <a href=\"/ausbildung/l-schein\" class=\"text-[#428bca] hover:text-[#2a6496] hover:underline font-medium\">Grundkurs</a>! Die absolvierten Tage im Schnupperkurs sowie der anteilige Kurspreis werden euch hierfür angerechnet und abgezogen (gültig innerhalb der gleichen Saison!).",
    bookingButtonText: 'Kurs buchen',
    bookingButtonLink: '/events?category=Schnupperkurs',
    priceHeading: 'Kurspreis',
    priceRows: [
      { label: 'Schnuppertag 1-tägig Samstag,\nwetterbedingt kann auf Sonntag verschoben werden', price: '149,- €' },
      { label: 'Einsteigerkurs 2-tägig Samstag & Sonntag', price: '250,- €' },
    ],
    scheduleButtonText: 'Termine > Siehe Liste',
    scheduleButtonLink: '/events?category=Schnupperkurs',
    gutscheinHeading: 'Schnupperkurs Verschenken',
    gutscheinDescription: 'Der Schnupperkurs ist auch als Geschenk-Gutschein möglich',
    leistungenHeading: 'Unsere Leistungen',
    leistungen: [
      'Theorie- und Praxisausbildung durch zertifizierte Fluglehrer',
      'Neue und sichere Leihausrüstung',
      'Funkausrüstung und -betreuung',
      'Haftpflichtversicherung',
    ],
    checklisteHeading: 'Deine Checkliste',
    checkliste: [
      'Lust aufs Fliegen',
      'Mindestalter: 14 Jahre (mit Einverständniserklärung der Erziehungsberechtigten!)',
      'Überknöchelhohe Schuhe, wir empfehlen spezielle Flugschuhe oder zumindest Wanderschuhe',
      'Outdoor-Bekleidung, je nach Wetter Wechselkleidung',
      'Ausreichend Getränke und Verpflegung (Fliegen macht hungrig!)',
      'Sonnencreme',
    ],
  },
  'l-schein': {
    eyebrow: 'AUSBILDUNG',
    heading: 'L-Schein',
    videoUrl: 'https://www.youtube.com/embed/fEQXD2JxcBU?rel=0',
    videoTitle: 'Gleitschirm Grundkurs - Einblick in unsere Schulung | Flugschule Hirondelle',
    contentBlocks: [
      {
        heading: 'Du legst den Grundstein...',
        html: 'Aufbauend auf den <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> werden im Grundkurs die fehlenden Flüge zur Erlangung des L-Scheins absolviert. Ziel des Kurses ist es, mindestens 15 Flüge am Hang oder an der <a href="/ausbildung/winde" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Winde</a> zu absolvieren, bei denen die Höhendifferenz schon bis zu 200 Meter betragen kann. Kurvenflug und Schirmkontrolle sind einige der Lerninhalte, die in diesem Kurs auf dem Lehrplan stehen. In der Ausbildung erlernst du das Grundwissen in Theorie und Praxis. Mit dem erlangten Lernausweis könnt ihr dann später an den Übungshängen, an denen ihr im Grundkurs mindestens 5 Flüge absolviert habt, auch selbständig fliegen.',
      },
      {
        heading: 'Was dich beim Grundkurs erwartet...',
        html: 'Steigst du direkt mit dem Grundkurs ein (ohne vorherigen <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a>), beginnen wir zunächst mit Aufzieh- und Laufübungen im flachen Gelände und arbeiten uns dann immer weiter den Hang hinauf. Bei den 15 für den Grundkurs benötigten Flügen verfeinern wir Start, Flug-, Steuer- und Landetechnik mit Hilfe ständiger Funkbetreuung. Außerdem werden die theoretischen Lerninhalte des <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurses</a> vertieft und ergänzt. Das Wechselspiel zwischen kurzen theoretischen Erklärungen und der direkten praktischen Umsetzung am Übungshang lassen eure Flugtechnik schnell Fortschritte machen.',
      },
      {
        heading: 'Alles nach Plan...',
        html: 'Bei den Flügen werden die Lerninhalte aus dem Lehrplan abgearbeitet und falls erforderlich für die Fluggelände ergänzt. Der Lehrplan wird den Flugschulen vom <a href="https://www.dhv.de/" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Deutschen Hängegleiterverband (DHV)</a> vorgegeben und ist für die Gleitschirmausbildung verpflichtend. Da jeder Schüler das Gelernte unterschiedlich schnell umsetzt, kann jeder seine Flüge innerhalb des Kurses in eigenem Tempo absolvieren. Das heißt, ihr kommt so oft dazu, bis ihr die 15 Flüge voll habt. Im Kurspreis sind 2-4 Tage inkludiert, weitere notwendige Tage können gegen einen geringen Aufpreis dazu gebucht werden. Uns ist wichtig, dass euch die Gleitschirmschulung Spaß macht und sie fundiert und sicher abläuft. Habt ihr vorher einen <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> absolviert, so werden die absolvierten Tage sowie der anteilige Kurspreis beim Grundkurs verrechnet und abgezogen (gültig innerhalb der gleichen Saison!).',
      },
      {
        heading: 'Organisatorisches...',
        html: 'Ort und Uhrzeit der Kurstermine erfahrt ihr am Vortag bis ca. 15 Uhr per Newsletter. Die Termine finden flexibel an Wochenenden wie auch unter der Woche statt. Je nach Wetterlage (und vor allem Windrichtung) schulen wir an einem unserer Übungshänge im Odenwald, Kraichtal, Nahetal und der Pfalz. Die Wegbeschreibungen zu den jeweiligen <a href="/infos/gelaende" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Fluggeländen findet ihr hier</a>. Das Skript zum Kurs und eine aktuelle Leihausrüstung sind wie beim <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> im Preis inbegriffen.',
      },
      {
        heading: 'Wie geht es weiter...',
        html: "Weiter geht's mit dem <a href=\"/ausbildung/a-schein\" class=\"text-[#428bca] hover:text-[#2a6496] hover:underline font-medium\">A-Schein</a> – dem Höhenflugausweis zum selbständigen Fliegen!",
      },
    ],
    bookingLink: '/events?category=Grundkurs',
    priceRows: [
      { title: 'Grundkurs / L-Schein', subtitle: '[ mehrtägiger Kurs 2-4 Tage mit Fluggarantie ]', price: '620,- €' },
      { title: 'Zusatztage > 4 Tage - Preis pro Tag', subtitle: '', price: '149,- €' },
      { title: 'Kombikurs*:', subtitle: 'Grundkurs & A-Scheinkurs Woche 1', price: '1.590,- €' },
      { title: 'Kombikurs Kompakt*:', subtitle: 'Grundkurs & Winde & A-Scheinkurs Woche 1', price: '1.990,- €' },
    ],
    priceFootnoteHtml: '*Kursgebühren mit bei uns gekaufter Ausrüstung / Leihausrüstung siehe <a href="/ausbildung/a-schein#zusatzkosten" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-bold">Zusatzkosten</a> A-Schein',
    scheduleLink: '/events?category=Grundkurs',
    gutscheinHeading: 'Grundkurs Verschenken',
    gutscheinDescription: 'Der Grundkurs ist auch als Geschenk-Gutschein möglich',
    leistungen: [
      'Theorie- und Praxisausbildung durch zertifizierte Fluglehrer',
      'Neue und sichere Leihausrüstung',
      'Funkausrüstung und -betreuung',
      'Haftpflichtversicherung',
    ],
    checkliste: [
      'Lust aufs Fliegen',
      'Mindestalter: 14 Jahre (mit Einverständniserklärung der Erziehungsberechtigten!)',
      'Überknöchelhohe Schuhe, wir empfehlen spezielle Flugschuhe oder zumindest Wanderschuhe',
      'Outdoor-Bekleidung, je nach Wetter Wechselkleidung',
      'Ausreichend Getränke und Verpflegung (Fliegen macht hungrig!!!)',
      'Sonnencreme',
    ],
  },
  rettungsgeraetetraining: {
    eyebrow: 'PERFORMANCE',
    heading: 'Rettungsgerätetraining',
    videoUrl: 'https://www.youtube-nocookie.com/embed/8KKXgu00pUw?rel=0',
    videoTitle: 'Rettungsgeräte packen & werfen (Seminar) - Paragliding lernen | Flugschule Hirondelle',
    section1Heading: 'Sicher in allen Situationen...',
    section1Paragraph: 'Gleitschirmfliegen ist eigentlich eine sehr sichere Sache – aber dennoch kann es vorkommen, dass ihr in eine Situation geratet, die für euch als Pilot unbeherrschbar ist. Ein Muss für jeden Gleitschirm- und Drachenpiloten ist daher ein Rettungsgerätewurftraining mit der eigenen Ausrüstung. Ebenso ist das Training für die B-Scheinausbildung gemäß Prüfungsordnung vorgeschrieben.',
    section2Heading: 'Drei Schritte für mehr Sicherheit',
    section2Paragraph1: 'Das Rettungsgerätetraining gliedert sich in drei Teile. Im ersten Teil wird in der Theorie erklärt, in welchen Situationen das Rettungsgerät zum Einsatz kommen soll. Dies können z.B. unkontrollierte Flugzustände, Materialversagen oder Kollisionen mit anderen Luftfahrzeugen sein. Ebenso wird der eigentliche Rettungsgerätewurf und die entsprechenden Varianten näher erläutert. Die Theorie wird mit einem kurzen Lehrfilm vom DHV abgerundet.',
    section2Paragraph2: 'Im zweiten Teil wird anschließend das Rettungsgerät so mit einer Wurfhilfe vorbereitet, dass die Rettung beim Wurftraining nicht ganz öffnet. Dabei dokumentieren wir, wie das Rettungsgerät im Außencontainer eingebaut ist. Jeder Pilot erhält dazu sein eigenes Packset mit den entsprechenden Materialien, wie Leinenkamm, Sandsäcke, Packklammern, Packschnur usw. Jetzt wird das Rettungsgerät zweimal mit der Wurfhilfe ausgelöst. Sollten jetzt bei der Auslösung Probleme auftreten, können diese gut erkannt und abgestellt werden. Ein anderer Einbau wird in diesem Fall neu dokumentiert. Auslöseprobleme können unter anderem sein, wenn das Rettungsgerät falsch in das Gurtzeug eingebaut wurde oder zuerst der Zug vom Griff auf die Verbindungsleine zum Rettungsgerät kommt und nicht auf die Splintleine. Vor der dritten Auslösung wird die Wurfhilfe entfernt, so dass sich das Rettungsgerät dann frei entfalten kann.',
    section2Paragraph3: 'Zu guter Letzt wird das Rettungsgerät schrittweise wieder in den Innencontainer eingepackt. Bei jedem Teilnehmer wird jeder Arbeitsvorgang sorgfältig kontrolliert. Ist der Rettungsschirm frisch gepackt im Innencontainer, wird dieser noch in das Gurtzeug eingebaut.',
    section2Paragraph4: 'Das Training findet in einer Sporthalle statt und dauert vier bis sechs Stunden. Wir bieten die Trainings meist über die Wintermonate an – so kann die Schlechtwetterphase aktiv sinnvoll genutzt werden und ihr startet Jahr für Jahr wieder gut gerüstet in die neue Saison! Dieses Seminar ist auch als Geschenk-Gutschein möglich.',
    bookingBadge: 'Rettungsgerätetraining',
    bookingButtonLink: '/events?category=Rettungsger%C3%A4tetraining',
    bookingButtonText: 'Kurs buchen',
    priceRows: [{ label: 'Kurspreis', price: '85,- €' }],
    scheduleButtonLink: '/events?category=Rettungsger%C3%A4tetraining',
    scheduleButtonText: 'Termine > Siehe Liste',
    gutscheinHeading: 'Kurs Verschenken',
    gutscheinDescription: 'Dieses Seminar ist auch als Geschenk-Gutschein möglich',
    leistungen: [
      'Fachkundige Betreuung durch unsere Fluglehrer',
      'Einweisung ins Packen deiner Rettung',
      'Kompatibilitätsprüfung deiner Ausrüstung',
    ],
    checkliste: [
      'Lust zu lernen, wie man seinen Rettungsschirm packt und wirft',
      'Mitbringen deiner Flugausrüstung (vor allem: Gurtzeug mit Rettung, Helm, ggf. Handschuhe)',
      'Verpflegung',
      'Wichtig, da die Trainings in der Turnhalle stattfinden: saubere Turnschuhe',
    ],
  },
  groundhandling: {
    eyebrow: 'PERFORMANCE',
    heading: 'Groundhandling Kurs',
    videoUrl: 'https://www.youtube-nocookie.com/embed/qh9ORewDogc?rel=0',
    videoTitle: "Groundhandling & Rückwärts aufziehen - So geht's! | Flugschule Hirondelle",
    paragraph1: 'Unter Groundhandling verstehen wir, mit dem Schirm am Boden zu spielen, fühlen was sich 7 m über unseren Köpfen abspielt. Agieren und reagieren. Den Schirm sicher in allen Situationen zu beherrschen. Mit Blickrichtung zum Schirm rückwärts aufziehen, den Schirm kontrollieren, umdrehen und starten... Bei unserem Seminar werden verschiedene Techniken der Steuerung und Handhabung erklärt und gleich in der Praxis umgesetzt. All das hilft, den eigenen Gleitschirm spielerisch beherrschen zu lernen und macht außerdem auch richtig Spaß!',
    paragraph2: 'Wir brauchen ca. 3 Stunden, in denen wir euch 1:1 beim Groundhandling betreuen, um die Basics zu legen. Danach müsst ihr selbst noch mindestens 5 h auf die Wiese gehen, bis die Abläufe verinnerlicht sind. Groundhandling ist das A & O für jeden Piloten, um den eigenen Schirm kennen und steuern zu lernen. Selbst geübte Piloten gehen regelmäßig auf die Wiese, um ihr Gefühl für ihren Schirm zu verbessern. Als Anfänger ist dies ein absolutes Muss. Wer seinen Schirm am Boden perfekt beherrscht, gewinnt auch in der Luft Sicherheit. Die Groundhandling-Kurse finden – je nach Wetterlage – auf einem unserer Schulungsgelände statt. Weiche, hindernisfreie Wiesen sorgen für ungetrübten Spaß beim Trainieren. Wir bieten jährlich mehrere Groundhandling-Kurse an.',
    leistungen: [
      'Fachkundige Betreuung durch unsere Fluglehrer',
      'Auf Wunsch Leihausrüstung, Kosten hierfür bitte anfragen',
      'Haftpflichtversicherung',
    ],
    checkliste: [
      'Lust mit dem Schirm am Boden zu spielen',
      'Überknöchelhohe Schuhe, wir empfehlen spezielle Flugschuhe oder zumindest Wanderschuhe',
      'Outdoor-Bekleidung, je nach Wetter Wechselkleidung',
      'Ausreichend Getränke und Verpflegung (Groundhandling macht sehr hungrig ;-)))',
      'Sonnencreme',
    ],
    bookingBadge: 'Groundhandlingtraining Einzelschulung',
    priceLabel: 'Kurspreis in Privatschulung',
    priceNote: '[eigene Ausrüstung erforderlich, Leihausrüstung auf Anfrage]',
    price: '450,- € / Einheit',
    priceDuration: '(3 - 6 h)',
    bookingButtonText: 'Termine werden über den Newsletter bekannt gegeben –\nmeldet euch am Newsletter an',
    bookingButtonLink: '/events?category=Groundhandlingkurs',
    gutscheinHeading: 'Kurs Verschenken',
    gutscheinDescription: 'Du suchst ein außergewöhnliches Geschenk? Warum nicht einmal einen Gutschein für einen Groundhandling-Kurs verschenken!',
  },
  'b-schein': {
    title: 'B-Schein',
    heroImage: '/images/b-schein/hero.jpg',
    heroAlt: 'B-Schein Streckenflug',
    block1Heading: 'Auf Strecke mit dem unbeschränkten Luftfahrerschein...',
    block1Paragraph1: 'Wer weiter fliegen will als vom Start- zum Landeplatz braucht den unbeschränkten Luftfahrerschein (B-Schein). Dieser ist auch Voraussetzung zum Befliegen einiger Fluggelände in unserer Region und weltweit.',
    block1Paragraph2Html: 'Im Rahmen der Praxisausbildung zum B-Schein sind vom Piloten (Voraussetzung: <a href="/ausbildung/a-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">A-Schein</a>) 20 Flüge zu absolvieren. Davon müssen 10 Flüge eine Mindestdauer von über 30 Minuten vorweisen sowie ein Flug über eine Strecke von 15 km (inkl. 500 m Höhenzugewinn) geflogen werden. Die Praxisausbildung zum B-Schein findet im Rahmen unserer (einwöchigen) Reisen bzw. der Höhenflugschulungen im Rahmen der A-Scheinausbildung statt. Die Preise orientieren sich an den jeweiligen Touren.',
    block2Heading: 'Streckenplanung in der Theorie...',
    block2ParagraphHtml: 'In einer zweitägigen Theorieausbildung werden die für den B-Schein relevanten Inhalte und Kenntnisse vermittelt. In insgesamt 15 Unterrichtsstunden Theorie (à 45 Min.) werden die Inhalte aus der A-Scheinausbildung vertieft und erweitert. Maßgeblich bereiten euch die Themen Meteorologie und Navigation auf eure selbständigen Streckenflüge vor. Nach dem Kurs muss der Flugschüler eine offizielle Theorieprüfung in den vorher vermittelten Theoriefächern vor einem Prüfer des <a href="https://www.dhv.de/" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">DHV</a> abzulegen.',
    block3Heading: '... und Praxis',
    block3Paragraph1: 'Der vorgeschriebene 15-Kilometer-Streckenflug für den unbeschränkten Luftfahrerschein wird für das Fluggelände besprochen und soll bei passender Wetterlage vom zukünftigen B-Scheinpiloten abgeflogen werden. Die Streckendokumentation erfolgt mit einem GPS und kann am Laptop vor Ort ausgelesen werden.',
    block3Paragraph2Html: 'Bevor es schlussendlich auf Strecke geht, muss auch noch ein <a href="/performance/rettungsgeraetetraining" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Rettungsgerätetraining</a> absolviert werden. Diese Trainings bieten wir mehrmals im Jahr für euch an.',
    bookingButtonText: 'Kurs buchen',
    bookingButtonLink: '/events?category=Unbeschr.%20LF-Schein%20(B-Schein)',
    theoriePreis: { label: 'Kurspreis Theorie', price: '290,- €' },
    praxisNote1: 'entspricht Kurspreis des gebuchten Trainings',
    praxisNote2: '(im Rahmen der Höhenflugschulung, Sicherheitstraining, Thermik-Technik oder Streckenseminar)',
    praxisPreis: 'ab 790,- €',
    zusatzkostenHeading: 'Zusatzkosten',
    zusatzkostenRows: [
      { title: 'ggf. Auffahrten zum Startplatz', note: '[ pro Fahrt, geländeabhängig ]', sub: 'Bus | Seilbahn (Kosten des Betreibers vor Ort)', price: '10,- € | - €' },
    ],
    theorieTerminButtonText: 'Theorie-Termine > Siehe Liste',
    theorieTerminButtonLink: '/events?category=Unbeschr.%20LF-Schein%20(B-Schein)',
    gutscheinHeading: 'B-Schein Verschenken',
    gutscheinDescription: 'Der B-Schein ist auch als Geschenk-Gutschein möglich',
    leistungen: [
      'Theorie- und Praxisausbildung durch zertifizierte Fluglehrer',
      'Organisation der Reise für die Praxisausbildung',
      'Funkausrüstung und -betreuung',
      'Haftpflichtversicherung',
    ],
    zusatzkostenListHeading: 'Zusatzkosten können entstehen für:',
    zusatzkostenListItemsHtml: [
      '<a href="/performance/rettungsgeraetetraining" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Rettungsgerätetraining</a> (separat zu buchender Kurs)',
      'E-Learning Prüffragen <a href="https://shop.dhv.de/collections/prufungsfragen" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Gleitschirm-B-Schein</a> vom DHV',
      '<a href="#" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Prüfungsgebühren ab 03.04.2023</a> DHV',
    ],
    checkliste: [
      'Lust aufs Fliegen',
      'Überknöchelhohe Schuhe, wir empfehlen spezielle Flugschuhe oder zumindest Wanderschuhe',
      'Outdoor-Bekleidung, je nach Wetter Wechselkleidung',
      'Ausreichend Getränke und Verpflegung (Fliegen macht hungrig!!!)',
      'Sonnencreme',
      'Ausführliche Checkliste für die Praxisausbildung erhaltet ihr je Reisetermin',
    ],
    bannerTextHtml: 'Die Praxisausbildung zum B-Schein findet im Rahmen unserer Reisen bzw. Höhenflugschulungen statt. Der Kurspreis für die Praxis orientiert sich am gewählten Training bzw. der gewählten Reise.',
    bannerLink: '/reisen',
  },
  tandemschein: {
    heroImage: '/images/tandemschein/hero.jpg',
    block1Heading: 'Zusammen mit Freunden zum Fliegen gehen.',
    block1Paragraph: "Zum Fliegen gehen und die Leidenschaft mit Freunden teilen? Mit dem Tandemschein kein Problem! Die Freiheit und die Eindrücke in der Luft mit jemanden teilen zu können ist ein fantastisches Erlebnis sowohl für den Piloten als auch für den Passagier. Kommt einfach zusammen auf das Fluggelände, hier erhält der Passagier sein Gurtzeug. Nach einem Probelauf und Erklärung der Kommandos macht man sich selbst und seinen Passagier startklar und los geht's!",
    block2Heading: 'Ausbildung Passagierflugberechtigung',
    block2Paragraph: 'Die Ausbildung ist auch hier geteilt in eine Theorie- und eine Praxisausbildung mit abschließender Prüfung vor einem DHV-Prüfer. Insgesamt müssen 40 Flüge mit einem Passagier absolviert werden. Davon mind. 1 Flug mit einem Fluglehrer, 25 Flüge mit Fluglehreraufsicht, 15 Flüge im Flugauftrag. Der Passagier im Rahmen der Ausbildung muss mind. im Besitz des A-Scheins sein.',
    leistungen: [
      'Theorie- und Praxisausbildung durch zertifizierte Fluglehrer',
      'Organisation der Praxis-/Theorieausbildung',
      'Funkausrüstung und -betreuung',
      'Haftpflichtversicherung',
      'Neue und sichere Leihausrüstung',
    ],
    zusatzkostenAusruestungLabel: 'Ausrüstung',
    zusatzkostenAusruestungSubItems: [
      'neue / gebrauchte Ausrüstung, Preise auf Anfrage',
      'Leihausrüstung über die Flugschule (25,- € / Flug)',
    ],
    zusatzkostenLinksHtml: [
      'Optional <a href="/ausbildung/windenschein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Windenkurs</a> zur Vervollständigung der 40 benötigten Flüge',
      'E-Learning Prüffragen <a href="https://shop.dhv.de/collections/prufungsfragen" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Gleitschirm-Tandemschein</a> vom DHV',
      '<a href="#" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Prüfungsgebühren ab 03.04.2023</a> DHV',
    ],
    checkliste: [
      'Tandemeingangstest vor einem Prüfer des DHV',
      'Lust aufs Fliegen',
    ],
    priceMainLabel: 'Kurspreis',
    priceMainPrice: '690,- €',
    priceMainNote: '[Leihausrüstung 25,- € / Flug]',
    priceWindenschleppLabel: 'Einweisung Windenschlepp Passagierflug Tandem',
    priceWindenschleppNote: '[ Ergänzung zum Tandemschein, 10 Einweisungsflüge ]',
    priceWindenschleppPrice: '320,- €',
    priceVerleihText: 'Verleih Tandemausrüstung: Preis auf Anfrage',
    gutscheinHeading: 'Kurs Verschenken',
    gutscheinDescription: 'Der Tandemschein ist auch als Geschenk-Gutschein möglich',
  },
  'a-schein': {
    eyebrow: 'AUSBILDUNG',
    heading: 'A-Schein',
    heroImage: '/images/1-a-schein/hero.jpg',
    heroAlt: 'A-Schein Höhenflugkurs',
    pilotHeading: 'Du wirst endlich lizenzierter Pilot',
    pilotHtml: 'Auf den <a href="/ausbildung/l-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Grundkurs</a> aufbauend, werden für den A-Schein die Kenntnisse vertieft. Kurvenflug, Schirmkontrolle und vielleicht schon das erste Rückwärtsaufziehen an dem Übungshang sind einige der Lerninhalte, die in diesem Kurs neben den Höhenflügen auf dem Lehrplan stehen. Mit der vorgeschriebenen Ausbildung in Theorie und Praxis machen wir aus dir einen sicheren und umsichtigen Piloten. Nach erfolgreich bestandener Theorieprüfung und Erreichen von mind. 40 Höhenflügen sowie 18.000 Höhenmetern kannst du dann auch die praktische Prüfung ablegen. Mit dem A-Schein in deinen Händen, warten die zugelassenen Gelände in ganz Deutschland und darüber hinaus von dir erflogen zu werden!',
    expectHeading: 'Was dich erwartet beim Höhenflugkurs (A-Schein)...',
    expectParagraph1Html: 'Für den beschränkten Luftfahrerschein (A-Schein) benötigt man mind. 40 Flüge, in denen mind. 18.000 Höhenmeter erflogen werden. Die alpinen Höhenflüge finden im Rahmen unserer Höhenflugschulungen (i. d. R. in den Alpen) statt. Weitere Flüge können auch an der <a href="/ausbildung/windenschein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Winde</a> absolviert werden (Achtung Winde: dies ist ein separater Kurs, der sich aber super mit der A-Scheinausbildung kombinieren lässt! Der <a href="/ausbildung/windenschein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Windenkurs</a> spart unterm Strich Zeit und Geld!).',
    expectParagraph2: 'Für die Höhenflugschulung fahren wir regelmäßig nach Bassano / Italien, sowie nach Frankreich und Österreich – weitere Fluggebiete nutzen wir nach Bedarf!',
    expectParagraph3: "Auf dieser 1-wöchigen Höhenflugschulung (Samstag bis Samstag → es werden nur 5 Tage Urlaub benötigt) werden die notwendigen Höhenflüge gesammelt und Flugmanöver trainiert und du wirst auf die praktische Prüfung vorbereitet. Diese findet auch vor Ort statt und wird von einem Prüfer des DHV (Deutscher Hängegleiter Verband) abgenommen.",
    expectParagraph4: 'Der A-Schein berechtigt dich dann zum alleinigen Fliegen in zugelassenen Geländen in ganz Deutschland und darüber hinaus.',
    courseHeading: 'Der Kurs...',
    courseHtml: 'Neue Lerninhalte wie Landeeinteilung, Vollkreis, Kurven mit unterschiedlicher Schräglage sowie Abstiegshilfen werden dem Flugschüler in diesem Ausbildungsabschnitt vermittelt. Auch die erste Thermikerfahrung sammelt ihr im Rahmen der Ausbildung zum A-Schein. Ständige Funkbegleitung versteht sich von selbst! Untermauert wird die Ausbildung mit insgesamt 20 Unterrichtsstunden Theorie (à 45 min.) in den Fächern: Meteorologie, Luftrecht, Gerätekunde, Flugtechnik und Verhalten in besonderen Fällen. Nach dem Kurs muss der Flugschüler eine offizielle Theorieprüfung in den vorher vermittelten Theoriefächern vor einem Prüfer des <a href="https://www.dhv.de/" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">DHV</a> abzulegen - dies kann jederzeit in der Flugschule bei Alex erfolgen.',
    orgHeading: 'Organisatorisches...',
    orgHtml: 'Die Termine zur Höhenflugschulung findet ihr in unserem <a href="/buchungskalender" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Kalender</a>. Bitte meldet euch hierüber an. Ort und genaue Uhrzeit der Kurstermine erfahrt ihr dann wie gewohnt vorab per Schulungs-Newsletter. Die Ausbildung zum Höhenflugausweis erfolgt wie gewohnt für jeden Piloten zeitoffen.',
    equipmentHeading: 'Die erste eigene Ausrüstung',
    equipmentParagraph1: 'Mit der Ausbildung zum selbständigen Piloten kommt auch eine eigene Ausrüstung ins Spiel. Wie bei vielen anderen Sportarten ist auch beim Gleitschirmfliegen die Ausrüstung entscheidend. Doch wer die Wahl hat, hat die Qual! Man muss sich in erster Linie damit auseinandersetzen, welche Ausrüstung für einen selbst geeignet ist. Wir von der Flugschule Hirondelle setzen genau an dieser Stelle an und beraten euch auf der Suche nach dem passenden Equipment. Die von uns getroffene Auswahl spiegelt einen Querschnitt des Marktes wieder und bedient nach unserer Erfahrung nahezu alle Ansprüche und Wünsche – die Produkte der beiden Phi, Niviuk, Independence und Advance bieten für alle Zielgruppen entsprechende Ausrüstungen. Mit unserer langjährigen Auseinandersetzung mit Flugeigenschaften, Sicherheit, Qualität, Service, Handling und technischem Fortschritt unterstützen wir euch so optimal bei der Entscheidung zu eurer Neuinvestition.',
    equipmentParagraph2: 'Wollt/könnt ihr euch noch nicht gleich festlegen, besteht die Möglichkeit, die Ausbildung zum A-Schein mit einer Leihausrüstung der Flugschule zu absolvieren.',
    equipmentParagraph3: 'Oder ihr bringt eine eigene (fremdgekaufte) Ausrüstung mit, hier greift ein Aufschlag auf den Kurspreis der Höhenflugschulung in Höhe von 350,00 € pro Kurs / Woche.',
    priceRows: [
      { title: 'A-Scheinkurs', description: 'Praxisausbildung im Rahmen der Schulungswoche Höhenflugschulung 1 (790,- €) sowie A-Schein-Theorie (200,- €)', price: '990,- €' },
      { title: 'Kombikurs:', description: 'Grundkurs & A-Scheinkurs Woche 1', price: '1.590,- €' },
      { title: '', description: 'Ratenzahlung Kombikurs [ 4 Raten à 430,- € ]', price: '1.720,- €' },
      { title: 'Kombikurs Kompakt:', description: 'Grundkurs & Winde & A-Scheinkurs Woche 1', price: '1.990,- €' },
      { title: '', description: 'Ratenzahlung Kombikurs Kompakt [ 4 Raten à 530,- € ]', price: '2.120,- €' },
    ],
    priceNote: 'alle Kursgebühren mit bei uns gekaufter Ausrüstung / Leihausrüstung siehe Zusatzkosten',
    extraCostRows: [
      { label: 'eigene Ausrüstung', price: 'Preise auf Anfrage' },
      { label: 'optional Leihausrüstung [pauschal pro Kurswoche]', price: '350,- €' },
      { label: 'Aufschlag bei fremdgekaufter Ausrüstung', price: '350,- €' },
      { label: 'zusätzliche Teilnahme an weiteren Höhenflugschulungswochen', price: '790,- €' },
      { label: 'ggf. Auffahrten zum Startplatz [ pro Fahrt ] Bus | Seilbahn (Kosten des Betreibers vor Ort)', price: '10,- € | - €' },
    ],
    gutscheinHeading: 'A-Schein Verschenken',
    gutscheinDescription: 'Der A-Schein ist auch als Geschenk-Gutschein möglich',
    leistungen: [
      'Theorie- und Praxisausbildung durch zertifizierte Fluglehrer',
      'Organisation der Reise für die Schulungswoche Höhenflugschulung',
      'Funkausrüstung und -betreuung',
      'Haftpflichtversicherung bei Leihausrüstung',
    ],
    extraCostsHeading: 'Zusatzkosten können entstehen für:',
    ausruestungLabel: 'Ausrüstung',
    ausruestungSubItems: [
      'neue / gebrauchte Ausrüstung, Preise auf Anfrage',
      'Leihausrüstung über die Flugschule (350,- € / Kurswoche)',
      'Aufschlag auf den Kurspreis bei fremdgekaufter Ausrüstung (350,- €)',
    ],
    extraCostsItemsHtml: [
      'Optional Windenkurs zur Vervollständigung der 40 benötigten Flüge',
      'Optional zusätzliche Teilnahme an weiteren Höhenflugschulungswochen (790,- € / Woche)',
      'E-Learning Prüffragen <a href="https://shop.dhv.de/collections/prufungsfragen" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Gleitschirm-A-Schein</a> vom DHV',
      '<a href="#" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Prüfungsgebühren ab 03.04.2023</a> DHV',
    ],
    checklist: [
      'Lust aufs Fliegen',
      'Mindestalter: 14 Jahre (mit Einverständniserklärung der Erziehungsberechtigten!)',
      'Überknöchelhohe Schuhe, wir empfehlen spezielle Flugschuhe oder zumindest Wanderschuhe',
      'Outdoor-Bekleidung, je nach Wetter Wechselkleidung',
      'Ausreichend Getränke und Verpflegung (Fliegen macht hungrig!!!)',
      'Sonnencreme',
      'Ausführliche Checkliste für die Höhenflugschulung erhaltet ihr je Reisetermin',
    ],
  },
  windenschein: {
    eyebrow: 'AUSBILDUNG',
    heading: 'Windenschein',
    videoUrl: 'https://www.youtube-nocookie.com/embed/KSdpddm3Rnw?rel=0',
    videoTitle: 'A-Schein Windenstarts - Paragliding lernen | Flugschule Hirondelle',
    introHeading: 'Windenschlepp mit dem Gleitschirm...',
    introParagraph: 'Das Schleppen an der Winde ist eine ideale Möglichkeit, auch im Flachland mit dem Gleitschirm in die Luft zu kommen. Nicht selten können unsere Schüler an der Winde schon etwas Thermik schnuppern und bis zu 20 Minuten durch die Luft gleiten. Viele erfolgreiche Streckenflüge sind bereits aus der Winde heraus geflogen worden. Der Windenschein ist die ideale Ergänzung zum A-Scheinkurs da ihr hier schnell einen Großteil der nötigen Flüge für die A-Scheinprüfung sammeln könnt.',
    ausbildungHeading: 'Ausbildung',
    ausbildungPara1Html: '20 Flüge unter Fluglehreraufsicht benötigt ihr zur Erlangung der Windenschleppstartberechtigung. Nach erfolgreich abgelegter flugschulinterner Theorie- und Praxisprüfung für den Windenschlepp darfst du dann selbständig an der Winde fliegen (Voraussetzung <a href="/ausbildung/a-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">A-Schein</a>!). Die Ausbildungsdauer beträgt je nach Wetterlage und persönlicher Kondition ca. 2 bis 3 Tage.',
    ausbildungPara2: 'Für den beschränkten Luftfahrerschein können anstelle einer Höhenflugschulung auch alle 40 Flüge an der Winde absolviert werden. Der Pilot erhält dann nach der Prüfung den beschränkten Luftfahrerschein mit der Startart Windenschlepp. Später kann er 15 Flüge in entsprechenden Höhenfluggeländen machen und die Startart Hang in seinen Luftfahrerschein eintragen lassen.',
    ausbildungPara3: 'Im Rahmen der Windenschleppausbildung findet eine Theorieschulung mit den Themengebieten Flugtechnik, Gefahreneinweisung und Luftrecht statt.',
    ausbildungPara4: 'Die Praxistermine werden flexibel je nach Wetterlage gewählt und finden i. d. R. unter der Woche statt. Die Pilotenanzahl begrenzen wir bei der Schulung auf 6 bis 10 Schüler, da bei zu großen Gruppengrößen zu lange Wartezeiten zwischen den einzelnen Schulungsflügen entstehen. Die Termine findet ihr in unserem Kalender.',
    ausbildungPara5: 'Bei unseren Windenschlepps setzen wir auf die modernen und sicheren Kunststoffseile. Diese sind nicht so starr wie die alten Stahlseile und daher für den Piloten beim Schlepp angenehmer und in der Windenausbildung einfacher im Handling. Seit 2022 schulen wir außerdem auf einer neuen Elektrowinde, diese erleichtert den Schulungsschlepp, da sie Unregelmäßigkeiten im Schleppvorgang, ausgelöst durch Thermik etc., selbst regelt und automatisch ausgleicht.',
    fluggelaendeHeading: 'Fluggelände',
    fluggelaendeIntro: 'Der Flugschule stehen mehrere Windenschleppgelände mit unterschiedlicher Wind-Ausrichtung zur Verfügung.',
    fluggelaendePara1Html: 'Mitten in der Rheinebene befindet sich der Flugplatz <a href="/infos/gelaende/herrenteich" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Herrenteich</a>, der gut und schnell erreichbar ist.',
    fluggelaendePara2Html: 'Bei Bad Kreuznach liegt das Schleppgelände <a href="/infos/gelaende/bad-kreuznach" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Auf dem unteren Mergesfeld</a> des Drachen- und Gleitsegelclub Nahetal e.V „DGCN".',
    bookingButtonLabel: 'Kurs buchen',
    bookingButtonLink: '/events?category=Windenschulung',
    priceRows: [
      { label: 'Kurspreis', price: '450,- €' },
      { label: 'darin enthalten:\nflugschulinterne Theorie- und Praxisprüfung', price: '50,- €' },
      { label: '[eigene Ausrüstung erforderlich -\nLeihausrüstung auf Anfrage möglich]', price: '' },
      { label: 'Kombikurs Kompakt:\nGrundkurs & Winde & A-Scheinkurs Woche 1', price: '1.990,- €' },
      { label: 'Einweisung Windenschlepp Passagierflug Tandem\n[ Ergänzung zum Tandemschein, 10 Einweisungsflüge ]', price: '320,- €' },
      { label: 'Tagespauschale für Fluggelände\n[ pro Flugtag ]', price: '10,- €' },
      { label: 'Leihgebühr für Schleppklinke\n[ pro Flugtag ]', price: '10,- €' },
      { label: 'Weitere betreute Praxisflüge an der Winde [ pro Schlepp ]\nfür (mind.) A-Schein-Inhaber', price: '10,- €' },
      { label: 'im Rahmen der A-Schein-Ausbildung', price: '20,- €' },
    ],
    footerButtonLabel: 'Termine > Zum Kalender',
    footerButtonLink: '/events?category=Windenschulung',
    gutscheinHeading: 'Windenschein Verschenken',
    gutscheinDescription: 'Der Windenschein ist auch als Geschenk-Gutschein möglich',
    leistungenItems: [
      'Theorie- und Praxisausbildung durch zertifizierte Windenfachlehrer und Windenfahrer',
      'Funkausrüstung und -betreuung',
      'Theorieskript',
      'Haftpflichtversicherung',
    ],
    zusatzkostenHeading: 'Zusatzkosten können entstehen für:',
    zusatzkostenItems: [
      'Leihausrüstung über die Flugschule (350,- € / Kurs)',
      'E-Learning Prüffragen <a href="https://shop.dhv.de/collections/prufungsfragen" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Gleitschirm-Windenschein</a> vom DHV',
      '<a href="#" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Prüfungsgebühren ab 03.04.2023</a> DHV',
    ],
    checklisteItems: [
      'Lust aufs Fliegen',
      'Mindestalter: 14 Jahre (mit Einverständniserklärung der Erziehungsberechtigten!)',
      'Überknöchelhohe Schuhe, wir empfehlen spezielle Flugschuhe oder zumindest Wanderschuhe',
      'Outdoor-Bekleidung, je nach Wetter Wechselkleidung',
      'Ausreichend Getränke und Verpflegung (Fliegen macht hungrig!!!)',
      'Sonnencreme',
    ],
  },
  sicherheitstraining: {
    heading: 'SICHERHEITSTRAINING - GARDASEE',
    introHeading: 'Sicherheitstraining am Gardasee...',
    introParagraphs: [
      'Mit unserem eigenen Sicherheitstraining am Gardasee bieten wir euch ein Gelände, in dem ihr von noch mehr Höhe für eure Trainingseinheiten profotiert.',
      'Sicherheit beim Gleitschirmfliegen ist ein sehr wichtiges Thema. Wer sicher fliegt, fliegt auch mit Freude. Ein Sicherheitstraining ist die beste Gelegenheit, sich selbst und den Gleitschirm in besonderen Flugzuständen kennen zu lernen und die Flugtechnik zu verbessern. Fünf Tage für deine Sicherheit, für die Verbesserung von richtigen Reaktionen und deinem fliegerischem Können.',
      'Am Südrand der italienischen Alpen liegt der wunderschöne Gardasee, den wir als Ausgangspunkt unseres Sicherheitstrainings genießen dürfen. Der Gardasee selbst bietet durch seine Lage außerdem Erholung mit Urlaubscharakter.',
      'Durch kleine Gruppengrößen entsteht kein Streß. Es bleibt viel Zeit für eine ausgiebige Videoanalyse, gründliche Vorbereitung und Zeit für alle offenen Fragen. Bei uns ist das „Premium" oder „VIP" Training anderer Flugschulen der Standard, weil wir glauben, dass nur so genug Raum für alle Teilnehmer bleibt.',
    ],
    offerHeading: 'Unser exclusives Sicherheitstraining bietet euch...',
    offerBullets: [
      '5 Trainingstage – genügend Zeit um, das Trainingsziel entspannt und sicher zu erreichen',
      'kleine Gruppen von 10 bis maximal 12 Teilnehmern, persönlich und effizient',
      'garantiert sind 5 Trainingsflüge, bei wetterbedingtem Ausfall können die entsprechenden Flüge zu einem anderen Termin kostenlos nachgeholt werden. Durch die enorme Arbeitshöhe können doppelt so viele Übungen in einem Flug absolviert werden als in anderen Gebieten.',
      'das Fluggebiet am Monte Baldo ist ein ideales Trainingsgelände aufgrund seiner 1.700 m Höhendifferenz mit riesigem, sicherem Startplatz in mehrere Richtungen, sowie dem großen Landeplatz, der einfach anzufliegen ist. Trotzdem weisen wir unsere Teilnehmer am Landeplatz per Funk ein.',
      'für die Sicherheit sorgen ein professionelles Lehrteam und eine professionelle Wasserrettung. Wir verwenden Automatik-Schwimmwesten.',
    ],
    aufbauHeading: 'Trainingsaufbau',
    aufbauItems: [
      'Einfliegen + Aufwärmtraining',
      'Orientierung im 3-dimensionalen Raum',
      'Abstiegsmethoden',
      'Fliehkrafttraining',
      'Klappertraining',
      'Strömungsabriß (für Fortgeschrittene)',
    ],
    kurspreisNote: 'Eigene Ausrüstung erforderlich',
    kurspreisAmount: '950,- €',
    zusatzkostenText: 'Unterkunft / Verpflegung, Seilbahn für die Auffahrt',
    gutscheinHeading: 'Training Verschenken',
    gutscheinDescription: 'Das Sicherheitstraining ist auch als Geschenk-Gutschein möglich.',
    ablaufHeading: 'Trainingsablauf',
    ablaufParagraphs: [
      'Anreisetag ist der Samstag, das Training selbst beginnt am Sonntag. Der erste Kurstag (Sonntag) ist vorgesehen, um das Fluggelände kennen zu lernen und die Flugmanöver theoretisch durchzusprechen. Das Training beginnt mit einer umfassenden Ausrüstungskontrolle und Gurtzeugeinstellung, Retter-Probeauslösung und Funk-/Schwimmwestenausgabe, Landeplatzbesprechung und Gefahreneinweisung im Falle einer Wasserlandung. Bei einem Eingewöhnungsflug werden die ersten Übungen geflogen.',
      'Ab dem 2. - 5. Tag werden täglich zuerst die jeweiligen Übungen besprochen, dann erflogen und anschließend durch Videoanalyse ausgewertet.',
      'Pro Trainingstag sind 2-3 Flüge vorgesehen, am ersten und letzten Tag jeweils einer.',
    ],
    uebungenHeading: 'Flugübungen',
    uebungenList1: [
      'Nicken und abfangen',
      'Rollen und abfangen',
      'Frontklapper unbeschleunigt und beschleunigt',
      'Seitenklapper unbeschleunigt und beschleunigt',
      'Einleitphase Steilspirale',
      'Ohren anlegen und beschleunigen',
    ],
    uebungenList2: [
      'B-Leinen Stall',
      'Steilspirale (optional)',
      'Trudeln (optional)',
      'Fullstall (optional)',
      'Retter werfen (optional)',
      'weitere Manöver auf Anfrage',
    ],
    teamHeading: 'Das Sicherheitstraining-Team besteht aus...',
    teamParagraph:
      'Das Team bei den exclusiven Sicherheitstrainings besteht aus dem Trainingsleiter, einem erfahrenen Startleiter und einem Kameramann für die Videoaufzeichnungen. Wir arbeiten mit mind. zwei Fluglehrern, einem am Startplatz und dem Trainingsleiter direkt am See, so dass dieser im Falle einer Wasserlandung schnell mit dem einsatzbereiten Rettungsboot in kürzester Zeit bei dir ist. Der Fluglehrer am Startplatz steht für alle noch offenen Fragen zur Verfügung, gibt dir wertvolle Tipps beim Start und sorgt für einen reibungslosen und stressfreien Ablauf am Startplatz. Nach dem Start begleitet er dich über Funk, bis der Fluglehrer am See übernimmt und du die im Vorfeld vereinbarten Flugfiguren beginnen kannst. Die Übungen werden von unserem Kameramann auf Video aufgenommen. Während deiner Flüge bekommst du in der Luft über Funk Hilfen und Anweisungen zu deinen Übungen und sofortige Korrekturen bei eventuellen Fehlern. Da immer nur ein Teilnehmer Übungen durchführt, kann auf das Flugkönnen jedes Einzelnen genauestens eingegangen werden.',
    teamMemberImage: '/images/team/schlink.jpg',
    teamMemberText: 'Startleiter: Alex, Performance-Trainer\nund Ausbildungsleiter der Flugschule Hirondelle',
    unterkunftHeading: 'Unterkunft / Region',
    unterkunftParagraphs: [
      'Das besonders günstige Mikroklima des Gardasees ermöglicht fast täglich Flüge vom Monte Baldo, Sommer wie Winter.',
      'Die moderne Panorama – Seilbahn befördert die Piloten sicher und schnell zum Startplatz – im Falle langer Wartezeiten fahren wir mit unseren Teilnehmern direkt zur Mittelstation.',
      'Das mediterrane Klima in Malcesine lädt nach dem Fliegen zum entspannten Spaziergang im malerischen Ort Malcesine ein und die wunderschöne Umgebung bietet auch nicht fliegender Begleitung vielseitige Möglichkeiten zur Urlaubsgestaltung.',
      'Zur Übernachtung stehen mehrere Hotels zur Verfügung, aber auch Ferienappartments und Campingplätze sind in nächster Umgebung zahlreich vorhanden. So kann das exclusive Sicherheitstraining am Gardasee/Monte Baldo auch zum Urlaubsziel für die ganze Familie werden. Die Reservierung des Hotels erfolgt über uns.',
    ],
    unterkunftNote: 'Im Rahmen des Sicherheitstrainings ist eine eigene Ausrüstung erforderlich!',
    leistungenHeading: 'Unsere Leistungen',
    leistungen: [
      'Kompetente Fachbetreuung durch einen zertifizierten Sicherheitstrainer',
      'Umfassende Betreuung am Starplatz durch Alex Schlink (Performancetrainer)',
      'Aufzeichnung der Flugmanöver mit anschließender Videoanalyse',
      'Ohnmachtssichere Automatikschwimmwesten (ohne Einschränkung der Bewegungsfreiheit)',
      'Funkverbindung',
      'Ausführlicher Theorieunterricht inkl. täglichem Briefing der bevorstehenden Flugmanöver',
      'Leistungsstarkes Rettungsboot',
      'Mentale Vorbereitung auf die einzelnen Flugfiguren',
      'exkl. Anreise, Unterkunft, Verpflegung, Seilbahn',
    ],
  },
  'brasilien-tour': {
    eyebrow: 'REISEN',
    title: 'Brasilien-Tour',
    heroImage: '/images/reisen/brasilien.jpg',
    heroImageAlt: 'Brasilien-Tour',
    block1Heading: 'Thermik und Streckenfliegen in Brasilien',
    block1Paragraph1: 'Fliegen in Rio de Janeiro – Uma cidade maravilhosa (eine wunderbare Stadt). Aber nicht nur in und um Rio wird geflogen. Bei unserer Rundreise in Brasilien wollen wir neben den Startplätzen in und um Rio auch die Startplätze im Landesinneren kennen lernen. Die Landschaften sind atemberaubend. Die oft zu findenden rundgeschliffenen Felsformationen machen das Fliegen in Brasilien zu etwas ganz Besonderem. In der Thermik drehen wir oft mit den Urubus, den einheimischen Schwarz-Geiern. Diese treten meistens in kleinen bis großen Gruppen auf. Einfach herrlich.',
    block1Paragraph2: 'Auf unserer kleinen Rundreise durch die Fluggebiete machen wir auch an den bekannten PWC-Geländen Halt. Hier laden uns herrlich angelegte Startplätze zum Fliegen ein. Highlight der Tour wird mit Sicherheit auch das Fluggebiet in Rio mit dem Petra Bonita, dem schwarzen Fels direkt am Meer mit der Möglichkeit, bei etwas Glück und Können, an der Christus-Statue vorbei zu fliegen. Und natürlich gehört ein Abstecher auf den Zuckerhut und den weltbekannten Strand Copacabana mit zum Pflichtprogramm.',
    block2Heading: 'Fluggebiete',
    block2Paragraph: 'Wir sehen bei dieser Tour bis zu 10 verschiedene Fluggebiete. Einige sind mit Sternfahrten von unserer Unterkunft erreichbar, andere fahren wir direkt an. Unter anderem dabei das bekannte PWC-Gelände in Valadares und Baixo Guandu und Castelo. Wir sind gespannt, was ihr von den Fluggebieten haltet.',
    block3Heading: 'Für wen ist die Reise gedacht?',
    block3Paragraph1: 'Die Reise ist sowohl für engagierte Hobbypiloten wie auch für den versierten Flieger geeignet. Für alle, die fliegerisch dazulernen und neue Eindrücke gewinnen wollen, für diejenigen, die ihre ersten kleinen Streckenflüge machen möchten, Streckencracks, Genussflieger einfach alle :-)! Mindestvoraussetzung ist der A-Schein oder Sopi.',
    block3Paragraph2: 'Nicht fliegende Begleitpersonen sind ebenfalls herzlich willkommen und kommen bei dieser Reise auch auf ihre Kosten.',
    block4Heading: 'Anreise, Unterkunft und Verpflegung',
    block4Paragraph1: 'Die Anreise / Hin- und Rückflug erfolgt nach Rio de Janeiro. Idealerweise bucht ihr eure Flüge ab z.B. Frankfurt mit Lufthansa (Direktflug). Zwecks gemeinsamer Anreise in der gleichen Maschine geben wir euch gerne die Flugnummer. Hinflug Freitag, 31.1.2020 (abends um 22 Uhr über Nacht), Beginn der Reise am Samstag, 1.2.2020. Rückflug Samstag 15.2.2020 19:40 Uhr, Ankunft in Frankfurt Sonntag, 16.2.2020.',
    block4Paragraph2: 'Während unseres Aufenthalts sind wir in gemütlichen Gästehäusern (Pousadas) und Hotels untergebracht. Nach dem Fliegen lassen wir den Tag in geselliger Runde bei gemeinsamem Abendessen ausklingen und lassen uns von der brasilianischen Küche verwöhnen z. B. in einer der landestypischen Churrascarias (Fleischtempel ;-)) und genießen den ein oder anderen Caipi oder eine frische Kokosnuss am Strand.',
    leistungenHeading: 'Unsere Leistungen',
    leistungen: [
      'professionelle Betreuung durch unsere Fluglehrer und Betreuer sowie einheimische Guides',
      'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
      'Flugwetterbriefing',
      'Funkbetreuung',
      'Videoanalyse',
      'alle Transfers während der Reisedauer sowie Auffahrten zu Startplätzen',
      'Rückholen nach den Streckenflügen egal wo :-)!',
      'Übernachtungen in Gästehäusern, im Doppelzimmer inkl. Frühstück',
      'Organisation eines Alternativprogramms bei schlechtem Wetter',
      'exkl. Hin- und Rückflug nach Rio',
      'exkl. Eintrittspreise für das Alternativprogramm',
      'exkl. Geländegebühren vor Ort (die sind eher gering)',
      'exkl. Auslandskrankenversicherung inkl. Rücktransport (bitte unbedingt abschließen - gibt es für 13,90 € / Jahr beim ADAC)',
    ],
    badges: [
      { label: 'Streckenflugtraining', color: '#E58E26' },
      { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
      { label: 'Soaringtraining', color: '#80C533' },
      { label: 'Groundhandlingtraining', color: '#3274B7' },
    ],
    bookingButtonText: 'Reise buchen',
    bookingButtonLink: '/events?category=Reisen',
    priceLabel: 'Tourpreis',
    priceDescription: 'Die Reisepreiskalkulation basiert auf dem Wechselkurs 1,- € / 4,20 Brasilianischer Real. Nachkalkulation bei Abweichungen vorbehalten.',
    priceAmount: '2.150,-',
    priceCurrency: '€',
    voraussetzungText: 'Voraussetzung: mindestens A-Schein / Sopi',
    scheduleButtonText: 'Termin: siehe Kalender',
    scheduleButtonLink: '/events?search=Brasilien',
    gutscheinHeading: 'Tour Verschenken',
    gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
  },
  'bassano-tour': {
    eyebrow: 'REISEN',
    heading: 'Bassano-Tour',
    heroImage: '/images/reisen/bassano.jpg',
    heroAlt: 'Bassano-Tour',
    section1Heading: 'Gleitschirm-Thermik-Strecken-Fliegen Bassano',
    section1Paragraph: 'Bassano ist das unbestrittene Mekka der Gleitschirm- und Drachenszene in den Südalpen. Besonders im Winter und zeitigen Frühjahr trifft sich hier die Szene. Daher ist im Winterhalbjahr vor allem an Wochenenden viel los. Die Thermik ist ganzjährig interessant und kann schon früh im Jahr für Streckenflüge genutzt werden. Es bietet ca. 320 fliegbare Tage pro Jahr. Von wunderschönen, stundenlangen Thermikflügen mit herrlichem Blick auf die Poebene bis zu schönen Streckenflügen. Bassano bietet mehrere Startplätze die bequem mit einem Shuttlebus erreicht werden können.',
    fluggebietHeading: 'Das Fluggebiet',
    fluggebietParagraph1: 'Das Bergmassiv Monte Grappa mit seinen ca. 1.600 Höhenmetern ist eine riesige langgezogene Bergkette, welche südlich ausgerichtet ist und für zuverlässige Thermik sorgt. Es gibt zahlreiche Startmöglichkeiten für fast alle Windrichtungen.',
    fluggebietListItems: [
      'O-Startplatz: Antenna Costalunga, 755 m NN',
      'S-Startplatz: Da Bepi, 829 m NN',
      'W-Startplatz: Casette, 975 m NN',
      'SSO-Startplatz: Campeggia, 1.080 m NN',
      'SO-Startplatz: Panettone - Cima Grappa, 1.563 m NN',
    ],
    fluggebietParagraph2: 'Bei entsprechendem Wetter sind Tagesausflüge in die benachbarten unbekannteren Fluggebiete geplant.',
    fuerWenHeading: 'Für wen ist die Reise gedacht?',
    fuerWenParagraph: 'Für diejenigen, die in einem entspannten Fluggebiet ihre ersten Thermikerfahrungen sammeln wollen, sowie den ambitionierten Genussflieger der sich an seine ersten kleinen Strecken ran tasten will.',
    anreiseHeading: 'Anreise, Unterkunft und Verpflegung',
    anreiseParagraph: 'Wir wollen im Hotel in der Nähe vom Landeplatz einchecken. Dort können Doppelzimmer oder auch Einzelzimmer gebucht werden (Orga über uns), jeweils inkl. Frühstück. Alternativ könnt ihr auf dem angeschlossenen Campingplatz unterkommen. Nach dem Fliegen lassen wir den Tag in geselliger Runde bei gemeinsamem Abendessen ausklingen und lassen uns von der italienischen Küche verwöhnen.',
    leistungenHeading: 'Leistungen',
    leistungen: [
      'professionelle Betreuung durch unsere Fluglehrer',
      'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
      'Flugwetterbriefing',
      'Funkbetreuung',
      'Videoanalyse',
      'exkl. Anreise, Unterkunft, Verpflegung, Auffahrten',
      'exkl. Geländegebühren',
      'exkl. Eintrittspreise für das Alternativprogramm',
      'exkl. Auslandskrankenversicherung inkl. Rücktransport',
    ],
    flyerImage: '/images/flyers/bassano.png',
    flyerAlt: 'Flugschule Hirondelle Flyer Bassano',
    badges: [
      { label: 'Streckenflugtraining', color: '#E58E26' },
      { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
      { label: 'Soaringtraining', color: '#80C533' },
    ],
    bookingButtonText: 'Reise buchen',
    bookingButtonLink: '/events?category=Reisen',
    priceLabel: 'Tourpreis',
    price: '850,- €',
    requirementText: 'Voraussetzung: mindestens A-Schein / Sopi',
    scheduleButtonText: 'Termine > siehe Kalender',
    scheduleButtonLink: '/events?search=Bassano',
    gutscheinHeading: 'Tour Verschenken',
    gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
  },
  'griechenland-tour': {
    eyebrow: 'REISEN',
    title: 'Griechenland-Tour',
    videoUrl: 'https://www.youtube-nocookie.com/embed/TW9W8u_MjUM?rel=0',
    videoTitle: 'Griechenland Tour 2018 - Gleitschirmfliegen lernen | Flugschule Hirondelle',
    blocks: [
      { heading: 'Griechenland-Tour Westküste', text: 'Gerade die Nordwestküste Griechenlands ist von dem im Sommer auftretendem starken Nordostwind (Windsystem Meltemia) geschützt und bietet den Fliegern optimale Flugbedingungen und eine fast ganzjährige Flugsaison (März-November).' },
      { heading: 'Das Fluggebiet', text: 'Die Reise beginnt und endet in Preveza / Flughafen. Von Preveza aus fahren wir auf die Insel Lefkada, dort sind wir während der Woche untergebracht. Unsere Fluggebiete befinden sich in einem Radius von 150 km, welche individuell je nach Wetterlage und Windrichtung angesteuert werden.\n\nDie Flugsafari ist eine tolle Kombination von Thermik- und Streckenfliegen im Pindosgebirge sowie dem Küstensoaren auf der Insel Lefkada an der Westküste Griechenlands.' },
      { heading: 'Und sonst ...', text: 'Die Erlebnisse des Tages lassen wir dann abends in gemütlicher Runde nochmals in einer der vielen gemütlichen Tavernen bei einem (oder zwei?) Gläschen Retsina und einem leckeren, opulenten griechischen Fisch- oder Fleischgericht Revue passieren. An nicht fliegbaren Tagen, gibt es einige Möglichkeiten in dieser Gegend schöne Ausflüge zu unternehmen oder einfach nur am Strand zu chillen - das Meer hat Ende Mai schon echte Badetemperatur! Das Wetter ist aber um diese Jahreszeit meist so gut, dass wir hoffentlich die meiste Zeit der Reise in der Luft verbringen werden.' },
      { heading: 'Für wen ist die Reise gedacht?', text: 'Für diejenigen, die in einem entspannten Fluggebiet ihre ersten Soaring- und Thermikerfahrungen sammeln wollen sowie für den ambitionierten Genussflieger, der sich an seine ersten kleinen Strecken rantasten will. Die Flugreise richtet sich somit gleichermaßen an Streckenflugeinsteiger wie auch erfahrene XC-Piloten.' },
      { heading: 'Anreise, Unterkunft und Verpflegung', text: 'Zielflughafen und Treffpunkt ist der Flughafen Preveza im Westen Griechenlands. Ab Frankfurt fliegt Condor als Direktflug. Als Unterkünfte haben wir ein gemütliches Hotel mit Übernachtung / Frühstück vorreserviert. Das Abendessen wird angepasst an den aktuellen Tagesverlauf und entsprechend der regionalen Gegebenheiten geplant. Es findet in ausgewählten örtlichen Restaurants mit typisch griechischer Küche statt, um möglichst alle kulinarischen Besonderheiten dieser Region kennenzulernen.' },
    ],
    leistungenHeading: 'Leistungen',
    leistungen: [
      'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
      'professionelle Betreuung durch unsere Fluglehrer',
      'tägliches Flugwetterbriefing',
      'Funkbetreuung',
      'Videoanalyse',
      'inkl. Transfers ab Flughafen Preveza und in die Fluggebiete',
      'exkl. Flug und Unterkunft / Verpflegung – diese Kosten werden vom Teilnehmer selbst getragen',
    ],
    badges: [
      { label: 'Streckenflugtraining', color: '#E58E26' },
      { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
      { label: 'Soaringtraining', color: '#80C533' },
    ],
    bookingButtonText: 'Reise buchen',
    bookingButtonLink: '/events?category=Reisen',
    priceLabel: 'Tourpreis',
    price: '950,- €',
    requirementText: 'Voraussetzung: mindestens 5 Teilnehmer, A-Schein / Sopi',
    scheduleButtonText: 'Termin > siehe Kalender',
    scheduleButtonLink: '/events?search=Griechenland',
    gutscheinHeading: 'Tour Verschenken',
    gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
  },
  'kolumbien-tour': {
    eyebrow: 'REISEN',
    title: 'Kolumbien-Tour',
    heroImage: '/images/reisen/kolumbien.jpg',
    heroAlt: 'Kolumbien-Tour',
    block1Heading: 'Thermik- und Streckenfliegen in Kolumbien',
    block1Paragraph1: 'Wir fliegen über den grünen Landschaften des Valle del Cauca. Dabei genießen wir die großartige Gastfreundschaft der Kolumbianer und befliegen über mehrere Stationen die besten Fluggebiete von Cali Richtung Medellin. Die sanfte Thermik und das breite Tal mit zahllosen Landemöglichkeiten laden zu gemeinsamen Thermik- und Streckenflügen ein.',
    block1Paragraph2: "Wir befliegen zuerst die Fluggebiete von Piedechinche, die in unmittelbarer Nähe zu Cali liegen. Weiter geht's Richtung Norden mit 3 weiteren Stops und diversen Fluggebieten im Valle de Cauca bis Medellin, wo wir unsere Tour beenden.",
    block2Heading: 'Fluggebiete',
    block2Intro: 'Valle del Cauca',
    block2Paragraph: 'Mit den bekannten Fluggebieten Roldanillo, dem Austragungsort des PWC 2011 und Super Finals 2013, Ansermanuevo, La Pintada und Piedechinche. Roldanillo liegt 1000 m über dem Meeresspiegel. Das Klima ist tropisch warm, die westliche Kette der Anden sperrt die Zufuhr von kühler und feuchter Luft vom Pazifischen Ozean. Die Durchschnittstemperatur liegt zw. 26° - 28° C . Die trockenen Jahreszeiten sind Dezember bis März und Juli bis August, der Rest ist Regenzeit. Die Stationen im Einzelnen:',
    block2Stations: [
      { icon: '📍', heading: 'Piedechinche – Der Auftakt in den Anden', text: 'Unsere Reise beginnt südlich von Cali im grünen Herz des Valle del Cauca. In Piedechinche, nahe Palmira, liegt unsere erste Unterkunft – umgeben von Zuckerrohrfeldern und ersten genialen Fluggebieten. Hier sammeln wir die ersten Thermikstunden bei stabilen Bedingungen mit spektakulärem Blick auf das Tal.' },
      { icon: '🗺️', heading: 'La Unión – Vielfalt in der Luft & am Boden', text: 'Weiter geht\'s nach La Unión, bekannt für seine exzellenten Flugspots: Ansermanuevo, Roldanillo und Apía. Die Region ist das Zentrum des kolumbianischen Gleitschirmfliegens und hat schon internationale Wettbewerbe beherbergt. Neben dem Fliegen erwarten uns Kolumbiens typischer Kaffee, kleine Dörfer mit kolonialem Flair und beeindruckende Berglandschaften.' },
      { icon: '🏕️', heading: 'Jericó – Hoch über dem Tal', text: 'Ein echter Geheimtipp ist unser nächster Stopp: Jericó, ein charmantes Bergstädtchen mit Top-Flugbedingungen. Die Szenerie rund um die schroffen Hänge und grünen Hochplateaus bietet beste Voraussetzungen für Thermik, Soaring – und atemberaubende Aussicht.' },
      { icon: '🌇', heading: 'Finale in Medellín – Kultur, Kaffee & Cityvibes', text: 'Zum Abschluss der Reise lassen wir es uns in Medellín, der „Stadt des ewigen Frühlings", gutgehen. Neben einem möglichen Flugspot am Stadtrand steht hier auch Sightseeing auf dem Programm: lebendige Märkte, Street Art in Comuna 13, Seilbahnfahrten über die Stadtviertel und kolumbianische Küche vom Feinsten.' },
    ],
    block3Heading: 'Für wen ist die Reise gedacht?',
    block3Paragraph1: 'Die Reise ist sowohl für engagierte Hobbypiloten wie auch für den versierten Flieger geeignet. Für alle, die fliegerisch dazulernen und für diejenigen, die ihre ersten kleinen Streckenflüge machen möchten – aber auch Streckencracks kommen voll auf ihre Kosten!',
    block3Paragraph2: 'Mindestvoraussetzung ist der A-Schein.',
    block4Heading: 'Anreise, Unterkunft und Verpflegung',
    block4Paragraph1: 'Die Anreise / Hin- und Rückflug erfolgt nach Cali bzw. Medellin. Zwecks gemeinsamer Anreise in der gleichen Maschine geben wir euch gerne die Flugnummer.',
    block4Paragraph2: 'Während unseres Aufenthalts sind wir in landestypischen Gästehäusern oder Hotels in der Nähe der Startplätze untergebracht. Nach dem Fliegen lassen wir den Tag in geselliger Runde bei gemeinsamem Abendessen ausklingen und lassen uns von der kolumbianischen Küche verwöhnen.',
    leistungenHeading: 'Unsere Leistungen',
    leistungen: [
      'professionelle Betreuung durch unsere Fluglehrer plus mitfliegendem Guide aus Kolumbien',
      'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
      'Flugwetterbriefing',
      'Funkbetreuung',
      'Flug-/Videoanalyse',
      'alle Transfers während der Reisedauer sowie Auffahrten zu Startplätzen',
      'Rückholen nach den Streckenflügen :-)!',
      'Übernachtungen in Gästehäusern, im Doppel-/Dreibettzimmer inkl. Frühstück',
      'Organisation eines Alternativprogramms bei schlechtem Wetter',
      'exkl. Hin- und Rückflug nach Kolumbien',
      'exkl. Sim-Karte für Kolumbien, Datenpakete müssen separat gekauft werden',
      'exkl. Geländegebühren vor Ort',
      'exkl. Eintrittspreise für das Alternativprogramm',
      'exkl. Auslandskrankenversicherung inkl. Rücktransport (Bitte unbedingt abschließen - gibt es für kleines Geld beim ADAC)',
    ],
    badges: [
      { label: 'Streckenflugtraining', color: '#E58E26' },
      { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
      { label: 'Soaringtraining', color: '#80C533' },
      { label: 'Groundhandlingtraining', color: '#3274B7' },
    ],
    bookingButtonText: 'Reise buchen',
    bookingButtonLink: '/events?category=Reisen',
    priceLabel: 'Tourpreis',
    price: '2.690,- €',
    priceNote: 'Voraussetzung: mindestens A-Schein / Sopi',
    scheduleButtonText: 'Termin: siehe Kalender',
    scheduleButtonLink: '/events?search=Kolumbien',
    gutscheinHeading: 'Tour Verschenken',
    gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
  },
  'suedafrika-tour': {
    eyebrow: 'REISEN',
    title: 'Südafrika-Tour',
    heroImage: '/images/reisen/suedafrika.jpg',
    heroImageAlt: 'Südafrika-Tour',
    block1Heading: 'Gleitschirm-Safari-Rundreise',
    block1Paragraph: 'Südafrika ist ein Land der Vielfalt und der Gegensätze und hat in jeder Hinsicht viel zu bieten. Auf der Südhalbkugel, im Land der unerschöpflichen fliegerischen Möglichkeiten, können wir beste thermische Flugbedingungen unbegrenzt gemeinsam genießen und uns zudem an hochsommerlichen Temperaturen erfreuen. Einerseits erwarten uns phantastische Flüge in den attraktivsten Soaring-, Thermik- und Streckenfluggebieten in Wilderness, Hermanus, Porterville und Kapstadt. Andererseits bieten sich zahllose Möglichkeiten für kulturelle und kulinarische Ausflüge an.',
    block2Heading: 'Fluggebiete',
    block2Paragraph1Html: 'Die schönsten Küsten-Fluggebiete Südafrikas stehen uns in <strong>Wilderness</strong> zur Verfügung. Wir geniessen die „Seabreeze" mit Soaring entlang der weltbekannten „Paradise-Ridge" und der „Map of Africa". Wilderness bedeutet noch viel mehr: Fliegen direkt aus dem Hotelzimmer, welches in unmittelbarer Nähe vom Startplatz liegt, kilometerweites Fliegen entlang der Küste, Groundhandling am Strand und, und, und…',
    block2Paragraph2Html: '<strong>Porterville</strong>, das Paragleiter-Mekka von Südafrika schlechthin, das Äquivalent zu Owen’s Valley in den USA, oder den Dolomiten in den Alpen. Erlebt, was man in Afrika unter Thermik und Cross Country versteht! Wir nutzen die erstklassige Thermik im weltbekannten Streckenflug-Eldorado und fliegen entlang der 150 km langen exotischen Bergkette im Worldcup-Fluggebiet Porterville. Mit dem Takeoff am Dasklip-Pass genießen wir Streckenflüge über faszinierende, unberührte Landschaften.',
    block2Paragraph3Html: 'Das Küstenstädtchen <strong>Hermanus</strong> liegt vor einer langgestreckten Bergkette, die herrliche Flüge im laminaren Küstenwind zulässt. 180m oberhalb des Ortes verläuft die fast 10 km lange Hangkante. Sie lädt sowohl zum Soaren als auch zu kleinen Streckenflügen ein.',
    block2Paragraph4: 'Die letzte Station unserer Reise führt uns die Gardenroute entlang nach Mossel Bay, über den Sir Lowrys Pass nach Kapstadt in unser Quartier. Hier genießen wir das außergewöhnliche Flair einer der schönsten Städte der Welt, mit seinen exklusiven Vororten und der weltbekannten Waterfront. In Kapstadt lassen wir unsere Reise mit Flügen am Lions Head, Signal Hill oder in Franschhoek genussvoll ausklingen. Kapstadt aus der Vogelperspektive, einfach bezaubernd.',
    block3Heading: 'Für wen ist die Reise gedacht?',
    block3Paragraph1: 'Die Reise ist sowohl für engagierte Hobbypiloten wie auch für Gelegenheitsflieger geeignet. Für alle, die fliegerisch dazulernen und für diejenigen, die ihre ersten kleinen Streckenflüge machen möchten – aber auch Streckencracks kommen voll auf ihre Kosten!',
    block3Paragraph2: 'Nicht fliegende Begleitpersonen sind ebenfalls herzlich willkommen.',
    block4Heading: 'Anreise, Unterkunft und Verpflegung',
    block4Paragraph1: 'Die Anreise / Hin- und Rückflug erfolgt nach Kapstadt. Idealerweise bucht ihr eure Flüge ab Frankfurt über Condor bzw. Lufthansa zwecks gemeinsamer Anreise im gleichen Zeitfenster. Hinflug Samstag, 20.2.27 (über Nacht), Beginn der Reise am Sonntag, 21.02.27. Rückflug Sonntag, 7.3.27 (über Nacht), Ankunft in Frankfurt Montag, 8.3.27.',
    block4Paragraph2: 'Während unseres Aufenthalts sind wir in komfortablen Gästehäusern in unmittelbarer Nähe der Startplätze und dem Strand untergebracht. Nach dem Fliegen lassen wir den Tag in geselliger Runde bei gemeinsamem Abendessen ausklingen und lassen uns von der afrikanischen Küche verwöhnen.',
    leistungenHeading: 'Unsere Leistungen',
    leistungen: [
      'professionelle Betreuung durch unsere Fluglehrer',
      'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
      'Flugwetterbriefing',
      'Funkbetreuung',
      'Videoanalyse',
      'alle Transfers während der Reisedauer in Mietfahrzeugen sowie Auffahrten zu Startplätzen',
      'Übernachtungen in komfortablen Gästehäusern, im Doppelzimmer inkl. Frühstück',
      'Organisation eines Alternativprogramms bei schlechtem Wetter',
      'exkl. Hin- und Rückflug nach Kapstadt',
      'exkl. Geländegebühren vor Ort',
      'exkl. Eintrittspreise für das Alternativprogramm',
    ],
    flyerImage: '/images/flyers/suedafrika.png',
    badges: [
      { label: 'Streckenflugtraining', color: '#E58E26' },
      { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
      { label: 'Soaringtraining', color: '#80C533' },
      { label: 'Groundhandlingtraining', color: '#3274B7' },
    ],
    bookingButtonText: 'Reise buchen',
    bookingButtonLink: '/events?category=Reisen',
    tourpreisLabel: 'Tourpreis',
    tourpreisAmount: '3.350,- €',
    voraussetzungText: 'Voraussetzung: mindestens A-Schein / Sopi',
    additionalNoteText: 'Die Tour findet ab 8 Teilnehmern statt, bitte vor verbindlicher Flugbuchung nachfragen, dass die Reise auch durchgeführt wird.',
    scheduleButtonText: 'Termin: siehe Kalender',
    scheduleButtonLink: '/events?search=Südafrika',
    gutscheinHeading: 'Tour Verschenken',
    gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
  },
  'bergamo-tour': {
    eyebrow: 'REISEN',
    heading: 'Bergamo-Tour',
    heroImage: '/images/reisen/bergamo.jpg',
    heroImageAlt: 'Bergamo-Tour',
    contentBlocks: [
      { heading: 'Genussfliegen – Dolce Vita in und um Bergamo', text: 'Italien einmal abseits der ausgetretenen Pfade, heißt hier Fliegen rund um Bergamo, den Ausläufern der Südalpen kurz vor Mailand. Kleine Bergdörfer und entlegene Hütten und Höfe säumen die Wege bis auf die Gipfel. Phantastische Ausblicke von der Gebirgslandschaft bis in die Poebene Richtung Mailand warten auf uns.' },
      { heading: 'Fluggebiete', text: 'Unsere Startplätze liegen am Rande der Südalpen rund um Bergamo. Die Startplätze sind großzügig und laden auch zum Toplanden ein.' },
      { heading: 'Für wen ist die Reise gedacht?', text: 'Für den Gelegenheits-Genussflieger der fliegerisch dazulernen und für denjenigen, der erste kleine Thermikflüge machen möchte. Mit Starthöhen von über 1.000 Metern bieten die Südalpen durchaus alpine Thermikflugqualitäten.' },
      { heading: 'Anreise, Unterkunft und Verpflegung', text: 'Die Anreise nach Italien erfolgt selbst (PKW oder Flug nach Bergamo bzw. Mailand möglich) oder mit unserem Flugschulbus. Wir übernachten in der Nähe von Bergamo in einem netten Hotel direkt in einem der Fluggebiete. Kulinarisch kommen wir mit Pizza und Pasta ebenfalls voll auf unsere Kosten.' },
    ],
    leistungenHeading: 'Unsere Leistungen',
    leistungen: [
      'professionelle Betreuung durch unsere Fluglehrer',
      'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
      'Flugwetterbriefing',
      'Funkbetreuung',
      'exkl. Anreise, Unterkunft, Verpflegung, Auffahrten',
      'exkl. Geländegebühren',
      'exkl. Eintrittspreise für das Alternativprogramm',
      'exkl. Auslandskrankenversicherung inkl. Rücktransport\n(bitte unbedingt abschließen - gibt es z. B. für 13,90 € /Jahr beim ADAC)',
    ],
    badges: [
      { label: 'Streckenflugtraining', color: '#E58E26' },
      { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
      { label: 'Soaringtraining', color: '#80C533' },
      { label: 'Groundhandlingtraining', color: '#3274B7' },
    ],
    bookingButtonText: 'Reise buchen',
    bookingButtonLink: '/events?category=Reisen',
    priceLabel: 'Tourpreis',
    price: '890,- €',
    voraussetzungText: 'Voraussetzung: mindestens A-Schein / Sopi',
    scheduleButtonText: 'Termine > siehe Kalender',
    scheduleButtonLink: '/events?search=Bergamo',
    gutscheinHeading: 'Tour Verschenken',
    gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
  },
  'vogesen-tour': {
    eyebrow: 'REISEN',
    heading: 'Vogesen-Tour',
    heroImage: '/images/reisen/vogesen.jpg',
    heroImageAlt: 'Vogesen-Tour',
    introParagraph1: "Die Vogesen (frz. les Vosges) schließen sich nahtlos an das Pfälzer Bergland an und bilden ganz im Süden mit den Fluggebieten le Treh, le Drumont, Gustiberg und Ballon d'Alsace eine phantastische Flug-Arena.",
    introParagraph2: 'Sie bieten dem Einsteiger einfache Startplätze mit großzügigen Landeplätzen im Gleitwinkelbereich, dem Fortgeschrittenen die Möglichkeit für erste Streckenflüge, sowie dem ambitionierten Piloten Raum für ausgedehnte Wanderungen unter den Wolken. Unsere jahrelange Erfahrung in diesen Fluggebieten und Startplätze für nahezu alle Windrichtungen bieten die beste Chance, den eigenen Erfahrungsschatz enorm zu erweitern.',
    block1Heading: 'Für wen ist die Reise gedacht?',
    block1Paragraph: 'Für den Gelegenheits-Genussflieger der fliegerisch dazulernen und für denjenigen, der seine ersten kleinen Streckenflüge machen möchte. Mit einer Starthöhe von über 1.000 Metern bieten die Vogesen durchaus alpine Thermik- und Streckenflugqualitäten.',
    block2Heading: 'Anreise, Unterkunft und Verpflegung',
    block2Paragraph: 'Der genaue Treffpunkt wird den Teilnehmern kurz vor Reisebeginn per Email bekannt gegeben. Wir übernachten in Frankreich auf dem Campingplatz – alternativ haben wir Kontakt zu Vermietern von Ferienwohnungen und Pensionen. Wenn gewünscht, werden wir euch dort etwas vermitteln oder für die Gruppe reservieren.',
    leistungenHeading: 'Unsere Leistungen',
    leistungen: [
      'professionelle Betreuung durch unsere Fluglehrer',
      'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
      'Flugwetterbriefing',
      'Funkbetreuung',
      'exkl. Anreise, Unterkunft, Verpflegung, Auffahrten',
    ],
    badges: [
      { label: 'Streckenflugtraining', color: '#E58E26' },
      { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
      { label: 'Soaringtraining', color: '#80C533' },
    ],
    bookingButtonText: 'Reise buchen',
    bookingButtonLink: '/events?category=Reisen',
    priceLabel: 'Tourpreis',
    price: '450,- €',
    priceNote: 'Voraussetzung: mindestens 5 Teilnehmer, A-Schein / Sopi',
    scheduleButtonText: 'Termine > siehe Kalender',
    scheduleButtonLink: '/events?search=Vogesen',
    gutscheinHeading: 'Tour Verschenken',
    gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
  },
  'pfalz-tour': {
    eyebrow: 'REISEN',
    title: 'Pfalz-Tour',
    heroImage: '/images/reisen/pfalz.jpg',
    heroImageAlt: 'Pfalz-Tour',
    introHeading: 'In der Südpfalz gibt es schöne Startplätze die allemal einen Besuch wert sind.',
    introParagraphsHtml:
      '<p class="mb-4">Die Duddefliecher in der Südpfalz mischen unter den Topfliegern der deutschen Gleitschirmwettbewerbe mit. Der deutsche Meister 2012/13, Achim Torn, kommt ebenfalls aus der Südpfalz. Die Buckel der Südpfälzer haben einen Höhenunterschied von bis zu 320 m. Es werden von dort regelmäßig schöne Streckenflüge in den DHV-XC eingereicht. Stundenlange Thermikflüge sind hier ebenso möglich.</p>' +
      '<p class="mb-4">Wir werden mit euch bis zu 7 Startplätze besuchen und euch die nötige Einweisung für diese Fluggelände geben, damit ihr später auch mal als Gast in der Südpfalz fliegen könnt. Wer weiß, vielleicht gefällt es euch ja so gut, dass ihr gleich Mitglied im heimischen Verein werden wollt.</p>' +
      '<p>Die Tour wird von Alex geführt, der diese Gelände wie seine Westentasche kennt. Alex fliegt fast alle seine Streckenflüge von der Südpfalz aus und kann euch bei einem kleinen Streckenvortrag viele Tipps für den Thermikeinstieg geben.</p>',
    tourdatenHeading: 'Tourdaten',
    tourdatenItems: ['Beginn: Freitag ab ca. 15:00 Uhr', 'Ende: Sonntag open End'],
    anreiseHeading: 'Anreise, Unterkunft und Verpflegung',
    anreiseParagraph: 'Der genaue Treffpunkt wird den Teilnehmern kurz vor Reisebeginn per Email bekannt gegeben - wir schauen, welcher Berg am Freitag direkt taugt. Es empfiehlt sich eine Unterkunft irgendwo zwischen Annweiler / Dernbach und Landau zu buchen – von Annweiler aus ist jeder der 7 Startberge innerhalb von 5 bis 15 Autominuten zu erreichen! Eschbach oder Leinsweiler sind auch für die Abendplanung eine gute Option zum Übernachten. Abends kehren wir gemeinsam ein zu einem zünftigen Abendessen und natürlich ner Pfälzer Weinschorle :-)',
    leistungenHeading: 'Unsere Leistungen',
    leistungen: [
      'professionelle Betreuung durch unsere Fluglehrer',
      'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
      'tägliches Flugwetterbriefing',
      'Einweisungsbestätigung für die Flugberge',
      'Funkbetreuung',
      'Geländegebühr vor Ort 15,- € für die Tour',
      'exkl. Übernachtungskosten',
    ],
    badges: [
      { label: 'Streckenflugtraining', color: '#E58E26' },
      { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
      { label: 'Soaringtraining', color: '#80C533' },
    ],
    bookingButtonText: 'Reise buchen',
    bookingButtonLink: '/events?category=Reisen',
    priceLabel: 'Tourpreis',
    price: '350,- €',
    voraussetzungText: 'Voraussetzung: mindestens 5 Teilnehmer, A-Schein / Sopi',
    scheduleButtonText: 'Termine > siehe Kalender',
    scheduleButtonLink: '/events?search=Pfalz',
    gutscheinHeading: 'Tour Verschenken',
    gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
  },
  'savoye-tour': {
    eyebrow: 'REISEN',
    title: 'Savoyer Alpentour',
    heroImage: '/images/reisen/savoye.jpg',
    heroAlt: 'Savoyer Alpentour',
    contentBlocks: [
      { heading: '', text: "Die Savoyer Alpen befinden sich grob zwischen Genf, Chamonix und Grenoble. In dieser Region dürfte es wohl die weltweit größte Fluggebietsdichte geben. Unser Standort ist der Campingplatz La ferme de la Serraz neben dem Lac d' Annecy in Doussard. Um den See liegen alleine schon 3 Fluggelände, die von der Hauptwindrichtung recht unabhängig sind und fast täglich Flugbedingungen bieten. Von dort aus unternehmen wir dann Tagestouren in die umliegenden Fluggebiete, bspw. Allevard / St. Hilaire oder Samoëns." },
      { heading: 'Die Tour...', text: 'Die Start- und Landeplätze der Savoyer Alpen sind von ihrem Grundcharakter einfach. Landschaftlich ist die Region mit ihren weißen Kalkfelsen, Wald und den 3 tiefblauen Seen der Renner. Der Blick zum Mt. Blanc, die Cafés, Boulangerien und Patisserien sprechen für sich. Durch die Geländevielfalt muss sich der Pilot auf neue Start- und Landeplatzsituationen einstellen, was einen sehr guten Weiterbildungseffekt hat. Thermisch sind die Savoyer Alpen sehr gut. Genauso gibt es viele Kanten, an denen mit dem Gleitschirm stundenlang gesoart werden kann. Ist genügend Arbeitshöhe vorhanden, können kleinere Strecken geflogen werden. Passt das Wetter am Col de la Forclaz, können die Piloten den Streckenflugklassiker "die kleine Seerunde" nach vorheriger Besprechung in Angriff nehmen. Und schon habt ihr den Streckenflug für den B-Schein in der Tasche.' },
      { heading: 'Für wen ist die Reise gedacht?', text: 'Für den Gelegenheits-Genussflieger der fliegerisch dazulernen und für denjenigen, der seine ersten kleinen Streckenflüge machen möchte. Mit einer Starthöhe von über 1.000 Metern bieten die Savoyer Alpen durchaus alpine Thermik- und Streckenflugqualitäten.' },
      { heading: 'Anreise, Unterkunft und Verpflegung', text: 'Wir übernachten in Frankreich auf dem Campingplatz – für alle ohne eigenes Dach / Haus gibt es dort voll ausgestattete Mobilehomes zum Mieten.' },
    ],
    leistungenHeading: 'Unsere Leistungen',
    leistungen: [
      'professionelle Betreuung durch unsere Fluglehrer',
      'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
      'tägliches Flugwetterbriefing',
      'Funkbetreuung',
      'exkl. Übernachtungskosten, Verpflegung, Auffahrten',
    ],
    badges: [
      { label: 'Streckenflugtraining', color: '#E58E26' },
      { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
      { label: 'Soaringtraining', color: '#80C533' },
    ],
    bookingButtonText: 'Reise buchen',
    bookingButtonLink: '/events?category=Reisen',
    priceLabel: 'Tourpreis',
    price: '850,- €',
    voraussetzungText: 'Voraussetzung: mindestens 5 Teilnehmer, A-Schein / Sopi',
    scheduleButtonText: 'Termin > siehe Kalender',
    scheduleButtonLink: '/events?search=Savoye',
    gutscheinHeading: 'Tour Verschenken',
    gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
  },
  'slowenien-tour': {
    eyebrow: 'REISEN',
    heading: 'Slowenien-Tour',
    heroImage: '/images/reisen/slowenien.jpg',
    heroImageAlt: 'Slowenien-Tour',
    contentBlocks: [
      { heading: 'Thermik und Streckenfliegen in Slowenien in den julischen Alpen', paragraphs: ['Hier könnt ihr erste Thermik- und Streckenflugerfahrungen sammeln, den 15 km B-Schein-Flug oder natürlich auch richtig lange Streckenflüge machen. Die ständige Erreichbarkeit von komfortablen Landewiesen ermöglichen ein entspanntes Streckenfliegen. Den Tag beenden wir dann mit einem verlängerten Abgleiter in die Abendsonne und einem Lande-Lasco.'] },
      { heading: 'Fluggebiete', paragraphs: ['Unsere Hauptstartplätze liegen entlang der türkisblauen Soča in der Nähe von Kobarid und Tolmin. Je nach Windrichtung starten wir auf dem Stol (1.400 m) oder auf dem Kobala (1.100 m) bei Tolmin. Ein weiteres Fluggebiet ist der Liak Nähe Nova Gorica, eine wunderschöne riesige Soaringkante für stundenlange entspannte Flüge.'] },
      { heading: 'Für wen ist die Reise gedacht?', paragraphs: ['Für diejenigen, die in einem entspannten Fluggebiet ihre ersten Soaring- und Thermikerfahrungen sammeln wollen sowie für den ambitionierten Genussflieger, der sich an seine ersten kleinen Strecken rantasten will. Aber auch der bereits erfahrene Streckenpilot kann hier weitere XC-Punkte sammeln. Mindestvoraussetzung ist der A-Schein oder Sopi.', 'An nicht fliegbaren Tagen, gibt es einige Möglichkeiten in dieser Gegend schöne Ausflüge zu unternehmen oder je nach Wind Groundhandling, Kajaktouren, Rafting, Baden in der Soča, wandern – sehenswerter Naturpark direkt bei Tolmin, Höhlenbesichtigungen, Mountainbiking oder einfach nur der Soča zu chillen.'] },
      { heading: 'Anreise, Unterkunft und Verpflegung', paragraphs: ['Die Anreise nach Slowenien erfolgt selbst oder mit unserem Flugschulbus. Wir übernachten in Slowenien auf dem Campingplatz – alternativ haben wir Kontakt zu Vermietern von Ferienwohnungen und Pensionen, dort können wir Zimmer vermitteln. Die Erlebnisse des Tages lassen wir dann abends in gemütlicher Runde nochmals in einer der vielen gemütlichen Lokale bei einem Lasco oder slowenischen Wein und natürlich Čevapčiči Revue passieren.'] },
    ],
    leistungenHeading: 'Unsere Leistungen',
    leistungen: [
      'professionelle Betreuung durch unsere Fluglehrer',
      'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
      'Flugwetterbriefing',
      'Funkbetreuung',
      'exkl. Anreise, Unterkunft, Verpflegung, Auffahrten',
      'exkl. Geländegebühren',
      'exkl. Eintrittspreise für das Alternativprogramm',
      'exkl. Auslandskrankenversicherung inkl. Rücktransport\n(bitte unbedingt abschließen - gibt es z. B. für 13,90 € /Jahr beim ADAC)',
    ],
    badges: [
      { label: 'Streckenflugtraining', color: '#E58E26' },
      { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
      { label: 'Soaringtraining', color: '#80C533' },
      { label: 'Groundhandlingtraining', color: '#3274B7' },
    ],
    bookingButtonText: 'Reise buchen',
    bookingButtonLink: '/events?category=Reisen',
    priceLabel: 'Tourpreis',
    price: '890,- €',
    voraussetzungText: 'Voraussetzung: mindestens A-Schein / Sopi',
    scheduleButtonText: 'Termine > siehe Kalender',
    scheduleButtonLink: '/events?search=Slowenien',
    gutscheinHeading: 'Tour Verschenken',
    gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
  },
  reparatur: {
    eyebrow: 'SERVICE',
    heading: 'Reparatur-Service',
    heroImage: '/images/service/reparatur.jpg',
    heroAlt: 'Reparatur-Service',
    werkstattImage: '/images/service/werkstatt.jpg',
    werkstattAlt: 'Werkstatt',
    contentHeading: 'Du hast einen Defekt an deiner Ausrüstung? Einen Riß in deinem Gleitschirm? Wir retten was noch zu retten ist ;-)',
    contentHtml: 'Wir bieten euch einen professionellen Reparatur-Service für eure Ausrüstung an. Die notwendigen Reparatur-Arbeiten führen wir in unserer Service-Werkstätte mit größter Sorgfalt und modernster Technik durch – damit ihr schnell wieder sicher abheben könnt! Nach Absprache führen wir auch gerne Teile des <a href="/service/2-jahres-check" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">2-Jahres-Checks</a> im Rahmen der Reparatur durch.',
    bookingButtonText: 'Meldet euch wir schauen es uns an',
    priceLabel: 'Reparaturen aller Marken',
    priceText: 'Preis auf Anfrage',
    noteHtml: 'Bitte vereinbare für den Reparaturservice einen Termin mit uns. Hierzu könnt ihr in der <a href="/infos#kontakt" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Flugschule</a> vorbeischauen oder ihr meldet euch telefonisch unter 0151 18836000',
    footerButtonText: 'Termin vereinbaren',
    footerButtonLink: '/infos#kontakt',
  },
  trimmtuning: {
    eyebrow: 'SERVICE',
    heading: 'Trimmtuning',
    heroImage: '/images/service/trimmtuning.jpg',
    heroAlt: 'Trimmtuning',
    blockHeading: '"Trimmtuning" – das Zauberwort in der Gleitschirmszene.',
    blockSubheading: 'Für bessere und sicherere Schirme – und mehr Freude an eurem Fluggerät!',
    blockParagraph: 'Wir messen mit Laser den Ist-Zustand des Schirmes und stellen die Leinenlängen danach so optimal wie möglich nach, damit die Trimmung wieder bestmöglich dem Zulassungsmuster entspricht. Wenn wir bei der Trimmung euer Startgewicht kennen, können auch diese Werte berücksichtigt werden und der Schirm so optimal auf euch als Pilot eingestellt werden. Idealerweise kann so in der Luft mehr Leistung rausgeholt werden, ohne dass euer Schirm dadurch an Sicherheit verliert oder anspruchsvoller wird. Der Pilot erhält 2 Messdatenblätter. Einmal den Ist-Zustand vor der Trimmung und einmal danach.',
    leistungenHeading: 'UNSERE LEISTUNGEN',
    leistungen: [
      'Vermessen der Gesamtleinenlängen',
      'Nachstellen der Trimmung, idealerweise auf euer Startgewicht',
      'Nochmaliges Vermessen',
      '2 Messdatenblätter (Messwerte der Leinenlängen vor der Trimmung / angelieferter Zustand, Messwerte der Leinenlängen nach der Trimmung / ausgelieferter Zustand)',
      'inkl. Versandkosten - Hin-/Rückversand',
    ],
    formularButtonText: 'Um deinen Gleitschirm trimmen zu können, benötigen wir das ausgefüllte Formular',
    priceCardButtonText: 'Bitte das Formular unten ausfüllen',
    priceLabel: 'Trimmtuning alle Marken',
    priceNote: '[ inkl. Versand ]',
    price: '120,- €',
    priceCardBottomButtonText: 'Zum Trimm-Auftrag > Service-Auftrag unter Sonstiges ausfüllen',
    trimmAuftragHeading: 'TRIMM-AUFTRAG',
    trimmAuftragIntro: 'Du erhältst eine Kopie des Formulars per E-Mail, dieses bitte ausdrucken und zusammen mit dem Gleitschirm in unserer Flugschule oder alternativ in Landau bzw. Offenbach vorbeibringen.',
    addresses: [
      { location: '69469 Weinheim, Untergasse 27:', note: 'bitte wegen Öffnungszeiten Newsletter beachten' },
      { location: '76829 Landau Am Birnbach 6:', note: 'Termin bitte telefonisch vereinbaren' },
    ],
  },
  rettungspacken: {
    eyebrow: 'SERVICE',
    title: 'Rettungsgeräte-Packservice',
    heroImage: '/images/service/rettungspackservice.png',
    heroAlt: 'Rettungsgeräte-Packservice',
    block1Heading: 'Rettung professionell gepackt – wir packen sie, als wäre es unsere eigene.',
    paragraph1: 'Wie ihr wisst, soll jede Rettung mind. einmal jährlich gepackt werden. Die Hersteller empfehlen jedoch ein kürzeres Intervall von max. 6 Monaten! Wir packen deine Rettung innerhalb von 3 Werktagen – damit ihr schnell wieder sicher abheben könnt (wenn wir nicht grade im Ausland sind... ;-)!',
    paragraph2: 'Eure Sicherheit liegt uns am Herzen – wir packen jede Rettung mit größter Sorgfalt.',
    redParagraph1: 'Wir packen alle Standardretter vom Typ Rund- bzw. Kreuzkappen - Packschlaufen Voraussetzung!.',
    redParagraph2: 'Retter, die nicht bei uns gekauft wurden bitte ggf. vorab abklären.',
    formularButtonText: 'Um deine Rettung packen zu können, benötigen wir das ausgefüllte Formular.',
    infoHeading: 'Rettung packen leicht gemacht',
    infoHtml: 'Schaut einfach mal bei einem unserer <a href="/performance/rettungsgeraetetraining" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Rettungsgerätetrainings</a> vorbei. Dort lernt ihr, wie die Rettung im Notfall geworfen wird und wir zeigen euch, wie ihr die Rettung selbst packen könnt! Wenn ihr auf Nummer Sicher gehen wollt oder auch keine Lust drauf habt, packen wir die Rettung natürlich auch weiterhin für euch ;-). Nähere Details zum Rettungsgerätetraining findet ihr <a href="/performance/rettungsgeraetetraining" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">hier</a>.',
    priceButtonText: 'Bitte das Formular unten ausfüllen',
    priceRows: [
      { label: 'Packservice Rundkappe*', price: '55,- €' },
      { label: 'Packservice Rechteckkappe*', price: '55,- €' },
    ],
    priceNote: '[ andere Rettungen / Exoten auf Anfrage ]',
    checkButtonText: 'Zum Check',
    packAuftragHeading: 'PACK-AUFTRAG',
    packAuftragIntro: 'Du erhältst eine Kopie des Formulars per E-Mail, dieses bitte ausdrucken und zusammen mit der Rettung (im Gurtzeug) in unserer Flugschule oder alternativ in Landau vorbeibringen.',
    addresses: [
      { location: '69469 Weinheim, Untergasse 27:', note: 'bitte wegen Öffnungszeiten Newsletter beachten' },
      { location: '76829 Landau Am Birnbach 6:', note: 'Termin bitte telefonisch vereinbaren' },
    ],
  },
  '2-jahres-check': {
    eyebrow: 'SERVICE',
    heading: '2-Jahres-Check',
    videoUrl: 'https://www.youtube-nocookie.com/embed/wZH9ouLjNG8?rel=0',
    videoTitle: 'Gleitschirm Check - So läuft ein Schirmcheck ab! | PART 1 - Flugschule Hirondelle',
    introHeading: 'Eure Sicherheit liegt uns am Herzen',
    introParagraph1: 'Wir führen die Wartungsarbeiten bzw. notwendige Reparatur-Arbeiten in unserer Service-Werkstätte mit größter Sorgfalt und modernster Technik durch – damit ihr schnell wieder sicher abheben könnt!',
    introParagraph2: 'Wir checken alle gängigen Modelle innerhalb von 10 bis 14 Tagen. Zu Saisonbeginn kann es schnell mal zu längeren Checkzeiten kommen, wir empfehlen daher den Check während der Wintermonate einzuplanen. Kleinere Reparaturen sind im Check ohne Aufpreis enthalten – größere Arbeiten werden vor der Durchführung mit euch individuell abgestimmt.',
    introParagraph3: 'Gemäß der Luftgeräteprüfverordnung (§ 14) dürfen nur Gleitschirme in die Luft, die einen gültigen Check (im durch den Hersteller vorgegebenen Intervall) besitzen. Hiervon ist auch euer Versicherungsschutz abhängig, daher ist es absolut wichtig, den Schirm ordnungsgemäß überprüfen zu lassen.',
    pruefschritteHeading: 'UNSERE PRÜFSCHRITTE',
    pruefschritte: [
      'Identifizierung des Gerätes', 'Sichtkontrolle der Kappe', 'Sichtkontrolle der Leinen',
      'Sichtkontrolle der Verbindungsteile', 'Kontrolle der Leinenfestigkeit', 'Kontrolle der Kappenfestigkeit',
      'Kontrolle der Luftdurchlässigkeit des Tuches', 'Vermessung der Leinenlängen mit Laser-Technik',
      'Kontrolle, Berechnung und Korrektur von Trimmung sowie Einstellung falls nötig (ohne Aufpreis)',
      'Kleinere Reparaturen bei Bedarf', 'Hin- und Rückversand deines Schirms zum Checkbetrieb (ab Flugschule)',
    ],
    devise: 'Unsere Devise: Wer für weniger Leistung mehr Geld ausgibt, ist selbst schuld!',
    formularButtonText: 'Um deinen Gleitschirm Check durchzuführen, benötigen wir das ausgefüllte Formular',
    referenceText: 'LuftGerPV § 14 Nachprüfungen (5) Die Lufttüchtigkeit des Luftfahrtgeräts nach § 10a ist nach den vom Hersteller vorgegebenen Anweisungen durch den Halter oder in dessen Auftrag nachzuprüfen oder nachprüfen zu lassen. Der Halter ist für die rechtzeitige und vollständige Durchführung der Prüfungen verantwortlich. Er hat Mängel an dem Luftfahrtgerät oder an den Prüfanweisungen unverzüglich dem Hersteller zu melden. §§ 15 und 18 bis 20 finden keine Anwendung.',
    priceButtonText: 'Bitte das Formular unten ausfüllen',
    priceLabel: 'Checkpreis*',
    priceNote: '[inkl. Versandkosten zum Checkbetrieb ab Flugschule ]',
    price: '195,- €',
    surchargeLabel: '*Aufpreis für Abgabe im Schnellpacksack',
    surchargePrice: '10,- €',
    extraCostsNote: 'Zusatzkosten für Reparaturen nach Aufwand und Absprache',
    priceBottomButtonText: 'Zum Check-Formular',
    auftragHeading: 'CHECK-AUFTRAG',
    auftragIntro: 'Du erhältst eine Kopie des Formulars per E-Mail, dieses bitte ausdrucken und zusammen mit dem Gleitschirm in unserer Flugschule oder alternativ in Landau vorbeibringen.',
    addresses: [
      { location: '69469 Weinheim, Untergasse 27:', instructions: 'bitte wegen Öffnungszeiten Newsletter beachten' },
      { location: '76829 Landau Am Birnbach 6:', instructions: 'Termin bitte telefonisch oder per E-Mail vereinbaren' },
    ],
  },
  billings: {
    title: 'Billings',
    eckdatenRows: [
      { label: 'Ausrichtung', value: 'Nordwest' },
      { label: 'Windspektrum', value: '300° bis 10°' },
      { label: 'Höhendifferenz', value: '130 Meter' },
      { label: 'Geländehalter', value: '1.ODC' },
    ],
    routenplanerUrl: 'http://maps.apple.com/?q=%2049.754684, 8.794765',
    addressHeading: 'Adresse/ Anfahrt',
    addressHtml: 'Navi Landeparkplatz: 64405 Fischbachtal Ortsteil Billings Almenweg 1 GPS N 49°45´16.6´´ O 08°47´41.1´´<br />Vom Landeparkplatz zum Landeplatz: Vom Parkplatz zurück zur Brücke und auf der Meßbacher Straße leicht bergab immer Richtung Niedernhausen laufen. Die nächste links und noch ca. 100 Meter bis zu der Sitzgruppe am Landeplatz.',
    besonderheitenHeading: 'Besonderheiten / Gefahrenquellen',
    besonderheiten: [
      'Stärkerer Wind kann in Billings auf Grund des vorgelagerten höheren Berges stärkere Turbulenzen verursachen. Der Wind soll in Billings eher schwach sein und aus einem Sektor zwischen 300° bis 10° kommen. Windwerte vom Melibokus liefern sehr gute Anhaltswerte (Tel: 06251/983612).',
      'Bei Abwinden muss damit gerechnet werden, dass auf Grund der flachen Hangneigung auf einer der oberen Notlandewiesen gelandet werden muss. - Durch die flache Hangneigung ist es nicht immer sicher, dass man mit dem Gleitschirm über den unteren Weidezaun am Ende des Startplatzes kommt. Daher ist vorher seitlich am Hang zu landen',
      'Achtung es steht eine durchgehende Baumreihe entlang des Baches nördlich des Landeplatzes Richtwerte für Flüge mit dem L-Schein: - Für Piloten mit Flugauftrag: Windrichtung zwischen 300° bis 10°; Windgeschwindigkeit im Durchschnitt kleiner 10 km/h; Spitzen kleiner 20 km/h (Richtwert für Alleinflüge mit dem Höhenflugausweis - Für Piloten mit Flugauftrag maximal 5-10 km/h',
    ],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4225.630824958612!2d8.793195951823863!3d49.754683445030565!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bd613866f97d8d%3A0xaffec9e3ca256d13!2sAlmenweg%201%2C%2064405%20Fischbachtal!5e1!3m2!1sde!2sde!4v1588792602122!5m2!1sde!2sde',
  },
  erlau: {
    title: 'Erlau',
    eckdatenRows: [
      { label: 'Ausrichtung', value: 'Ost' },
      { label: 'Windspektrum', value: '50° bis 110°' },
      { label: 'Höhendifferenz', value: '50 Meter' },
      { label: 'Geländehalter', value: '1.ODC' },
    ],
    routenplanerUrl: 'https://maps.app.goo.gl/479uTYgErKrefYuJ8?g_st=aw',
    mainImage: '/images/1-gelaende/erlau.JPG',
    parkplatzHtml: 'Parkplatz:&nbsp; <a href="https://goo.gl/maps/kPkh6ogZp5H2" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Wanderparkplatz Rodenstein</a>, 64407 Fränkisch-Crumbach',
    addressHeading: 'Adresse/ Anfahrt',
    addressText: 'Von Füth im Odenwald aus kommend zum Wanderparkplatz bei der Ruine Rodenstein: 100 Meter vor dem Ortsausgangsschild von 64385 Reichelsheim links ab Richtung Ruine Rodenstein / Eberbach. Durch das Örtchen Eberbach bitte mit 30 kam ha fahren. Einen km nach der Abzweigung führt ein Weg hoch, der nur für landwirtschaftlichen Verkehr freigegeben ist. Dort gerade aus (halb links) auf der normalen Straße weiterfahren. Nach weiteren 700 m kommt man dann zu einem Straßen-T an dem es links zur Ruine Rodenstein geht und rechts zum Parkplatz. Hier rechts abbiegen und den Berg hoch fahren nach 300 m beim nächsten Straßen-T links. Nach 100 m ist der große Wanderparkplatz auf der rechten Seite (49°44´03,97´´Nord 8°49´21,21´´ Ost). Oberhalb vom Parkplatz wird ein Weg vielleicht bergauf. Der Weg ist mit dem Hinweisschild „weißes Rechteck mit blauem Dreieck" gekennzeichnet. Nicht den Weg mit dem Sperr Schild nehmen. Nach 400 m kommt man an eine Gabelung, dort weiter gerade aus dem Wegweisern folgen. Nach weiteren 200 m kommt man zur nächsten Gabelung. Dort rechts halten und noch 100 m bis zum Übungshang (49°44´27,49´´Nord 8°49´28,31´´ Ost) laufen. Landeplatz 1: (49°44´28,87´´Nord 8°49´43,53´´ Ost) Landeplatz 2: (49°44´23,79´´Nord 8°49´44,29´´ Ost).',
    zumFluggelaendeHeading: 'Zum Fluggelände',
    zumFluggelaendeText: 'In Erlau wird der Wind durch das U-förmige Gelände kanalisiert und sorgt somit oft für gute Startbedingungen. Bei sehr schwachem, überregionalem Wind, bildet sich morgens in Erlau ein thermisch bedingter Ostwind aus, der dann später auf die Hauptwindrichtung dreht. Bei Seitenwindlagen ist erfahrungsgemäß ein Nordschlag turbulenzarmer als ein Südschlag. Das kommt von der Leesituation durch den hohen Buchenwald auf der rechten Seite des Übungshangs. Abends setzt sich auf dem Übungshang leichter Rückenwind ein, obwohl die Windfahne am Holunderhof noch Ostwind anzeigt. Dieser Effekt erklärt sich dadurch, dass kalte schwerere Luft bodennah nach unten abfließt. Die kalte Luft bildet sich im Wald hinter dem Übungshang, der abends im Schatten liegt.',
    besonderheitenHeading: 'Besonderheiten / Gefahrenquellen / Regeln',
    besonderheitenText: 'Wenn es gut trägt, kann man über den unteren Zaun fliegen und auf dem großen Landeplatz östlich des unteren Zauns landen. Trägt es weniger gut, muss vor dem Zaun am Hang mit Seitenwind gelandet werden. Piloten vom oberen Startplatz starten können im unteren Bereich des Übungshanges landen-Luftraumkontrolle! Am Vormittag nach anfangs ruhigen Flugbedingungen kann der Wind sehr schnell aufleben. Bei Weidebetrieb kann der Übungshang ab und zu gesperrt sein. In Erlau wird 30 km/h auf der Straße gefahren! Bitte daran halten.',
    richtwerteHeading: 'Richtwerte für Flüge mit dem L-Schein',
    richtwerteText: 'Wetterdaten Melibokus: Windrichtung zwischen 50° bis 110°; Windgeschwindigkeit im Durchschnitt kleiner 15km/h; Spitzen kleiner 25 km/h. Wind am Hang zw. 10-12Km/h optimal |&nbsp; Tel. Melibokus : 06251 / 983612',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d8454.331400063544!2d8.823493765027685!3d49.73706580741055!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bd60e4cb678049%3A0xd65ddab5f83f13a2!2sWanderparkplatz%20Rodenstein!5e1!3m2!1sde!2sde!4v1588789569688!5m2!1sde!2sde',
    mapSideImage: '/images/1-gelaende/Erlau_1.png',
    extraImage: '/images/1-gelaende/Erlau_2.png',
  },
  gadern: {
    title: 'Gadern',
    eckdatenRows: [
      { label: 'Ausrichtung', value: 'Nord-Ost' },
      { label: 'Windspektrum', value: '30° - 100°' },
      { label: 'Höhendifferenz', value: '50 Meter' },
      { label: 'Geländehalter', value: 'Lindenfelser Gleitschirmflieger' },
    ],
    routenplanerUrl: 'https://maps.app.goo.gl/12mDeygznMrRL3da8?g_st=aw',
    mainImage: '/images/1-gelaende/gadern.JPG',
    addressHeading: 'Adresse/ Anfahrt',
    addressText: '69483 Wald-Michelbach<br />Ortsteil Gadern',
    gasthausText: 'Gasthaus Bergblick; Stallenkandel 5; 69483 Wald-Michelbach (GPS: 49°34´41.08´´ Nord 8°48´01,16´´ Ost)',
    pdfUrl: '/pdf/Gelaendebeschreibung%20Gadern.pdf',
    pdfLabel: 'Download Infos & Geländebeschreibung',
    parkenHeading: 'Parken am Bergblick:',
    parkenText: 'Die Autos sollen auf dem Hof des Gasthauses geparkt werden. Ihr fahrt am Gasthaus vorbei in die Einfahrt nach unten bis zum Parkplatz. Der Parkplatz vor dem Gasthaus und gegenüber auf der Straße muss für die Tagesgäste frei bleiben.',
    zumStartplatzHeading: 'Vom Bergblick zum Startplatz:',
    zumStartplatzText: 'Vom Gasthaus Bergblick die Hauptstraße wieder ca. 200 Meter bergab laufen. Dort führt ein Teerweg scharf rechts ab. Diesem ca. 500 Meter bis auf die Kuppe folgen. Auf der Kuppe links und nach 100 Metern seht ihr rechts den Startplatz (GPS: 49°34´55.58´´ Nord 8°48´17,76´´ Ost)',
    besonderheitenHeading: 'Besonderheiten/ Gefahrenquellen:',
    besonderheitenText: 'Am Vormittag nach anfangs ruhigen Flugbedingungen kann der Wind sehr schnell aufleben. Beim Aufziehen vom Gleitschirm bei stärkerem Wind kann der Schirm in den hinteren Stacheldrahtzaun geraten. Der Pilotentransport wird vom Gasthaus Bergblick aus organisiert. Maximal 3 Autos am Startplatz mit sichtbarer Auffahrgenehmigung an der Windschutzscheibe. Bei Weidebetrieb ist der Übungshang gesperrt. Die Landung erfolgt seitlich am Hang (Besonderheiten Hanglandetechnik) Stärkerer Wind von rechts verursacht ein Leegebiet hinter dem Wäldchen auf der rechten Seite vom Übungshang - Es muss eine zweite Person beim Flugbetrieb anwesend sein.',
    tagesgebuehrHeading: 'Tagesgebühr:',
    tagesgebuehrText: '€ 2. - für alle Piloten und Flugschüler!!! Siehe Kiste im Startbereich.',
    richtwerteHeading: 'Richtwerte für Flüge mit dem L-Schein:',
    richtwerteText: 'Windrichtung zwischen 360° und 90°; Windgeschwindigkeit im Durchschnitt kleiner 10 km/h; Spitzen kleiner 15 km/h. Windwerte Melibokus: Tel. 06251/983612',
    beschaedigungenHeading: 'Beschädigungen am Viehzaun:',
    beschaedigungenText: 'Sollten irgendwelche Beschädigungen am Zaun entstanden sein, bitte unbedingt bei Familie Jöst; Gadener Straße 20 in 69483 Wald-Michelbach Ortsteil Gadern melden. Der Elektrozaun funktioniert dann oft nicht mehr (Erdung), was in der Vergangenheit schon viel Ärger und unnötige Arbeit ergab.',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7409.279975444094!2d8.797092468679566!3d49.58047520194445!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4797dd93b3e5ef8b%3A0xf41240f507c38b86!2sBergblick!5e1!3m2!1sde!2sde!4v1588789820942!5m2!1sde!2sde',
  },
  lindenfels: {
    title: 'Lindenfels',
    eckdatenRows: [
      { label: 'Ausrichtung', value: 'Süd' },
      { label: 'Windspektrum', value: '150° bis 210°' },
      { label: 'Höhendifferenz', value: '30 bis 107 Meter' },
      { label: 'Geländehalter', value: 'Lindenfelser Gleitschirmflieger' },
    ],
    routenplanerUrl: 'https://maps.app.goo.gl/vQjqsJ1oVvcKNpkM9?g_st=aw',
    mainImage: '/images/1-gelaende/lindenfels.JPG',
    addressHeading: 'Adresse/ Anfahrt',
    addressHtml: 'Schwimmbadstraße 10<br />64678 Schlierbach<br /><br />Von dort aus 100 Meter weiter Bergauffahren. Treffpunkt ist rechts am Parkplatz bei der Pferdekoppel, parken bitte in der Straße im Wald oder am Schwimmbad (im Wald weiter der Straße folgen).<br />GPS: 49°41´13.27´´ N , 8°46´08,97´´O',
    pdfUrl: '/pdf/Gelaendebeschreibung%20Lindenfels.pdf',
    pdfLabel: 'Download Infos & Geländebeschreibung',
    besonderheitenHeading: 'Besonderheiten/ Gefahrenquellen:',
    besonderheiten: [
      'Benutzung des unteren Übungshanges bei höherem Graswuchs ab 50 cm nicht möglich, da sonst Ertragsminderung bei der Heuernte durch zusammengetrampeltes Gras für die Bauern',
      'Parken der Autos am Waldrand in der Kurve am Zugang zum oberen Übungshang ist nicht erlaubt',
      'Ungeordnetes Parken bei dem Reiterhof; Behinderung der Reiter bei der Zufahrt zum Hof vermeiden',
      'Erschrecken der Pferde auf der Koppel am Reiterhof vermeiden',
      'Durch die flache Hangneigung ist es nicht immer sicher, dass man über die untere Baumreihe fliegt-Hanglandung vor der Baumreihe',
      'Bei Aufwind und Thermik muss nach der Baumreihe abgeachtert werden',
      'Durch die vorgegebene Topographie muss sich der Pilot immer auf eine Hanglandung einstellen',
      'Luftraumkontrolle, da Piloten vom den oberen Startplätzen im Startbereich des unteren Startplatzes einlanden können',
      'Anwesenheit: mindestens 2 Personen',
    ],
    richtwerteHeading: 'Richtwerte für Flüge mit dem L-Schein:',
    richtwerte: [
      'Tel. Melibokus : 06251 / 983612',
      'Windmessstation Lindenfels 0176-63307995',
      'Windrichtung zwischen 150° bis 210°; Windgeschwindigkeit im',
      'Durchschnitt kleiner 10 km/h; Spitzen kleiner 15 km/h',
    ],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4231.533100041694!2d8.767622333468386!3d49.68691069271673!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4797df5ee53e39f7%3A0x150235a5aaa4c8e8!2sReit-%20und%20Fahrverein%20Nibelungen%20e.V.!5e1!3m2!1sde!2sde!4v1588790231627!5m2!1sde!2sde',
  },
  'nonrod-nordost': {
    title: 'Nonrod Nordost',
    eckdatenRows: [
      { label: 'Ausrichtung', value: 'Nordost' },
      { label: 'Windspektrum', value: '10° bis 60°' },
      { label: 'Höhendifferenz', value: '31 Meter' },
      { label: 'Geländehalter', value: 'Flugschule Hirondelle' },
    ],
    routenplanerUrl: 'https://maps.app.goo.gl/TuBxGE89oS9MJRqKA?g_st=aw',
    addressHeading: 'Adresse/ Anfahrt',
    addressText: '64405 Fischbachtal<br />Ortsteil Nonrod',
    parkplatzHeading: 'Parkplatz:',
    parkplatzText: 'Das Material kann am Fluggelände abgeladen werden.<br />Geparkt wird am Rast-und Parkplatz Nonroder Höhe (GPS ´49°45´21,15´´ 8°49´45,15´´) <br /><br />Wegbeschreibung: An der Haselnussgruppe auf dem Höhenweg weiter Richtung Norden fahren. Nach ca. 200 Meter kommt der Parkplatz auf der rechten Seite.',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4451.539088793464!2d8.821831558418785!3d49.75005980309465!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bd61cb2b29affb%3A0xcf99bf11be67ae85!2sNonroder%20H%C3%B6he!5e1!3m2!1sde!2sde!4v1588790674160!5m2!1sde!2sde',
  },
  nonrod: {
    title: 'Nonroder Höhe',
    eckdatenRows: [
      { label: 'Ausrichtung', value: 'West bis Nord' },
      { label: 'Optimale Ausrichtung', value: 'Nordwest' },
      { label: 'Windspektrum', value: '270° bis 360°' },
      { label: 'Höhendifferenz', value: '50 Meter' },
      { label: 'Geländehalter', value: 'Flugschule Hirondelle' },
    ],
    routenplanerUrl: 'https://maps.app.goo.gl/mnKkez6nw1gWdnV36?g_st=aw',
    mainImage: '/images/1-gelaende/nonrod.JPG',
    addressHeading: 'Adresse/ Anfahrt',
    addressText: 'Am Lohberg 3<br />64405 Fischbachtal<br />Ortsteil Nonrod<br /><br />Dort rechts die Schottereinfahrt hoch fahren, GPS: 49°45´18.77´´ N , 8°49´19,52´´O',
    besonderheitenHeading: 'Besonderheiten / Gefahrenquellen',
    besonderheiten: [
      'Die besten Flugbedingungen stellen sich an dem nordwestlich ausgerichteten Hang oft am späten Nachmittag ein. Vom Fischbachtal kommt weht der Wind Richtung Nonroder Höhe und steht dann ideal am Übungshang an.',
      'Kleines Leegebiet hinter dem Wald links vom Landeplatz',
      'Fliegen auf dem Gelände: Mindestens zwei Personen müssen anwesend sein!!!',
    ],
    richtwerteHeading: 'Richtwerte für Flüge mit dem L-Schein',
    richtwerte: ['Windrichtung zwischen 270° bis 360°; Windgeschwindigkeit im Durchschnitt kleiner 10 km/h; Spitzen kleiner 15 km/h.'],
    zumFluggelaendeHeading: 'Zum Fluggelände:',
    zumFluggelaendeText: 'An der Halle vorbei (siehe Googleearthbild) dort hängt der Briefkasten und die Umschläge zum Bezahlen. Bitte nochmals dort die Flugregeln durchlesen. Tagesgebühr von 2,- € für jeden Flieger.',
    parkenWenigHeading: 'Parken bei wenig Flugbetrieb:',
    parkenWenigText: 'Parken unten entlang der Straße „Am Lohberg" könnt ihr die Autos parken oder hinter der Halle (nach Einweisung durch die Eigentümerin). Bitte nicht im Ort parken!',
    parkenVielHeading: 'Parken bei viel Flugbetrieb:',
    parkenVielText: 'Das Material kann am Fluggelände abgeladen werden. Geparkt wird am Rast-und Parkplatz Nonroder Höhe (GPS´49°45´21,15´´8°49´45,15´´) Wegbeschreibung: Zurück zur Ortsdurchfahrtsstraße (Rodensteiner Straße). Dort links und nach ca. 300 Meter wieder links. 150 Meter gerade aus bis zur Haselnussgruppe. Dort links auf dem Schotterweg bis im Wald auf der rechten Seite der Parkplatz kommt. Wenn ihr zurück lauft den gleichen Weg benutzen und nicht über die Felder der Bauen laufen…gab schon Ärger!',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2357.8804577125984!2d8.82110668090161!3d49.75501531322468!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bd60d7f43e4385%3A0x15cabe4b43fddd4!2sAm%20Lohberg%203%2C%2064405%20Fischbachtal!5e1!3m2!1sde!2sde!4v1588790435591!5m2!1sde!2sde',
  },
  stauf: {
    title: 'Stauf',
    eckdatenRows: [
      { label: 'Ausrichtung', value: 'Südost' },
      { label: 'Windspektrum', value: '90° bis 190°' },
      { label: 'Höhendifferenz', value: '70 Meter' },
      { label: 'Geländehalter', value: 'Fliegergemeinschaft Stauf e.V.' },
    ],
    routenplanerUrl: 'https://maps.app.goo.gl/b7Wia7fqkfawjEYe8?g_st=aw',
    mainImage: '/images/1-gelaende/stauf.JPG',
    addressHeading: 'Adresse/ Anfahrt',
    parkplatzHeading: 'Parkplatz:',
    parkplatzText: '67304 Eisenberg, Ortsteil Steinborn (nicht Stauf!), Ramsener Straße<br />Parkplatz am Wendehammer im Feld<br />GPS N 49°33´00.9´´ O 08°01´41.0´´',
    startplatzHeading: 'Adresse Startplatz:',
    startplatzText: '67304 Eisenberg<br />Ortsteil Stauf Talstraße 12<br />GPS N 49°33´00.9´´ O 08°01´41.0´´',
    routeImage: '/images/1-gelaende/stauf.png',
    achtungHtml: '<strong>Achtung:</strong> Sollten wir links in der Rinne schulen, bitte unbedingt die Wege benutzen und nicht quer über die Wiese laufen. Bitte haltet euch daran... es gab schon richtig Ärger deswegen!!!',
    besonderheitenHeading: 'Besonderheiten / Gefahrenquellen:',
    besonderheiten: [
      'Durch die Kuppenlage des Staufer Hügels kommt der Wind oft von der Seite. Haben die Schornsteine in der Rheinebene einen kleinen Westschlag, ist das ein eher schlechtes Zeichen für Stauf da der Wind dann von rechts kommt.',
      'Schnelle Windzunahme bei thermischen Südostwindwetterlagen am mittleren/späten Vormittag',
      'Piloten, die vom Kuppen- Startplatz starten und über die Piloten vom Plateau- Startplatz fliegen',
      'Hecken und Weidezaun und die unten zu überfliegende Straße stellen Hindernisse dar',
      'Sollte jemand über dem Zaun landen bitte durch die Tür mit dem',
      'Zahlenschloss gehen Nr. 1102 und nicht über den Zaun steigen',
    ],
    richtwerteHeading: 'Richtwerte für Flüge mit dem L-Schein:',
    richtwerte: [
      'Für Piloten mit Flugauftrag: Windrichtung zwischen 90° bis 190°; Windgeschwindigkeit im Durchschnitt kleiner 10 km/h; Spitzen kleiner 15 km/h. Ebenso sollten sich die Winddaten mit der Wetterstation der Kalmit decken.',
    ],
    wetterstationenHeading: 'Melibokus / Kalmit Wetterstationen:',
    wetterstationenText: 'Der Melibokus (Tel.: 06352/983612) liegt ca. 60 km in Richtung Nord-Ost und die<br />Kalmit (Tel.: 06322/7909533) ca. 35 km südlich.<br /><br />Die Windwerte der Wetterstationen sollen nur als Anhaltswerte dienen.',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1310.1508451382992!2d8.036379621411072!3d49.546655368246505!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47963ce4f463a439%3A0x2cf394f792cc59dc!2sRamsener%20Str.%2C%2067304%20Ramsen!5e0!3m2!1sde!2sde!4v1588789021619!5m2!1sde!2sde',
  },
  winterkasten: {
    title: 'Winterkasten',
    warningBanner: 'Flugbetrieb nur bei Anwesenheit der Flugschule!',
    eckdatenRows: [
      { label: 'Ausrichtung', value: 'Südost-Süd' },
      { label: 'Windspektrum', value: '120° bis 180°' },
      { label: 'Höhendifferenz', value: '80 Meter' },
      { label: 'Geländehalter', value: 'Flugschule Hirondelle' },
    ],
    routenplanerUrl: 'http://maps.apple.com/?q=%2049.699875,%208.791619',
    addressHeading: 'Adresse/ Anfahrt',
    addressText: '64678 Lindenfels<br />Ortsteil Winterkasten',
    pdfUrl: '/pdf/Gelaendebeschreibung%20Winterkasten.pdf',
    pdfLabel: 'Download Infos & Geländebeschreibung',
    parkplatzHeading: 'Parkplatz:',
    parkplatzText: 'Bismarckturmstraße 7, 64678<br />Lindenfels Ortsteil Winterkasten<br />GPS N 49°41´59,31´´ O 08°47´29,71´´',
    vomParkplatzHeading: 'Vom Parkplatz zum Fluggelände:',
    vomParkplatzText: 'Die Bismarckturmstraße ca. 100 Meter weiter bis zur Hauptstraße laufen. Dort links und nach 50 Meter rechts in den Laudenauer Weg. Nach ca. 100 Meter<br />links den Feldweg zum Startplatz GPS N 49°42´06,07´´ O 08°47´47.18´´laufen.',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d8460.761300862583!2d8.787677443086652!3d49.70014901142218!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bd61cf3112d683%3A0x92442aec10e628fa!2sBismarckturmstra%C3%9Fe%207%2C%2064678%20Lindenfels!5e1!3m2!1sde!2sde!4v1588790846657!5m2!1sde!2sde',
  },
  'bad-kreuznach': {
    title: 'Bad Kreuznach',
    sectionHeading: 'Schleppgelände "Auf dem unteren Mergesfeld"',
    eckdatenRows: [
      { label: 'Standort', value: '55595 St. Katharinen N 49°52´26” O 07°46´19”' },
      { label: 'Ausrichtung', value: 'SO, NW' },
      { label: 'Schlepplänge', value: '1000m' },
    ],
    routenplanerUrl: 'https://maps.app.goo.gl/EDBjt7yqxjycCQ6K7',
    mainImage: '/images/1-Bilderfuernewsletter/winde_.jpg',
    anfahrtHeading: 'Anfahrt:',
    anfahrtText: 'Koordinaten fürs Navi zur groben Anfahrt: 55595 St. Katharinen, Am Roten Berg.',
    parkplatzText: 'Der Parkplatz zur Schleppstrecke befindet sich je nach Windrichtung am jeweiligen Ende der Schleppstrecke.',
    routeImage: '/images/1-gelaende/Winde_BK.jpg',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1114.0837256408527!2d7.7706789!3d49.8734767!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47bdfb851f76b23b%3A0xe949a328638b87aa!2sFluggel%C3%A4nde%20Drachen-%20und%20Gleitsegelclub%20Nahetal!5e1!3m2!1sde!2sde!4v1742289349048!5m2!1sde!2sde',
  },
  herrenteich: {
    title: 'Herrenteich',
    introText: "Der Flugplatz Herrenteich liegt ca. 15 km südlich vom Flugplatz Mannheim-Neuostheim entfernt (am Rheindamm zwischen Ketsch und Speyer).<br />Koordinaten: 49°20´46'' N&nbsp; 08°29´19´´ E.",
    routenplanerUrl: 'https://maps.app.goo.gl/149VWUMKxaXUJCvY8?g_st=aw',
    mainImage: '/images/1-gelaende/winde_herrenteich.jpg',
    navTipHtml: 'Der Flugplatz Herrenteich gehört örtlich zur Gemeinde Hockenheim. Deshalb in den Navigationssystemen zuerst den Ort Hockenheim auswählen und dann als Sonderziel/Straße Herrenteich eingeben',
    directions: [
      { label: 'Beschreibung von Schwetzingen, Ketsch, Plankstadt, Oftersheim und Heidelberg', text: 'In Schwetzingen am Schloßgarten vorbei in Richtung Hockenheim fahren. Kurz nachdem Verlassen des Ortes nach rechts in Richtung Ketsch abbiegen. In Ketsch folgt man der Hauptstraße ganz durch den Ort. Am Ende der Straße biegt man an der Kirche rechts und gleich darauf, ca. 20 Meter später, an der Eisdiele wieder links ab (in Richtung Speyer). Sie befinden sich jetzt am Altrhein. Von hier aus sind es noch ca. 3,5 Kilometer auf dem Rheindamm bis zum Flugplatz Herrenteich, vorbei am Ketscher Frei- und Hallenbad und am Hohwiesensee (kostenloser Badesee).' },
      { label: 'Beschreibung von Hockenheim', text: 'Von Hockenheim in Richtung Talhaus und weiter nach Ketsch. In Ketsch immer der Straße folgen. An der Kirche (auf der rechten Seite) links in Richtung Speyer abbiegen. Von dort sind es dann noch ca. 3,5km auf dem Rheindamm bis zum Flugplatz Herrenteich.' },
      { label: 'Beschreibung von Speyer, Waldsee, Otterstadt und Römerberg', text: 'Von Speyer über die Rheinbrücke (B39) in Richtung Ketsch. Gleich nachdem Überqueren des Rheins an der Ampel rechts in Richtung Altlußheim abbiegen. Nach ca. 500m rechts in Richtung Herrenteich abbiegen. Auf dem Rheindamm entlang zum Flugplatz Herrenteich.' },
      { label: 'Beschreibung von Altlußheim, Neulußheim, Reilingen, Rheinhausen, Waghäusel', text: 'Auf der B39 in Richtung Speyer. Kurz nach Altlußheim links auf den Rheindamm in Richtung Herrenteich abbiegen.' },
      { label: 'Beschreibung von Brühl und Rohrhof', text: 'Von Brühl in Richtung Ketsch. In Ketsch der Straße folgen und nachdem die Straße eine 90°-Kurve nach links gemacht hat, gleich nach rechts in Richtung Speyer abbiegen (auf der linken Seite befindet sich eine Kirche). Auf dem Rheindamm entlang zum Flugplatz Herrenteich.' },
      { label: 'Beschreibung von Mannheim, Rheinau, Neckarau über die B36', text: "Auf der B36 in Richtung Süden kurz nach Rheinau am Wal-Mart/McDonald's rechts in Richtung Ketsch abbiegen. An der Ampel nach dem McDonald's geradeaus in Richtung Ketsch. Die Schnellstraße läuft jetzt parallel an der Autobahn. An der 2. Ausfahrt (Ketsch/Schwetzingen) abfahren und dann rechts nach Ketsch. Der Straße durch Ketsch folgen und am Ende der Straße rechts und gleich wieder links in Richtung Speyer/Altußheim. Auf dem Rheindamm sind es jetzt noch ca. 3,5km bis zum Flugplatz Herrenteich." },
      { label: 'Beschreibung von Autobahn A6', text: 'Autobahn A6 an der Anschlussstelle Mannheim/Schwetzingen (28) in Richtung Mannheim-Rheinau/Brühl verlassen. Auf der Bundesstrasse gleich wieder rechts nach Ketsch/Brühl. An der 2. Ampel links nach Ketsch/Hockenheim. Die Schnellstraße läuft jetzt parallel an der Autobahn. An der 2. Ausfahrt (Ketsch/Schwetzingen) abfahren und dann rechts nach Ketsch. Der Straße durch Ketsch folgen und am Ende der Straße rechts und gleich wieder links in Richtung Speyer/Altußheim. Auf dem Rheindamm sind es jetzt noch ca. 3,5km bis zum Flugplatz Herrenteich.' },
      { label: 'Beschreibung von Autobahn A61', text: 'Die Autobahn A61 an der Anschlussstelle Hockenheim (64) verlassen und in Richtung Speyer fahren. An der kommenden Ampel nach links in Richtung Altlußheim abbiegen und darauf gleich wieder rechts in Richtung Herrenteich. Auf dem Rheindamm weiter zum Flugplatz Herrenteich.' },
    ],
    rulesHeading: 'Regelung des Flugbetriebes der Gleitschirmflieger auf dem Flugplatz',
    rules: [
      'Die Sonderregelungen für Gleitsegelschleppbetrieb auf Flugplätzen sind zu beachten. (B-Schein Theorie; gültiger Schleppschein)',
      'Den diensthabenden Flug- und Startleitern ist Folge zu leisten. Der Platzflugbetrieb darf nicht behindert oder gefährdet werden. Achtung auf anfliegende Flugzeuge! Die aktuellen Flugbetriebsbedingungen sind beim Flugleiter zu erfragen.',
      'Die Starts von Flugzeugen und GS finden nach Absprache statt.',
      'Eine Freigabe muß vor jedem Schleppvorgang beim diensthabenden Flugleiter eingeholt werden.',
    ],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2599.1430771527293!2d8.487383951816065!3d49.3494404738568!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4797b7ad0395ad27%3A0x734a880cb7968ffa!2sFlugplatz%20Herrenteich!5e0!3m2!1sde!2sde!4v1588788513704!5m2!1sde!2sde',
  },
  ausbildungskonzept: {
    heading: 'Ausbildungskonzept',
    subheading: 'Ausbildung mit der Flugschule Hirondelle',
    paragraph1: 'Die Flugschule Hirondelle bietet euch eine qualifizierte, sichere und vielseitige Ausbildung. Wir begleiten euch von den ersten Hüpfern bis zu euren ersten Strecken- und Thermikflügen hier im Odenwald, in der Pfalz, im Kraichtal, im Nahetal und überall sonst auf der Welt.',
    paragraph2: 'Fliegen lernen mit dem Team Hirondelle heißt persönliche und individuelle auf den Schüler zugeschnittene Ausbildung! Das zeichnet uns aus:',
    bulletPoints: [
      'Unser Team besteht aus sehr erfahrenen und ambitionierten Fluglehrern',
      'Bei uns steht der Spaß und die Sicherheit am Fliegen im Vordergrund',
      'Geniale Schulungshänge im Raum Odenwald, Kraichtal, Nahetal und in der Pfalz (5 eigene auf die Flugschule zugelassene Schulungshänge)',
      'Schulung bei jeder Windrichtung möglich',
    ],
    pathsHtml: 'Im Nachfolgenden sind die Ausbildungswege in der Flugschule Hirondelle vom <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> über die <a href="/ausbildung/a-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Höhenflugschulung</a> bis zum <a href="/ausbildung/b-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">unbeschränkten Luftfahrerschein</a> aufgelistet.',
    graphicImage: '/images/inhalte/ausbildungswege.png',
    graphicCaption: 'hm = ca. Höhenmeter-Differenz zwischen Start- und Landeplatz',
    tableRows: [
      { name: 'Schnupper-/Einsteigerkurs', duration: '1 – 2 Tage', content: 'Ausrüstung kennen lernen, theoretische Grundlagen, die ersten kleinen Flüge', goal: 'spielerisches Kennenlernen des Sports, selbständiges Groundhandling', bgColor: '#80c533', link: '/ausbildung/schnupperkurs' },
      { name: 'L-Schein', duration: '3 – 4 Tage\nGrundkurs', content: 'Inhalte Schnupperkurs, Grundlagen in Flugtechnik, 15 Flüge für den L-Schein, Lerninhalte Grundkurs', goal: 'L-Schein, selbständiges Groundhandling, eigenständiges Fliegen in den eingewiesenen Geländen', bgColor: '#34963b' },
      { name: 'Windenschein', duration: '3 – 4 Tage', content: '20 Flüge an der Winde, Lerninhalte Windenschlepp, Flugschulinterne Theorie- und Praxisprüfung für den Windenschlepp', goal: 'Windenschleppberechtigung, selbständiges Fliegen an der Winde', bgColor: '#fff600', link: '/ausbildung/windenschein' },
      { name: 'A-Schein', duration: 'Höhenflugschulung', content: '40 Höhenflüge (20 davon können an der Winde absolviert werden) sowie 18.000 Höhenmeter, Lerninhalte A-Schein, Theorie-/Praxisprüfung zum beschränkten Luftfahrerschein vor einem Prüfer des DHV', goal: 'beschränkter Luftfahrerschein (A-Schein), selbständiges Fliegen in fast allen Geländen weltweit, innerhalb des Gleitwinkelbereiches vom Startplatz', bgColor: '#ffd700', link: '/ausbildung/a-schein' },
      { name: 'B-Schein', duration: 'Integriert in eine Flugreise oder Fortbildung', content: '20 Höhenflüge, Lerninhalte für den unbeschränkten Luftfahrerschein Theorieprüfung zum unbeschränkten Luftfahrerschein vor einem Prüfer des DHV', goal: 'Unbeschränkter Luftfahrerschein (B-Schein), selbständiges Fliegen in allen Fluggeländen Europas, Streckenflugberechtigung', bgColor: '#e58e26', link: '/ausbildung/b-schein' },
      { name: 'Tandemschein', duration: '', content: '40 Höhenflüge mit einem Passagier, Lerninhalte Passagierflug, Theorie-/Praxisprüfung zur Passagierflugberechtigung vor einem Prüfer des DHV', goal: 'Passagierflugberechtigung, selbständiges Passagierfliegen', bgColor: '#c4c5ca', link: '/ausbildung/tandemschein' },
    ],
  },
  faq: {
    heading: 'Häufig gestellte Fragen',
    items: [
      {
        question: 'Wann bzw. wie fange ich Gleitschirmfliegen an?',
        answerHtml: 'Die Ausbildung beginnt mit dem <a href="/ausbildung/l-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Grundkurs</a> oder optional davor mit einem <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a>. Danach folgt die Höhenflugschulung mit abschließender Prüfung zum <a href="/ausbildung/a-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">A-Schein</a>, mit dem du dann selbständig fliegen darfst. Gerne beraten wir dich zum Ausbildungsverlauf in unserer <a href="/infos#kontakt" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Flugschule</a> oder auch per Telefon, den Kurs buchen kannst du dann direkt online.',
      },
      {
        question: 'Wie alt muss man mindestens sein, um an einem Kurs teilnehmen zu können?',
        answerHtml: 'Das Mindestalter für die Teilnahme an Kursen liegt bei 14 Jahren, wobei bei Teilnahme Minderjähriger eine schriftliche Einverständniserklärung beider Erziehungsberechtigten erforderlich ist. Nach oben hin gibt es keine Altersgrenze! Noch unsicher? Unser <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> bietet dir die Möglichkeit, Gleitschirmfliegen unverbindlich zu testen.',
      },
      {
        question: 'Wo finden die Kurse statt?',
        answerHtml: 'Alle unsere Fluggelände findet ihr <a href="/infos/gelaende" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">hier</a>.',
      },
      {
        question: 'Wie lange dauert ein Schnupperkurs?',
        answerHtml: 'Der <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> findet in der Regel am Wochenende (Samstag & Sonntag) statt. Wir beginnen meist früh um 8.00 Uhr und schulen bis Nachmittags (15.00 bis 17.00 Uhr) – solange es das Wetter zulässt.',
      },
      {
        question: 'Was muss ich zum Schnupperkurs mitbringen?',
        answerHtml: 'Wichtigste Voraussetzung für den <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> sind <strong>feste, überknöchelhohe (Wander-)Schuhe</strong>, lange Hosen, Sonnencreme, Getränke/Verpflegung und jede Menge gute Laune.',
      },
      {
        question: 'Welche Ausrüstung benötige ich für die Kurse?',
        answerHtml: 'Zum Gleitschirmfliegen benötigst du zunächst nur feste, überknöchelhohe (Wander-)Schuhe sowie normale (Outdoor-)Kleidung. Alles weitere wie Gleitschirm, Gurtzeug etc. wird beim <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> und <a href="/ausbildung/l-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Grundkurs</a> von uns gestellt. Danach fliegt ihr mit eigener Ausrüstung oder alternativ mit Leihausrüstung, hier beraten wir euch gerne bei uns in der <a href="/infos#kontakt" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Flugschule</a>.',
      },
      {
        question: 'Was kann ich nach Abschluss des Grundkurses im Gleitschirmfliegen?',
        answerHtml: 'Der <a href="/ausbildung/l-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Grundkurs</a> bildet die Basis für die Teilnahme an der Höhenflugschulung (<a href="/ausbildung/a-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">A-Schein</a>). Hauptlernziele sind Starten, Steuern, Landen.',
      },
      {
        question: 'Wie lange dauert der A-Schein (Höhenflugschulung)?',
        answerHtml: 'Da wir abhängig vom Wetter sind, kann man schwer sagen, wie lange es genau dauert. Geht man davon aus, jeden Tag passendes Wetter und Zeit zu haben, kann man für die <a href="/ausbildung/a-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">A-Schein-Ausbildung</a> ca. 1 bis 3 Wochen einplanen. Kann aber auch länger dauern.',
      },
      {
        question: 'Ich bin Pilot/in, aber schon längere Zeit nicht mehr geflogen und möchte wieder anfangen.',
        answerHtml: 'Für alle, die längere Zeit nicht geflogen sind, bieten wir <a href="/performance/refresher" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Refresher-Kurse</a> an. So gelingt ein sicherer und erfolgreicher Wiedereinstieg mit Fluglehrerbetreuung.',
      },
    ],
    contactHeading: 'Noch Fragen?!',
    contactImage: '/images/inhalte/fragen_4.jpg',
    contactText: 'Wir vom Team Hirondelle stehen euch für alle eure Anliegen gerne zur Verfügung! Sprecht uns an oder besucht uns in der Flugschule!',
    openingHoursLabel: 'Öffnungszeiten',
    openingHoursText: 'nach Vereinbarung\n(Wird per Newsletter bekannt gegeben)',
    addressLines: 'Flugschule Hirondelle\nUntergasse 27\n69469 Weinheim / Germany',
    contactEmail: 'info@fs-hirondelle.de',
  },
  tandem: {
    heading: 'EIN TANDEMFLUG MIT DEM GLEITSCHIRM?',
    videoUrl: 'https://www.youtube-nocookie.com/embed/o1MzMmYM_ls?rel=0',
    quote: 'Der erste Schritt, um sicher in die Luft zu kommen!',
    introHtml:
      '<p>Ein ganz besonderes Erlebnis erwartet euch bei einem Tandemflug mit einem unserer Piloten hier in der Region Rhein/Main/Neckar, Odenwald oder Pfalz.</p>' +
      '<p>Da wir fürs Tandemfliegen spezielle Wind- und Wetterbedingungen brauchen und nur ganz bestimmte Gelände hier in der Region dafür nutzen können, kann es schon mal sein, dass man etwas auf einen passenden Termin warten muss. Aber es lohnt sich - versprochen :-)</p>' +
      '<p>Wir fliegen im Moment mainly in Heidelberg, Schriesheim und in Erlau (Odenwald). Ab und zu auch in der Pfalz bei Annweiler, an der Madenburg oder auch an der Winde bei Speyer bzw. in Offenbach bei Landau.</p>' +
      '<p>Je nach Wetterbedingungen und welcher unserer Piloten gerade Zeit hat, wählen wir den Flugort aus - das ist leider nicht wählbar. Die Termine sind ganzwöchig von Montag bis Sonntag und auch ganzjährig, also nicht nur im Sommer. Im Winter sind auch ab und an schöne Flüge möglich. Einziges Manko - man muss sich etwas dicker anziehen...</p>' +
      '<p>Da wir mit der Flugschule sehr oft im Ausland unterwegs sind und die Tandemflüge oft von unterwegs abwickeln, haben wir ein spezielles System für die Abwicklung der Termine.</p>',
    priceLabel: 'Tandemflug',
    priceNote: 'Barzahlung vor Ort',
    price: '150,- €',
    warningText: 'Wir verkaufen keine Gutscheine für Tandemflüge - es können nur bereits erworbene Gutscheine eingelöst werden. Wer ohne Gutschein mitfliegen will, einfach unten in den Tandemnewsletter eintragen und dann beim Termin bar zahlen.',
    terminHeading: "TERMIN VEREINBAREN - SO FUNKTIONIERT'S...",
    terminHtml:
      '<p>Gleitschirmfliegen ist wetterabhängig. Wir brauchen Wind in richtiger Stärke und aus der geeigneten Richtung. Weil es selbst den besten Wetterfröschen kaum möglich ist, das Wetter auf längere Sicht abzuschätzen, bieten wir euch ein eigenes System zur Terminvereinbarung an, um die vereinbarten Tandemflüge sicher durchzuführen.</p>' +
      '<p>Wir haben daher zur Terminvereinbarung einen Tandem-Newsletter auf unserer Homepage unten eingerichtet. In diesen Tandemnewsletter (wichtig - nicht in den allgemeinen Newsletter eintragen!!!) tragt ihr euch ein.</p>' +
      '<p>Wenn wir passendes Wetter (nur Sonne reicht nicht) zum Tandemfliegen sehen und auch Zeit haben, die Flüge durchzuführen, schicken wir eine E-Mail an alle, die sich im Tandemnewsletter angemeldet haben. An so einem Termin bieten wir in der Regel zwischen 3-5 Flüge pro Tag an. Wenn ihr zu diesem Termin Lust und Zeit habt, meldet ihr euch schnellstmöglich mit den in unserer Mail gefragten Details zurück und bekommt dann von uns nochmal Rückantwort via E-Mail mit dem genauen Treffpunkt und der Uhrzeit. Ganz wichtig: es bekommen nur die Schnellsten eine Rückantwort die auch den Zuschlag für den Flug bekommen.</p>' +
      '<p>Falls ihr jemanden mit einem Tandemflug beschenken wollt, könnt ihr gerne selbst einen Gutschein basteln und diesen verschenken. Bezahlt wird allerdings bar vor Ort beim Tandempiloten. Wir haben in der Vergangenheit oft Gutscheine ausgestellt, die die Beschenkten dann mitunter nicht einlösen konnten, da deren Freizeit nicht zu unseren Terminen gepasst haben.</p>' +
      '<p>Wir haben über die Jahre schon viel ausprobiert wie wir die Abwicklung organisieren können und dies ist der beste und einzige Weg. Da es für uns nur wie oben beschrieben funktioniert, vereinbaren wir auch keine Wunschtermine und vergeben auch auf telefonische Nachfrage keine Tandemtermine.</p>' +
      '<p>Falls jemand noch schneller in die Luft möchte können wir euch alternativ unseren <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-semibold">Schnupperkurs</a> wärmstens empfehlen.</p>',
    pilots: [
      { name: 'Alex', img: '/images/team/schlink.jpg' },
      { name: 'Markus', img: '/images/team/markus.jpg' },
      { name: 'Karl-Peter', img: '/images/team/karlpeter.jpg' },
      { name: 'Tobi', img: '/images/team/tobi.jpg' },
    ],
    services: [
      'Tandemflug hier in der Region (kurze Anfahrtswege)',
      'Erfahrene Tandempiloten',
      'Aktuelle Tandemausrüstung',
    ],
    requirements: [
      'Passagiere ab 50 kg bis 100 kg',
      'Keine Altersbeschränkung aber gut zu Fuß - man muss 10-20 m rennen können ;-)!',
    ],
  },
};

// `id` isn't limited to the 6 known DEFAULTS keys here: a FixedPageDuplicate
// (fixedPageDuplicates.routes.ts) stores its copied data as a normal row in
// this same table, keyed by its own slug, so a genuinely new id is
// legitimate as long as a row actually exists for it - DEFAULTS is only
// ever a fallback for the original 6, never a valid answer for an id it
// doesn't recognize.
router.get('/public/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const row = await prisma.sitePageContent.findUnique({ where: { id } });
    if (row) return res.json(row.data);
    if (DEFAULTS[id]) return res.json(DEFAULTS[id]);
    res.status(404).json({ error: 'Unknown page' });
  } catch (error) {
    console.error('Error fetching public site page content:', error);
    res.status(500).json({ error: 'Failed to fetch page content' });
  }
});

// `id` here isn't limited to the 5 known kinds either (see the `/public/:id`
// comment above) - a FixedPageDuplicate's own admin editor GETs/PUTs its
// content by its own slug, which only ever exists as a real row, never a
// DEFAULTS fallback.
router.get('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    let row = await prisma.sitePageContent.findUnique({ where: { id } });
    if (!row && DEFAULTS[id]) {
      row = await prisma.sitePageContent.create({ data: { id, data: DEFAULTS[id] } });
    }
    if (!row) return res.status(404).json({ error: 'Unknown page' });
    res.json(row);
  } catch (error) {
    console.error('Error fetching site page content:', error);
    res.status(500).json({ error: 'Failed to fetch page content' });
  }
});

router.put('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.sitePageContent.findUnique({ where: { id } });
    if (!existing && !DEFAULTS[id]) return res.status(404).json({ error: 'Unknown page' });
    const data = req.body.data !== undefined ? req.body.data : req.body;
    const row = await prisma.sitePageContent.upsert({
      where: { id },
      update: { data },
      create: { id, data },
    });
    res.json(row);
  } catch (error) {
    console.error('Error updating site page content:', error);
    res.status(500).json({ error: 'Failed to update page content' });
  }
});

// "Delete" for this content can't remove the page's own route (e.g.
// /ausbildung always exists in App.tsx) - this is a WordPress-style trash
// instead: snapshot the current row into ContentTrash (see trash.routes.ts,
// Admin > Papierkorb, for restore) then drop it, so the public/admin GETs
// above fall back to DEFAULTS[id] until it's restored.
const PAGE_LABELS: Record<string, string> = {
  ausbildung: 'Ausbildung',
  performance: 'Performance',
  reisen: 'Reisen',
  service: 'Service',
  infos: 'Infos / Kontakt',
  team: 'Team',
  wetter: 'Wetter',
  medien: 'Medien',
  gruppenevents: 'Gruppenevents',
  gutscheine: 'Gutscheine',
  versicherungen: 'Versicherungen',
  gelaende: 'Fluggelände',
  schnupperkurs: 'Schnupperkurs',
  ausbildungskonzept: 'Ausbildungskonzept',
  'l-schein': 'L-Schein',
  rettungsgeraetetraining: 'Rettungsgerätetraining',
  groundhandling: 'Groundhandling',
  'b-schein': 'B-Schein',
  'a-schein': 'A-Schein',
  tandemschein: 'Tandemschein',
  windenschein: 'Windenschein',
  sicherheitstraining: 'Sicherheitstraining',
  'brasilien-tour': 'Brasilien-Tour',
  'kolumbien-tour': 'Kolumbien-Tour',
  'suedafrika-tour': 'Südafrika-Tour',
  'bassano-tour': 'Bassano-Tour',
  'griechenland-tour': 'Griechenland-Tour',
  'slowenien-tour': 'Slowenien-Tour',
  'bergamo-tour': 'Bergamo-Tour',
  'savoye-tour': 'Savoyer Alpentour',
  'vogesen-tour': 'Vogesen-Tour',
  'pfalz-tour': 'Pfalz-Tour',
  '2-jahres-check': '2-Jahres-Check',
  rettungspacken: 'Rettungsgeräte-Packservice',
  trimmtuning: 'Trimmtuning',
  reparatur: 'Reparatur-Service',
  billings: 'Billings',
  erlau: 'Erlau',
  gadern: 'Gadern',
  lindenfels: 'Lindenfels',
  'nonrod-nordost': 'Nonrod Nordost',
  nonrod: 'Nonroder Höhe',
  stauf: 'Stauf',
  winterkasten: 'Winterkasten',
  'bad-kreuznach': 'Bad Kreuznach',
  herrenteich: 'Herrenteich',
  tandem: 'Tandem',
};

router.delete('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!DEFAULTS[id]) return res.status(404).json({ error: 'Unknown page' });
    const row = await prisma.sitePageContent.findUnique({ where: { id } });
    if (row) {
      await prisma.contentTrash.create({ data: { kind: 'sitepagecontent', refId: id, title: PAGE_LABELS[id] || id, data: { data: row.data } } });
    }
    await prisma.sitePageContent.deleteMany({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error resetting site page content:', error);
    res.status(500).json({ error: 'Failed to reset page content' });
  }
});

export default router;
