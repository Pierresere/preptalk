# Pseudonymisation des appels IA — conception

> 2026-08-31. Prolonge [`docs/conformite-loi-25.md`](../../conformite-loi-25.md).
> Prose en français (le sujet est la Loi 25) ; tous les identifiants de code restent en anglais.

## Objectif

Aucun renseignement personnel identifiant ne doit franchir la frontière `Provider`, c'est-à-dire
partir vers une API d'IA. La garantie doit être **structurelle** : un nouveau pipeline qui oublierait
la protection doit échouer, pas fuiter silencieusement.

Cible : les personnes physiques (le candidat, et les tiers nommés dans une offre ou un document).
Hors cible : les entités légales — le nom de l'entreprise visée est conservé tel quel, sans quoi la
recherche entreprise perd tout sens.

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
  /** Names that regexes cannot find in prose; declared by the candidate. */
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
pas ne compile pas. Un helper `personalDataOf(dossier)` construit la valeur à partir de
`candidateName`, `company` et `position`.

`SearchInput` n'est **pas** modifié : `search()` ne transporte que le nom de l'entreprise, le poste
et les sites (`buildQuery`). Le décorateur le laisse passer, mais applique un **garde-fou** : si la
requête contient malgré tout un courriel, un téléphone ou un nom déclaré, il lève
`ProviderError('Personal data in search query', 500)`. Fail-closed.

## Le masqueur (`domain/privacy.ts`)

Module pur, sans I/O ni réseau, donc entièrement testable.

```ts
export interface Masking {
  readonly text: string
  readonly map: ReadonlyMap<string, string>  // token -> valeur réelle
}

export function mask(text: string, personal: PersonalData): Masking
export function unmask(text: string, map: ReadonlyMap<string, string>): string
```

### Format des jetons

`[CANDIDAT_1]`, `[COURRIEL_1]`, `[TEL_1]`, `[CODEPOSTAL_1]`, `[PROFIL_1]`.

Crochets et majuscules : visuellement inertes pour un modèle, faciles à repérer dans un test, et
improbables dans un CV.

**Un jeton par valeur distincte**, numéroté à partir de 1 dans l'ordre d'apparition. La règle vaut
pour toutes les catégories, y compris le candidat : « Pierre Séré » devient `[CANDIDAT_1]` et
« Séré » seul `[CANDIDAT_2]`. Sans cette règle, deux chaînes différentes partageraient un jeton et
la réhydratation ne restituerait pas le texte d'origine.

### Portée de la table de correspondance

**Une table par appel**, jamais persistée. Le masquage est appliqué au moment de l'appel sur la
charge utile complète, et la réhydratation consomme la même table au retour. Conséquences :

- aucun stockage supplémentaire de données personnelles, donc rien à migrer ni à purger ;
- la numérotation est déterministe pour un contenu donné, donc stable d'un tour à l'autre ;
- l'historique de session reste stocké **en clair** sur disque (il l'est déjà) et se fait remasquer
  à chaque envoi.

### Règles de détection

| Cible | Méthode | Jeton |
|---|---|---|
| Nom du candidat | Correspondance exacte sur les noms déclarés, insensible à la casse et aux accents, aux limites de mot ; nom complet d'abord, puis chaque partie de 3 caractères ou plus | `[CANDIDAT_n]` |
| Courriels | Expression régulière | `[COURRIEL_n]` |
| Téléphones | Expression régulière, formats nord-américain et français | `[TEL_n]` |
| Codes postaux canadiens | Expression régulière `A1A 1A1` | `[CODEPOSTAL_n]` |
| Profils LinkedIn | URL dont le chemin commence par `/in/` | `[PROFIL_n]` |

