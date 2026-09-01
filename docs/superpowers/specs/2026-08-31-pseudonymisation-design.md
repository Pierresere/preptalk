# Pseudonymisation des appels IA — conception

> 2026-08-31. Prolonge [`docs/conformite-loi-25.md`](../../conformite-loi-25.md).
> Prose en français (le sujet est la Loi 25) ; tous les identifiants de code restent en anglais.

## Objectif

Aucun renseignement personnel identifiant ne doit franchir la frontière `Provider`, c'est-à-dire
partir vers une API d'IA. La garantie doit être **structurelle** : un pipeline qui oublierait la
protection doit échouer, pas fuiter silencieusement.

Cible : les personnes physiques — le candidat, et les tiers nommés dans une offre ou un document.
Hors cible : les entités légales. Le nom de l'entreprise visée est conservé tel quel, sans quoi la
recherche entreprise perd tout sens.

## Le principe directeur : un masquage visible

Une détection automatique de noms propres n'atteint jamais 100 % de rappel. Plutôt que de prétendre
le contraire ou de renvoyer les cas difficiles « hors périmètre », la conception **montre à
l'utilisateur ce qui sera masqué et lui laisse le corriger**, une fois par dossier, avant le premier
appel.

Ce choix résout trois problèmes d'un coup :

- **Rappel** : ce que les règles ratent — un patronyme de recruteur, un collègue cité — l'utilisateur
  l'ajoute en un clic. C'est la seule méthode qui traite honnêtement les noms de tiers.
- **UX** : plus besoin de demander « ton nom » à l'aveugle dans le formulaire. Le nom est proposé,
  extrait du CV ; l'utilisateur confirme.
- **Confiance** : la protection devient une fonctionnalité qu'on voit, sur un produit positionné
  « rassurant ». C'est aussi la capture d'écran qui vend un contrat RH ou institutionnel.

## Architecture

Un **décorateur** enveloppe chaque `Provider` réel dans `providers/registry.ts`. Aucun pipeline
n'appelle le masqueur directement ; ils fournissent seulement la matière première.

```
pipeline ──> maskedProvider ──> provider réel ──> API
                │  masque à l'aller
                └─ réhydrate au retour
```

### Modification de l'interface `Provider`

`StreamInput` et `StructuredInput` reçoivent un champ **obligatoire** `personal` :

```ts
export interface PersonalData {
  /** Values to mask that regexes cannot find on their own: confirmed person names. */
  readonly names: readonly string[]
  /** Spans never masked even when they collide with a name (company, position). */
  readonly keep: readonly string[]
}

export interface StreamInput {
  readonly system: string
  readonly messages: readonly ChatMessage[]
  readonly personal: PersonalData   // nouveau
  // … inchangé
}

export interface StructuredInput<T> {
  readonly system: string
  readonly prompt: string
  readonly personal: PersonalData   // nouveau
  // … inchangé
}
```

Le champ est requis par le typage : **c'est le mécanisme anti-oubli**. Un pipeline qui ne le fournit
pas ne compile pas. Le helper `personalDataOf(dossier, privacy)` construit la valeur à partir de la
liste confirmée et des champs `company`/`position`.

`SearchInput` n'est **pas** modifié : `search()` ne transporte que le nom de l'entreprise, le poste
et les sites (`buildQuery`). Le décorateur le laisse passer, mais applique un **garde-fou** : si la
requête contient malgré tout un courriel, un téléphone ou un nom confirmé, il lève
`ProviderError('Personal data in search query', 500)`. Fail-closed.

## Le masqueur (`domain/privacy.ts`)

Module pur, sans I/O ni réseau, donc entièrement testable.

```ts
export interface Detection {
  readonly value: string
  readonly kind: 'name' | 'email' | 'phone' | 'postal' | 'profile'
  readonly source: 'rule' | 'suggested' | 'confirmed'
}

export interface Masking {
  readonly text: string
  readonly map: ReadonlyMap<string, string>  // token -> valeur réelle
}

export function detect(text: string, personal: PersonalData): Detection[]
export function mask(text: string, personal: PersonalData): Masking
export function unmask(text: string, map: ReadonlyMap<string, string>): string
```

`detect` alimente l'écran de revue ; `mask` alimente le décorateur. Les deux partagent les mêmes
règles, donc **ce que l'utilisateur voit est exactement ce qui sera masqué**.

### Format des jetons

`[CANDIDAT_1]`, `[PERSONNE_1]`, `[COURRIEL_1]`, `[TEL_1]`, `[CODEPOSTAL_1]`, `[PROFIL_1]`.

