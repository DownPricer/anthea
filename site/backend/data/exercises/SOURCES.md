# Sources — catalogue d'exercices Anthea / FitMatch

## Fournisseur principal

- **Nom :** ExerciseDB (AscendAPI) — provider code `exercisedb`
- **URL d'origine (API OSS) :** https://oss.exercisedb.dev/api/v1/exercises
- **Documentation :** https://docs.ascendapi.com/products/edb-v1/overview
- **Site :** https://exercisedb.dev /
- **Type de données :** métadonnées exercices (nom, muscles, équipement, instructions) + URL de GIF animés
- **Licence identifiée :** licence API limitée / propriétaire (AscendAPI & ExerciseDB). Accès OSS gratuit documenté pour ~1500 exercices (GIF 180p). Redistribution / republication des médias comme fichiers autonomes **interdite** selon les conditions publiques AscendAPI / ExerciseDB.
- **Politique de cache :** `EXERCISE_MEDIA_MODE=remote` par défaut — le frontend charge les GIF depuis le CDN fournisseur. Modes `proxy_cache` / `download` disponibles uniquement si les conditions contractuelles du compte le permettent ; **ne pas activer download** tant que la licence média reste restrictive.
- **Politique d'attribution :** conserver `source.license`, `source.attribution` et `source.original_url` sur chaque document `exercise_catalog`. Attribution : Exercise data and GIFs © ExerciseDB / AscendAPI.
- **Date de récupération (pipeline) :** 2026-07-22

## Fallback metadata (si pagination API insuffisante)

- **Nom :** Aquariius/exercises-dataset (metadata JSON only)
- **URL :** https://github.com/Aquariius/exercises-dataset/blob/main/data/exercises.json
- **Usage :** import des champs structurés uniquement ; les chemins locaux `videos/*.gif` sont **remapés** vers `https://static.exercisedb.dev/media/{id}.gif` (aucune copie de GIF dans Git ni sur disque en mode remote).
- **Licence médias :** même origine ExerciseDB / AscendAPI → **ne pas télécharger / republier** les GIF.

## Fournisseur secondaire (architecture)

- **WgerProvider** — stub, non activé.
- **FreeExerciseDbProvider** (`free_exercise_db`) — dataset public domain https://github.com/yuhonas/free-exercise-db (images **statiques**, pas GIF). Fallback metadata / images seulement.

## Variables d'environnement

```
EXERCISE_PROVIDER=exercisedb
EXERCISE_PROVIDER_BASE_URL=https://oss.exercisedb.dev/api/v1
EXERCISE_PROVIDER_API_KEY=
EXERCISE_MEDIA_MODE=remote
EXERCISE_MEDIA_ALLOWED_HOSTS=
EXERCISE_CUSTOM_CREATION_ENABLED=false
```

## Décision média

| Question | Réponse |
|----------|---------|
| GIF téléchargeables légalement ? | **Incertain / non** au regard des ToS AscendAPI (interdiction de stockage persistant des médias sur certains plans) |
| Mode retenu | `remote` |
| GIF dans Git ? | **Non** |
