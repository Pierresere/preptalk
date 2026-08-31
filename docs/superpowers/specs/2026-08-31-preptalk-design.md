# PrepTalk — Design

**Date** : 2026-08-31
**Statut** : approuvé (brainstorming), en attente du plan d'implémentation
**Origine** : le mode « Entrevue » de l'application privée *Astérion — Cerveau*
(`E:\Candidatures\Ben-Mor-git`), câblé sur une seule candidature. PrepTalk en extrait
le moteur et le rend paramétrable pour n'importe quelle entrevue.

## 1. But

Un projet open source qui prépare un candidat à une entrevue d'embauche donnée :

1. il importe **l'offre d'emploi**, **le CV** (ou une liste de compétences) et des
   **documents divers** ;
2. il **recherche l'entreprise** sur le web, rubrique par rubrique (secteur, produits,
   chiffre d'affaires, effectif, sites, certifications, actualités, culture, concurrents) ;
3. il **compare l'offre au CV** — chaque responsabilité de l'offre est notée
   couvert / partiel / manque ;
4. il produit une **trame d'entrevue** et un **persona de recruteur** adaptés au poste ;
5. il **simule l'entrevue** : une question par tour, relance, coaching conditionnel
   quand le candidat bute, debrief final.

Public : candidats qui préparent sérieusement une entrevue ; développeurs qui veulent
forker. Modèle « bring your own key » : chacun met ses clés API.

## 2. Décisions prises

| Sujet | Décision | Raison |
|---|---|---|
| Entrées | Offre + CV/compétences + entreprise (nom, sites) + documents divers | Demande de l'utilisateur |
| IA | Multi-fournisseurs dès la V1 : OpenAI, Anthropic, Gemini | Plusieurs clés déjà configurées ; attractif pour l'open source |
| Exécution | Serveur Node local + UI navigateur | Stockage sur disque exigé ; les API OpenAI/Anthropic refusent les appels navigateur (CORS) |
| Stockage | Un dossier par candidature, Markdown + JSON | Lisible, éditable, versionnable |
| Recherche web | Outil natif du fournisseur choisi (grounding Gemini, web search OpenAI/Anthropic) | Aucune clé supplémentaire |
| Trame | Squelette universel de 7 phases, spécialisé par l'IA, éditable | Robuste, prévisible, jamais de dérive |
| Ciblage des sources | Lexical (repris de `selectNotes`) | Déterministe, sans clé, éprouvé |
| Langue | UI FR + EN (i18n), code et commentaires en anglais | Public international |
| Découpage | V1 minimale, puis V2 | Premier résultat utilisable vite |

## 3. Architecture

Monorepo npm workspaces :

```
App interview/
  package.json            workspaces: server, web ; scripts start / dev / test / typecheck
  server/                 Node 22 + Hono + TypeScript strict
  web/                    React 18 + Vite + TypeScript strict
  data/                   dossiers de candidature — gitignoré
  docs/superpowers/       specs et plans
  README.md, LICENSE (MIT), CONTRIBUTING.md
```

- `npm start` : build de `web/`, puis le serveur sert `web/dist` et l'API sur
  `http://localhost:4820`.
- `npm run dev` : serveur en watch + Vite avec proxy `/api` → `4820`.
- Clés dans `server/.env` : `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
  chacune optionnelle. `DATA_DIR` (défaut `../data`). Un `.env.example` est versionné.
- L'UI interroge `/api/providers` et n'affiche que les fournisseurs dont la clé est présente.

## 4. Données — un dossier par candidature

```
data/<slug>/
  dossier.json     { id, company, position, sites[], language, provider, model,
                     createdAt, updatedAt }
  offer.md         l'offre d'emploi telle que collée
  resume.md        le CV ou la liste de compétences / expériences
  company.md       la fiche entreprise produite par la recherche (voir §5.2)
  documents/       fichiers déposés (.md, .txt) — PDF en V2
  analysis.json    l'analyse offre vs CV (voir §5.3)
  plan.json        la trame spécialisée + le persona (voir §5.4)
  sessions/
    <timestamp>.json   une simulation : messages, tour, debrief, fournisseur utilisé