Crochets et majuscules : visuellement inertes pour un modèle, faciles à repérer dans un test, et
improbables dans un CV.

**Un jeton par valeur distincte**, numéroté à partir de 1 dans l'ordre d'apparition. La règle vaut
pour toutes les catégories : « Pierre Séré » devient `[CANDIDAT_1]` et « Séré » seul `[CANDIDAT_2]`.
Sans elle, deux chaînes différentes partageraient un jeton et la réhydratation ne restituerait pas
le texte d'origine.

### Règles de détection

| Cible | Méthode | Jeton |
|---|---|---|
| Nom du candidat | Correspondance exacte sur les noms confirmés, insensible à la casse et aux accents, aux limites de mot ; nom complet d'abord, puis chaque partie de 3 caractères ou plus | `[CANDIDAT_n]` |
| Nom d'un tiers | Idem, sur les noms confirmés marqués comme tiers | `[PERSONNE_n]` |
| Courriels | Expression régulière | `[COURRIEL_n]` |
| Téléphones | Expression régulière, formats nord-américain et français | `[TEL_n]` |
| Codes postaux canadiens | Expression régulière `A1A 1A1` | `[CODEPOSTAL_n]` |
| Profils LinkedIn | URL dont le chemin commence par `/in/` | `[PROFIL_n]` |