**Exemption `keep`** : une correspondance de nom entièrement contenue dans un segment `keep` (nom
d'entreprise, intitulé de poste) n'est jamais masquée. C'est ce qui évite de mutiler « Câbles
Ben-Mor » quand le candidat s'appelle Ben-Mor.

L'ordre compte : les courriels et les URL sont masqués **avant** les noms, sinon
`pierre.sere@…` serait coupé en deux.

Masquer aussi les parties du nom prises isolément est un choix assumé : il protège le patronyme
lorsqu'il apparaît seul, au prix de faux positifs (un homonyme cité dans le CV, un prénom courant
porté par quelqu'un d'autre). Le compromis penche du bon côté — un faux positif dégrade
marginalement le contexte, un faux négatif est une fuite.

### Réhydratation en flux

`stream()` renvoie des morceaux qui peuvent couper un jeton en deux (`[CAND` puis `IDAT]`). Le
décorateur maintient un tampon :

- il n'émet que jusqu'au dernier `[` non refermé ;
- il retient la queue à partir de ce `[` jusqu'à voir un `]` ;
- au-delà de 32 caractères retenus sans `]`, il vide le tampon tel quel (ce n'était pas un jeton) ;
- à la fin du flux, il vide le tampon restant.

### Réhydratation d'un résultat structuré

`structured<T>()` renvoie un objet déjà analysé et validé. Le décorateur parcourt récursivement les
chaînes de l'objet et y applique `unmask`. La validation zod s'exécute donc sur les valeurs
masquées — sans conséquence, aucun schéma du domaine ne valide de format d'identité.

Le parcours est écrit sur `unknown` (jamais `any`) avec une seule conversion de type documentée au
retour.

## Impact sur le modèle et l'interface

`DossierSchema` gagne un champ `candidateName`, optionnel avec valeur par défaut `''` pour que les
dossiers existants continuent de se lire sans migration.

`DossierForm` gagne un champ « Ton nom » accompagné d'une phrase expliquant pourquoi il est demandé
— c'est le seul impact visible pour l'utilisateur. Courriel et téléphone ne sont **pas** demandés :
les expressions régulières les trouvent partout où ils se trouvent, y compris ceux des tiers.

Quand `candidateName` est vide, le masquage des courriels, téléphones et codes postaux s'applique
toujours ; seul le nom échappe. Ce risque résiduel est assumé et documenté dans l'ÉFVP.

`domain/prompt.ts` reste inchangé : il passe déjà `candidate: 'the candidate'`.

## Tests

- **`domain/privacy.test.ts`** — courriels, téléphones, codes postaux, profils ; noms avec accents et
  casse variable ; exemption `keep` ; ordre courriel-avant-nom ; aller-retour `mask`/`unmask`
  restituant le texte d'origine ; idempotence.
- **Réhydratation en flux** — un jeton coupé sur trois morceaux est restitué entier ; un `[` isolé
  suivi de 40 caractères sans `]` est émis tel quel.
- **Résultat structuré** — un objet imbriqué contenant des jetons dans des chaînes et des tableaux
  est entièrement réhydraté.
- **Garde-fou `search()`** — une requête contenant un courriel lève `ProviderError`.
- **Test de frontière (preuve de conformité)** — `analyze` puis `runTurn` sont exécutés contre
  `FakeProvider` avec un CV réaliste ; les charges utiles capturées ne contiennent ni le nom déclaré,
  ni aucune correspondance des expressions régulières. C'est ce test que citera l'ÉFVP.

## Hors périmètre de cette version

- Adresses postales complètes en texte libre (seul le code postal est masqué).
- Dates de naissance et numéros d'assurance sociale — absents des CV visés ; à ajouter si le besoin
  apparaît.
- Noms de tiers en prose (un recruteur nommé sans son courriel). Leurs coordonnées sont masquées,
  pas leur patronyme : les détecter demanderait de la reconnaissance d'entités.
- Contenu des PDF et images, que l'application n'ingère pas encore.

## Ordre de réalisation

1. `domain/privacy.ts` et ses tests (module pur, aucune dépendance).
2. `PersonalData` dans `providers/types.ts` ; la compilation casse partout où un appel doit être
   traité — c'est la liste de travail.
3. Le décorateur et son application dans `registry.ts`, avec les tests de flux et de résultat
   structuré.
4. `candidateName` dans le schéma, les pipelines et le formulaire.
5. Le test de frontière.
