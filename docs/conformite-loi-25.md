# Conformité Loi 25 et architecture des appels IA

> Étude réalisée le 2026-08-31. Ce document n'est pas un avis juridique ; il prépare l'ÉFVP.
> Document en français : la Loi 25 est québécoise et sa terminologie l'est aussi.

## Ce que transitent les appels IA aujourd'hui

Le navigateur n'appelle jamais un fournisseur d'IA directement. Le circuit est :

1. **Navigateur** → serveur local (`localhost:4820`), REST + SSE pour le streaming.
2. **Serveur** (`server/src`) : lit le dossier sur disque, sélectionne les extraits pertinents
   (`domain/retrieval.ts`), construit le prompt (`domain/prompt.ts`).
3. **Provider** (`providers/{openai,anthropic,gemini}.ts`) : envoie le prompt en HTTPS à l'API du
   fournisseur avec la clé du `.env`.
4. **Stockage** : fichiers locaux (`storage/dossiers.ts`).

**Conséquence** : le CV complet et non anonymisé du candidat part aujourd'hui vers des serveurs
américains à chaque analyse, plan ou tour d'entretien.

## Ce que dit la Loi 25

- **Les données non anonymisées sont permises, sous conditions.** Envoyer un CV à une API d'IA est
  traité comme la **communication de renseignements personnels à un sous-traitant hors Québec**
  ([Filiatrault](https://www.patriciafiliatrault.com/actualites/chatgpt-claude-donnees-clients-loi-25/),
  [Factero](https://factero.ca/blog/loi-25-et-ia-vos-conversations-avec-claude-ou-chatgpt-ne-sont-pas-confidentielles/)).
  Conditions : consentement éclairé, vérification des conditions du fournisseur (pas d'entraînement
  sur les données, rétention limitée), protection équivalente aux exigences québécoises.
- **ÉFVP obligatoire** (évaluation des facteurs relatifs à la vie privée) avant tout projet traitant
  des renseignements personnels par IA ou les transférant hors Québec
  ([Digitad](https://digitad.ca/loi-25/), [V pour Design](https://vpourdesign.com/blog/loi-25-intelligence-artificielle-quebec)).
  C'est un document interne à produire, pas une autorisation à demander.
- **Autres obligations** : responsable de la protection des renseignements personnels désigné,
  politique de confidentialité publiée, registre des incidents, notification des fuites, droit à
  l'effacement, vie privée par défaut ([guide CAI](https://info-employeur.ca/pages/loi25.html),
  [La Fusée](https://lafusee.net/loi-25-resume/)). Sanctions jusqu'à 2-4 % du chiffre d'affaires.

**Point favorable** : les **API** payantes d'OpenAI, Anthropic et Google n'entraînent pas leurs
modèles sur les données soumises et appliquent une rétention limitée — contrairement aux interfaces
grand public. C'est un argument central de l'ÉFVP.

## Décision 1 — Pseudonymiser les personnes, pas les entreprises

**Règle retenue : on masque les personnes physiques, on garde les entités légales.**

L'entreprise visée par le candidat **n'est pas** pseudonymisée :

1. Ce n'est pas un renseignement personnel — la Loi 25 protège les personnes physiques.
2. L'anonymiser détruirait le produit : la recherche entreprise repose sur l'envoi du nom réel à un
   modèle qui effectue une recherche web.
3. Le risque n'est pas là : savoir que quelqu'un s'intéresse à telle entreprise n'a de valeur que
   couplé à son identité — et c'est ce couple que la pseudonymisation casse.

**En revanche**, les personnes physiques présentes côté entreprise sont pseudonymisées : recruteur
nommé dans l'offre, courriel de contact, responsable cité dans un document. Ces tiers n'ont jamais
consenti.

### Asymétrie des trois méthodes du `Provider`

| Méthode | Contenu transmis | Traitement |
|---|---|---|
| `search()` | Nom d'entreprise, poste, sites (`buildQuery`) — **aucune donnée candidat** | Passe tel quel |
| `structured()` | CV, offre, documents (analyse, plan) | **Pseudonymisé** |
| `stream()` | CV, offre, documents (entretien, débrief) | **Pseudonymisé** |

Remarque : `domain/prompt.ts` passe déjà `candidate: 'the candidate'` en dur — l'entretien n'utilise
jamais le vrai nom, la pseudonymisation ne dégradera donc pas la qualité.

### Design proposé

**Un décorateur autour de l'interface `Provider`, posé dans `providers/registry.ts`.** Chaque
provider réel est enveloppé : `stream` et `structured` masquent en entrée et réhydratent en sortie,
`search` passe inchangé. Aucun pipeline n'est modifié, et il devient **impossible d'oublier la
protection en ajoutant une fonctionnalité** — c'est la « vie privée par défaut » garantie par
l'architecture plutôt que par la discipline.

Table de correspondance réversible : `Pierre Séré → [CANDIDAT_1]`, `pierre@… → [COURRIEL_1]`,
`514-555-0123 → [TEL_1]`. Déterministe, testable, sans appel réseau.

Conception détaillée : [`docs/superpowers/specs/2026-08-31-pseudonymisation-design.md`](./superpowers/specs/2026-08-31-pseudonymisation-design.md).

### Deux points durs identifiés

1. **Détecter les noms.** Courriels, téléphones et adresses se trouvent par expression régulière de
   façon fiable. Les *noms* dans de la prose, non. Solution retenue : demander au candidat son nom,
   courriel et téléphone une fois (au dépôt du CV), puis remplacer par correspondance exacte et
   variantes (accents, initiales). Seul impact visible : un ajout au formulaire.
2. **Réhydratation en streaming.** Un jeton `[CANDIDAT]` peut être coupé entre deux morceaux SSE ;
   il faut un tampon de quelques caractères dans le décorateur.

Un test « aucune donnée personnelle ne franchit la frontière provider » servira de preuve de
conformité.

## Décision 2 — Vertex AI à Montréal

Vertex AI est disponible dans la région **`northamerica-northeast1` (Montréal)**, et Google a annoncé
un engagement de résidence des données **au repos et pendant le traitement ML** pour le Canada
([annonce Google Canada](https://blog.google/intl/en-ca/company-news/technology/announcing-data-residency-at-rest-and-during-machine-learning-ml-processing/)).
Cela supprimerait le transfert hors Québec, et donc toute une section de l'ÉFVP.

### Impact sur le code : faible

L'abstraction `Provider` est déjà en place. Ajouter Vertex = **un fichier**, `providers/vertex.ts`,
sur le modèle de `gemini.ts`. Deux différences : authentification par compte de service Google Cloud
(OAuth) au lieu d'une clé API, et région dans l'URL
(`northamerica-northeast1-aiplatform.googleapis.com`).

### Réserves à lever avant de l'annoncer publiquement

1. **Résidence au repos ≠ résidence de traitement.** Un fournisseur peut stocker au Canada et inférer
   aux États-Unis ([Lorikeet](https://www.lorikeetcx.ai/articles/ai-support-canadian-data-residency-guide)).
   Certaines sources indiquent que l'engagement contractuel formel (*Data Residency Zone*) ne couvre
   officiellement que les États-Unis et l'UE, alors que l'annonce Canada existe pour Gemini.
   **À clarifier avec Google avant de l'écrire dans la politique de confidentialité.**
2. **Le traitement garanti en région passe souvent par du *Provisioned Throughput*** (capacité
   réservée), coûteux et difficile à justifier à 2,99 $ le projet sans volume. En pay-as-you-go, la
   garantie est moins ferme.
3. **Perte de Claude.** Les modèles Anthropic sur Vertex sont servis depuis `us-east5`, `us-central1`,
   l'Europe ou l'endpoint global — aucune région canadienne
   ([doc Claude](https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai)).
   « Tout Vertex à Montréal » signifie « tout Gemini ».

### Le grounding, et pourquoi l'asymétrie nous arrange

Le *Grounding with Google Search*, dont dépend la recherche entreprise, se configure sur un endpoint
**global** — ce qui romprait la résidence. Mais `search()` ne transporte **aucune donnée
personnelle**. D'où l'architecture cible :

- `stream()` et `structured()` (CV, offre, documents) → **Vertex Montréal**. Les renseignements
  personnels ne quittent jamais le Canada.
- `search()` (recherche entreprise) → endpoint global assumé. Rien à déclarer.

Séparation nette, facile à défendre dans l'ÉFVP et devant un client RH.

### Vérification préalable

Ouvrir le Model Garden du projet GCP et confirmer **quels modèles Gemini sont réellement activables
en `northamerica-northeast1`**, et si le pay-as-you-go y suffit ou exige de la capacité réservée.
Cette réponse décide si le chantier est viable immédiatement ou après les premiers revenus.

## Plan de mise en conformité

Pseudonymisation **et** Vertex Montréal sont complémentaires, pas redondants : la pseudonymisation
protège aussi les tiers nommés dans les offres et permet de changer de fournisseur sans reconstruire
la conformité.

1. Pseudonymisation avant tout appel LLM (décorateur `Provider`).
2. Provider Vertex AI, région Montréal pour les appels porteurs de données personnelles.
3. Consentement explicite à la création du dossier : mention claire du fournisseur, du lieu
   d'hébergement et de l'absence d'entraînement sur les données, avec lien vers la politique.
4. Hébergement des dossiers au Canada lors du passage en SaaS.
5. Effacement réel et complet (dossier + sessions + débriefs), exposé comme un droit.
6. Rédiger l'**ÉFVP** et la **politique de confidentialité** avant le lancement public.
7. Désigner le responsable de la protection des renseignements personnels.

## Sources

- [Digitad — guide Loi 25](https://digitad.ca/loi-25/)
- [Patricia Filiatrault — ChatGPT/Claude et Loi 25](https://www.patriciafiliatrault.com/actualites/chatgpt-claude-donnees-clients-loi-25/)
- [Factero — conversations IA et confidentialité](https://factero.ca/blog/loi-25-et-ia-vos-conversations-avec-claude-ou-chatgpt-ne-sont-pas-confidentielles/)
- [V pour Design — Loi 25 et IA](https://vpourdesign.com/blog/loi-25-intelligence-artificielle-quebec)
- [Info-Employeur — guide CAI](https://info-employeur.ca/pages/loi25.html) · [La Fusée](https://lafusee.net/loi-25-resume/)
- [Google Cloud — résidence des données Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency)
- [Annonce Google Canada — résidence at-rest et ML](https://blog.google/intl/en-ca/company-news/technology/announcing-data-residency-at-rest-and-during-machine-learning-ml-processing/)
- [Disponibilité des modèles par région](https://modelavailability.com/platforms/gcp/regions)
- [Forum Google — Gemini 2.5 Flash à Montréal](https://discuss.google.dev/t/vertex-ai-gemini-2-5-flash-model-available-on-montreal-northamerica-northeast1-server/193394)
- [Lorikeet — résidence canadienne, ce qu'il faut vérifier](https://www.lorikeetcx.ai/articles/ai-support-canadian-data-residency-guide)
- [Claude sur Vertex AI](https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai)