**Exemption `keep`** : une correspondance de nom entièrement contenue dans un segment `keep` (nom
d'entreprise, intitulé de poste) n'est jamais masquée. C'est ce qui évite de mutiler « Câbles
Ben-Mor » quand le candidat s'appelle Ben-Mor.

L'ordre compte : les courriels et les URL sont masqués **avant** les noms, sinon `pierre.sere@…`
serait coupé en deux.

Masquer aussi les parties du nom prises isolément est un choix assumé : il protège le patronyme
lorsqu'il apparaît seul, au prix de faux positifs. Le compromis penche du bon côté — un faux positif
dégrade marginalement le contexte, un faux négatif est une fuite.

### Suggestion de noms (`suggestNames`)

Alimente l'écran de revue. Purement local, aucune IA, aucun réseau.

- **Candidat** : les cinq premières lignes non vides du CV, en retenant la première qui compte 2 à 4
  mots capitalisés, sans chiffre ni symbole, et qui précède le premier courriel. C'est la structure
  d'en-tête de la quasi-totalité des CV.
- **Tiers** : suites de 2 à 3 mots capitalisés situées dans une fenêtre de 40 caractères après un
  marqueur de contact — `contact`, `à l'attention`, `responsable`, `recruteur`, `superviseur`,
  `directeur`, ou une ligne précédant immédiatement un courriel détecté.
- Les suggestions sont filtrées par une **liste d'exclusion** : mois, jours, technologies et titres
  de section courants d'un CV (`Formation`, `Expérience`, `Compétences`…), plus les segments `keep`.

Le rappel imparfait est assumé, puisque l'utilisateur complète. Aucune suggestion n'est appliquée
sans confirmation ; aucune ne peut être *retirée* en silence non plus — voir ci-dessous.

## Stockage : la liste, jamais la table

Deux objets bien distincts, et c'est important :

- **La table de correspondance** (`token → valeur`) vit le temps d'un appel et n'est **jamais**
  persistée. Aucune donnée personnelle supplémentaire au repos, rien à migrer ni à purger.
- **La liste des noms confirmés** est persistée dans `data/<dossier>/privacy.json`
  (`{ names: [{ value, kind }], reviewedAt }`). Ces valeurs figurent déjà dans le CV stocké : la
  liste n'ajoute aucune exposition, elle rend seulement le choix de l'utilisateur durable.

`privacy.json` absent ⇒ le dossier n'a pas encore été revu.

## Parcours utilisateur

Le formulaire de création **ne change pas** : plus de champ « Ton nom ».

À la première action envoyant des données au modèle (analyse, plan ou entretien), si `privacy.json`
n'existe pas, l'écran **« Ce qui sera masqué »** s'intercale :

- les valeurs détectées, groupées par type, avec l'extrait de contexte où elles apparaissent ;
- les noms suggérés cochés par défaut, chacun décochable ;
- un champ « ajouter un nom » pour ce que les règles ont raté ;
- une phrase expliquant où partent les données et ce qui n'en part pas ;
- un bouton « Continuer » qui écrit `privacy.json` et enchaîne l'action demandée.

Les valeurs trouvées par expression régulière (courriels, téléphones, codes postaux, profils) sont
affichées mais **non décochables** : ce sont des identifiants directs, les laisser passer n'est pas
un choix qu'on propose. Seuls les *noms* sont discutables, parce qu'eux seuls produisent des faux
positifs.

L'écran reste accessible ensuite depuis l'écran Préparer pour réviser la liste.

## Réhydratation

### En flux

`stream()` renvoie des morceaux qui peuvent couper un jeton en deux (`[CAND` puis `IDAT_1]`). Le
décorateur maintient un tampon :

- il n'émet que jusqu'au dernier `[` non refermé ;
- il retient la queue à partir de ce `[` jusqu'à voir un `]` ;
- au-delà de 32 caractères retenus sans `]`, il vide le tampon tel quel (ce n'était pas un jeton) ;
- à la fin du flux, il vide le tampon restant.

### D'un résultat structuré

`structured<T>()` renvoie un objet déjà analysé et validé. Le décorateur parcourt récursivement les
chaînes de l'objet et y applique `unmask`. La validation zod s'exécute donc sur les valeurs
masquées — sans conséquence, aucun schéma du domaine ne valide de format d'identité.

Le parcours est écrit sur `unknown` (jamais `any`), avec une seule conversion de type documentée au
retour.

## Fuites hors du canal principal

Le masquage ne protège que le fil. Deux vecteurs restent, et ils sont traités ici :

1. **Journalisation.** Aucune charge utile de prompt, aucun message de session ne doit être écrit
   dans un journal, y compris sur le chemin d'erreur. Les `ProviderError` reportent un code et une
   catégorie, jamais le contenu envoyé. Un test vérifie qu'une erreur provider ne contient pas le
   texte du prompt.
2. **Données au repos.** Le CV complet reste en clair sur disque — c'est hors du périmètre de cette
   couche, mais pas de la conformité. Chiffrement au repos, durée de conservation et effacement
   complet (dossier, sessions, débriefs, `privacy.json`) relèvent du chantier SaaS et sont notés
   comme tels dans le plan de mise en conformité.

## Tests

- **`domain/privacy.test.ts`** — courriels, téléphones, codes postaux, profils ; noms avec accents et
  casse variable ; exemption `keep` ; ordre courriel-avant-nom ; aller-retour `mask`/`unmask`
  restituant le texte d'origine ; idempotence ; `detect` et `mask` s'accordent sur le même ensemble.
- **`suggestNames`** — en-têtes de CV réalistes (nom seul, nom + titre, nom après une ligne vide) ;
  marqueurs de contact dans une offre ; liste d'exclusion ; aucun segment `keep` suggéré.
- **Réhydratation en flux** — un jeton coupé sur trois morceaux est restitué entier ; un `[` isolé
  suivi de 40 caractères sans `]` est émis tel quel.
- **Résultat structuré** — un objet imbriqué contenant des jetons dans des chaînes et des tableaux
  est entièrement réhydraté.
- **Garde-fou `search()`** — une requête contenant un courriel lève `ProviderError`.
- **Journalisation** — une `ProviderError` levée sur un prompt contenant un nom ne comporte pas ce
  nom dans son message.
- **Test de frontière (preuve de conformité)** — `analyze` puis `runTurn` sont exécutés contre
  `FakeProvider` avec un CV et une offre réalistes ; les charges utiles capturées ne contiennent ni
  les noms confirmés, ni aucune correspondance des expressions régulières. C'est ce test que citera
  l'ÉFVP.

## Hors périmètre de cette version

- **Adresses postales complètes** en texte libre : seul le code postal est masqué. Une adresse
  civique complète reste détectable à l'œil dans l'écran de revue, où l'utilisateur peut l'ajouter
  comme valeur à masquer.
- **Numéros d'assurance sociale et dates de naissance** : absents des CV visés. Les règles sont
  triviales à ajouter si le besoin apparaît.
- **Reconnaissance d'entités par modèle local** (Ollama) pour les noms de tiers : l'écran de revue
  couvre le besoin sans dépendance ni coût. À reconsidérer seulement si l'usage montre que les
  utilisateurs ne corrigent pas.
- **Contenu des PDF et images**, que l'application n'ingère pas encore.

## Ordre de réalisation

1. `domain/privacy.ts` — `detect`, `mask`, `unmask`, `suggestNames` — et ses tests. Module pur,
   aucune dépendance : c'est là que se joue la qualité.
2. `PersonalData` dans `providers/types.ts` ; la compilation casse partout où un appel doit être
   traité — c'est la liste de travail.
3. Le décorateur et son application dans `registry.ts`, avec les tests de flux, de résultat
   structuré, de garde-fou et de journalisation.
4. `privacy.json` : stockage, route de lecture/écriture, injection dans les pipelines.
5. L'écran « Ce qui sera masqué » et son interception dans le parcours.
6. Le test de frontière.
