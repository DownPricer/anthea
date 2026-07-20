# Audit i18n (avant migration)

Date : 2026-07-20

## Frontend (React)

- **Lib i18n** : aucune détectée (pas de `i18next`, `react-intl`, etc.).
- **Dates/heures** :
  - `date-fns` utilisé avec locale **FR forcée** (`NotificationsPage.jsx`, etc.).
  - `toLocaleDateString('fr-FR', …)` forcé dans `src/components/badges/BadgeDetailSheet.jsx`.
- **Textes français codés en dur** : navigation, pages, toasts, états vides, aria-labels (ex. `DesktopNav.jsx`, `SettingsPage.jsx`, `NotificationsPage.jsx`, `ProfileFeaturedBadges.jsx`, `pushNotifications.js`).
- **Web Push côté client** :
  - `public/sw.js` affiche le payload tel quel (OK pour i18n si le backend localise).
  - `src/lib/pushNotifications.js` contient des messages UX FR codés en dur.
- **Badges profil perso (UI)** :
  - `ProfileEditDialog.jsx` filtre déjà les badges `unlocked` et exclut le duo, mais la sélection n’affiche pas encore les visuels canoniques (`BadgeArtwork`) et dépend des IDs renvoyés par le backend.

## Backend (FastAPI)

- **Profil utilisateur** :
  - Endpoint existant `PUT /api/auth/profile` (fichier `site/backend/server.py`) utilisé pour les préférences.
  - Pas de champs `locale` / `time_format` dans le modèle utilisateur à l’instant T (à ajouter).
- **Badges** :
  - Catalogue canonique v1 dans `site/backend/badge_catalog.py` :
    - IDs stables (solo/duo), mapping `LEGACY_BADGE_ID_MAP` présent.
    - `name`, `description`, `RARITY_LABELS` en **français codé en dur**.
  - Endpoint canonique **profil perso** : `GET /api/users/me/badges` renvoie le catalogue solo + progression.
- **Notifications / Web Push** :
  - `site/backend/push_service.py` : templates push FR codés en dur (`PUSH_TYPE_PAYLOADS`).
  - `site/backend/badge_progress.py` : messages de déblocage badge FR codés en dur.
  - `create_notification()` dans `server.py` persiste des notifications sans `title/body` systématiques ; le frontend reconstruit souvent le texte depuis `type`.
- **Défis** :
  - `site/backend/challenges.py` contient `title/description` en **français codé en dur**.

## Endpoints identifiés (impact i18n / préférences / badges)

- **Profil / préférences** : `GET /api/auth/me`, `PUT /api/auth/profile`
- **Badges** : `GET /api/users/me/badges`, `GET /api/badges/catalog`, `GET /api/users/:id/badges`
- **Notifications** : `GET /api/notifications`, `POST /api/notifications/read-all`, Web Push `POST /api/push/test`