```

Le slug est dérivé du nom de l'entreprise ; unicité garantie par suffixe numérique.
Tous les fichiers sont lisibles et éditables à la main ; le serveur les relit à chaque
requête (pas de cache en V1).

## 5. Pipeline côté serveur

### 5.1 Import
`POST /api/dossiers` crée le dossier avec `dossier.json`, `offer.md`, `resume.md`.
`PUT /api/dossiers/:id/offer|resume` réécrit le fichier. `POST /api/dossiers/:id/documents`
dépose un fichier texte/markdown.

### 5.2 Recherche entreprise
Rubriques fixes, dans cet ordre : `sector`, `products`, `revenue`, `headcount`, `sites`,
`certifications`, `news`, `culture`, `competitors`.

Pour chaque rubrique, un appel `provider.search(query)` avec une requête construite depuis le
nom, les sites et le secteur déjà trouvé. Le résultat est un bloc Markdown :

```markdown
## Produits et services
<texte, 5 à 15 lignes>

Sources :
- <url>
- <url>
```

`company.md` est réécrit rubrique par rubrique ; `POST /api/dossiers/:id/company/:section`
relance une seule rubrique. Une rubrique sans résultat fiable contient
« Non trouvé — à vérifier » plutôt qu'une invention : la règle d'honnêteté de Cerveau est
reprise (ne rien inventer de factuel, pas de chiffre sans source).

### 5.3 Analyse offre vs CV
`POST /api/dossiers/:id/analysis` : un appel structuré (JSON) qui extrait les responsabilités
et exigences de l'offre, puis note chacune contre le CV.

```ts
interface Requirement {
  readonly index: number
  readonly text: string           // mot pour mot depuis l'offre
  readonly keywords: readonly string[]
  readonly status: 'covered' | 'partial' | 'missing'
  readonly evidence: string       // ce qui, dans le CV, répond — ou ce qui manque
}
```

Validé par schéma (zod). Généralise `affichage-poste.ts` de Cerveau.

### 5.4 Trame et persona
Squelette universel, fixe dans le code :

| # | id | Titre | Questions | Alimenté par |
|---|---|---|---|---|
| 1 | `welcome` | Accueil et parcours | 2 | CV |
| 2 | `core` | Cœur du poste | 3 | responsabilités 1 à 3 de l'offre |
| 3 | `domain` | Domaine / produit | 3 | fiche entreprise : produits, secteur |
| 4 | `situations` | Mises en situation | 3 | offre + secteur |
| 5 | `behavior` | Comportemental | 2 | CV : transitions, échecs |
| 6 | `sensitive` | Sujets sensibles | 2 | analyse : exigences `partial` / `missing` |
| 7 | `questions` | Vos questions | 1 | fiche entreprise |

Phase optionnelle `language-switch` (1 question), insérée avant `questions` si l'offre exige
une seconde langue.

`POST /api/dossiers/:id/plan` : un appel structuré qui, pour chaque phase, remplit
`objective`, `targeting` (mots de ciblage) et `examples` (3 à 4 questions de référence), et
produit le persona :

```ts
interface Persona {
  readonly name: string      // fictif si inconnu
  readonly role: string      // déduit de l'offre : « directrice des achats », « lead dev »…
  readonly concerns: string  // ce qui touche ce recruteur au quotidien
  readonly tone: string
}
interface Phase {
  readonly id: string
  readonly title: string
  readonly questions: number
  readonly objective: string
  readonly targeting: readonly string[]
  readonly examples: readonly string[]
}
interface Plan { readonly persona: Persona; readonly phases: readonly Phase[] }
```

`plan.json` est validé par schéma et éditable dans l'UI (titres, nombre de questions,
objectifs, exemples, persona) avant toute simulation.

### 5.5 Simulation
Le moteur de `entrevue.ts` de Cerveau, rendu générique :

- **Tour** = nombre de réponses du recruteur dans l'historique + 1 ; le tour détermine la
  phase (`phaseForTurn`), une phase close ne revient jamais (`closedPhases`).
- **Ciblage** : la question du candidat + `targeting` de la phase, score lexical sur les
  chunks (offre, CV, chaque rubrique de la fiche, chaque document, chaque exigence de
  l'analyse) ; les 6 meilleurs sont injectés.
- **Instruction système** assemblée à partir de : persona, règles de conduite (une question
  par tour, réagir avant de poser, relancer plutôt que changer de sujet, écrire comme on
  parle), filet de coaching conditionnel (« Hors rôle — ce que j'aurais aimé entendre »,
  seulement si réponse vague / trop courte / erronée), règles d'honnêteté (aucun fait inventé
  sur l'entreprise, aucune norme inventée), bloc de phase courante avec les phases closes
  interdites, et bloc debrief quand la trame est épuisée.
- **Langue** : celle du dossier, sauf pendant `language-switch`.
- `POST /api/dossiers/:id/sessions/:sid/turn` : streaming SSE — événements `stage`,
  `sources`, `chunk`, `done`, `error`. La session est sauvegardée après chaque tour.

### 5.6 Debrief
Quand `phaseForTurn` retourne `null`, l'instruction passe en mode debrief : pour chaque phase,
ce qui a porté, ce qui a manqué, la seule chose à corriger ; puis les trois priorités. Le
texte est stocké dans la session (`debrief`).

## 6. Abstraction fournisseurs

```ts
interface Provider {
  readonly id: 'openai' | 'anthropic' | 'gemini'
  readonly models: readonly string[]
  stream(input: { system: string; messages: readonly Message[]; model: string;
                  signal: AbortSignal }): AsyncIterable<string>
  structured<T>(input: { system: string; prompt: string; schema: ZodSchema<T>;
                         model: string; signal: AbortSignal }): Promise<T>
  search(input: { query: string; model: string; signal: AbortSignal }):
    Promise<{ text: string; sources: readonly string[] }>
}
```

Un adaptateur par fournisseur, ≤ 150 LOC, utilisant le SDK officiel et son outil de
recherche natif. `search` lève une erreur explicite si le modèle choisi ne supporte pas la
recherche. Un `FakeProvider` sert aux tests.

## 7. UI (V1)

Quatre écrans, une seule barre en haut (marque, écrans, commandes de l'écran actif) :

1. **Dossiers** — liste des candidatures, bouton « Nouveau » (entreprise, poste, sites,
   langue, fournisseur/modèle), suppression avec confirmation.
2. **Préparer** — quatre panneaux : Offre, CV, Entreprise (rubriques avec bouton relancer,
   sources), Analyse (exigences avec état coloré), et la Trame éditable + persona.
3. **Simuler** — le chat ; en tête « Question 4 / 16 · Mises en situation » ; panneau latéral
   des sources consultées ; boutons Arrêter, Nouvelle session ; coaching rendu en encadré
   distinct.
4. **Debrief** — le texte du debrief, la liste des sessions passées.

Thème clair/sombre, CSS variables uniquement, styles repris de Cerveau (police, barre,
composer, liste de messages). i18n par dictionnaire JSON `fr.json` / `en.json`, langue de
l'UI indépendante de la langue de l'entrevue.

## 8. Gestion des erreurs

- Clé absente → fournisseur non listé ; dossier pointant vers un fournisseur absent →
  bandeau « Clé manquante » avec le nom de la variable.
- Erreur API → événement SSE `error` avec message lisible, session conservée jusqu'au dernier
  tour réussi.
- JSON structuré invalide → une relance avec l'erreur de schéma, puis échec explicite.
- Fichier de dossier corrompu → l'API répond 422 avec le chemin du fichier ; l'UI l'affiche.

## 9. Tests

- **Serveur (Vitest)** : `phaseForTurn` / `closedPhases` sur le squelette et sur un plan
  édité ; ciblage lexical (rotation des sources selon la phase) ; schémas `Plan`,
  `Analysis`, `Dossier` ; assemblage de l'instruction (phase courante, phases closes,
  debrief) ; routes avec `FakeProvider` et un `DATA_DIR` temporaire.
- **Web** : composants clés (barre de phase, encadré de coaching, éditeur de trame) avec
  Testing Library.
- Pas de test contre les vraies API dans la CI.

## 10. Contraintes de code

Règles globales de l'auteur : TypeScript strict, jamais de `any`, composants ≤ 200 LOC,
hooks ≤ 150, services ≤ 300, fonctions ≤ 40, pas de `console.log`, CSS variables.
`FILEMAP.md` à la racine, mis à jour à chaque création/suppression de fichier.

## 11. Hors V1

Import PDF (offre, CV), embeddings vectoriels, application bureau (Tauri), backend hébergé,
gabarits de trame par métier contribuables, export du debrief en PDF, transcription vocale.
