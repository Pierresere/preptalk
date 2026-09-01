# Marché et modèle économique

> Étude réalisée le 2026-08-31. Les prix et acteurs cités sont ceux relevés à cette date.
> Document en français : il porte sur le marché québécois et français et cite des sources francophones.

## Résumé

Le marché de la simulation d'entretien par IA est saturé en France et les prix y sont écrasés.
Il est en revanche quasi vide au Québec. PrepTalk ne doit pas se vendre comme « un simulateur
d'entretien » mais comme **le dossier de candidature complet et vérifié** : recherche entreprise,
analyse des écarts CV/offre, CV ciblé, entretien simulé, débrief.

## Concurrence

### France — marché encombré

| Acteur | Positionnement | Prix relevé |
|---|---|---|
| [Huru.ai](https://huru.ai/fr/) | Simulations vidéo, analyse du langage corporel, 50 000+ questions. Acteur international disponible en français. | 24,99 $/mois ou 99 $/an ([source](https://www.theofferinbox.com/huru-ai-review/)) |
| [LaunchMe](https://www.launchme.fr/simulation-entretien) | Recherche d'emploi complète : CV ATS, lettres, suivi de candidatures, simulation. | 3,99 €/mois (~6 simulations) à 7,99 €/mois ; packs de crédits dès 1,99 € ([tarifs](https://www.launchme.fr/tarifs)) |
| [RecrutLabs](https://www.recrutlabs.fr/) | 10 000+ questions, coaching personnalisé. | Packs de crédits sans abonnement ([pricing](https://www.recrutlabs.fr/pricing)) |
| [RecrutIA 2.0](https://www.learningtechnologiesfrance.com/news/recrutia-des-simulations-d-entretien-d-embauche-bluffantes-de-r-alisme-gr-ce-l-ia-) | Simulation vocale à partir du CV + offre. **Vendu aux organismes de formation**, pas au grand public. | n/d |

Également présents : [Persuasiv AI](https://persuasiv.ai/en), [Final Round AI](https://www.finalroundai.com/fr/ai-mock-interview),
[OphyAI](https://ophyai.com/fr/interview-coach), [Epimoni](https://www.epimoni30.com/en/interview-simulator),
Google Interview Warmup. Plus de 50 % des candidats déclarent déjà utiliser l'IA pour se préparer
([Jenova](https://www.jenova.ai/fr/resources/ai-mock-interviewer-202605)).

### Québec — quasi-désert

Aucun acteur québécois grand public établi. Seul signal local : [Horizon TNL](https://ici.radio-canada.ca/nouvelle/2207360/horizon-tnl-intelligence-artificille-embauche),
un réseau de développement économique qui a développé son propre simulateur — le besoin
institutionnel est prouvé, l'offre commerciale absente. Les outils français et américains couvrent
mal les codes québécois (vocabulaire « entrevue », marché PME, références locales).

### Côté RH — moins saturé en PME

| Acteur | Positionnement | Prix |
|---|---|---|
| [Flatchr](https://culture-rh.com/logiciel-rh/logiciel-recrutement/) | ATS de référence pour PME françaises, matching IA. | 49 €/mois (1 utilisateur) à 149 €/mois |
| [SIGMA-RH](https://www.sigma-rh.com/fr-ca/suite-talents/recrutement/) | Suite RH complète, présente au Québec. | n/d (suite lourde) |
| [Qualivio](https://qualivio.fr/logiciel-tri-cv), [CV Ranker](https://cv-scanner.com/tri-cv-ia) | Tri de CV automatisé. | n/d |

Le combo **rédaction d'offre (à partir de la recherche entreprise) + screening multi-CV**, léger et
bilingue FR/QC, n'est couvert par aucun de ces acteurs.

## Positionnement retenu

1. **Ne pas se battre sur la simulation seule** — commoditisée, prix cassés.
2. **Différenciateur réel** : la recherche entreprise en 9 sections, qu'aucun concurrent ne fait en
   profondeur, combinée à l'analyse des écarts CV/offre. C'est ce qui rend ChatGPT-nu insuffisant
   comme substitut.
3. **Le parcours guidé est le moat** : checklist, plan, coaching, débrief. Le soin apporté à l'UX
   n'est pas cosmétique.
4. **Marché prioritaire : le Québec**, puis la France en second temps.
5. **La conformité est un argument de vente** (voir [conformite-loi-25.md](./conformite-loi-25.md)) :
   « données traitées au Canada, jamais transmises sous ton nom » — aucun concurrent français ou
   américain ne peut l'annoncer.

## Modèle économique

Pas d'abonnement en B2C : la préparation d'entretien est un produit « moment de vie », le churn y
est structurellement élevé. Le modèle par crédits est validé par le marché (LaunchMe, RecrutLabs).

| Offre | Prix | Coût unitaire | Rôle |
|---|---|---|---|
| Note de CV | Gratuit | — | Acquisition : score + 3 conseils, sans carte bancaire |
| 1 projet complet | 2,99 $ | 2,99 $ | Essai pour une candidature réelle |
| 5 projets | 9,99 $ | 2,00 $ | Offre « recherche active » (−33 %) |

Notes de conception :

- **Crédits sans expiration**, comme LaunchMe — cohérent avec le positionnement rassurant.
- **La remise du pack doit rester à 25-35 %** pour déclencher l'achat. Une remise de 13 %
  (12,99 $ les 5) ne fait basculer personne.
- **Frais Stripe** : ~0,35 $ par transaction, soit plus de 10 % sur une vente à 2,99 $. C'est
  l'argument principal en faveur du pack.
- **Coût LLM par projet** : estimé entre 0,50 $ et 2,00 $ selon le modèle (recherche 9 sections +
  analyse + plan + entretien + débrief). **À mesurer précisément avant de figer les prix** —
  instrumenter le serveur pour compter les jetons.
- **Servir le gratuit et l'unité avec un modèle économique**, réserver le modèle premium aux packs,
  pour protéger la marge.

## Feuille de route produit

1. Refonte grand public + thème Jade — *fait*.
2. Pseudonymisation avant appel LLM — structurant, à faire tôt.
3. Provider Vertex AI (Montréal) — indépendant du choix final de région.
4. CV ciblé + note de CV — justifie le prix et alimente l'offre gratuite.
5. SaaS : comptes, Stripe, quotas.
6. Mode RH (rédaction d'offre + screening multi-CV) — revenu récurrent, 49-99 $/mois par siège.

### Sur le « CV ciblé » (point 4)

Le marché du CV builder est saturé (Canva, Zety, resume.io, CVDesignR), mais l'angle est différent :
PrepTalk connaît **l'offre visée**, ce que les CV builders ignorent. Le livrable est un CV *réécrit
pour cette candidature*, pas un CV générique.

Approche retenue, inspirée des *proof gates* de `E:\Brain builder` — **sans** le collectif d'IA,
surdimensionné et coûteux pour un texte d'une page :

1. **Génération** : un modèle rédige le CV ciblé (CV original + offre + analyse en contexte).
2. **Gate déterministe** (script, pas de LLM) : mots-clés de l'offre présents, dates cohérentes avec
   l'original, **aucun fait absent du CV source** (anti-invention), structure ATS une colonne.
3. **Une passe de critique** : le modèle en persona « recruteur pressé » renvoie 3 corrections, on
   régénère une fois.

Mise en forme : 2-3 gabarits HTML dans le style Jade, export PDF via l'impression navigateur, plus
un gabarit « ATS strict ». L'emballage n'est pas la valeur — le contenu ciblé et vérifié l'est.

## Publication

Hébergement simple (Vercel/Railway ou Firebase), Stripe Checkout (aucune donnée de carte chez nous),
budget initial ~20-50 $/mois.

## Sources

- [Huru.ai](https://huru.ai/fr/) · [revue de prix](https://www.theofferinbox.com/huru-ai-review/)
- [LaunchMe](https://www.launchme.fr/tarifs) · [RecrutLabs](https://www.recrutlabs.fr/pricing)
- [RecrutIA 2.0](https://www.learningtechnologiesfrance.com/news/recrutia-des-simulations-d-entretien-d-embauche-bluffantes-de-r-alisme-gr-ce-l-ia-)
- [Radio-Canada — Horizon TNL](https://ici.radio-canada.ca/nouvelle/2207360/horizon-tnl-intelligence-artificille-embauche)
- [Culture RH — comparatif logiciels de recrutement](https://culture-rh.com/logiciel-rh/logiciel-recrutement/)
- [Jenova — simulateurs d'entretien IA](https://www.jenova.ai/fr/resources/ai-mock-interviewer-202605)
