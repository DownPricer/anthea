# Anthea - Application Fitness pour Couples

## Original Problem Statement
Application mobile-first de fitness pour couples permettant de:
- Créer des comptes avec username/mot de passe
- Se lier en tant que partenaire/coach
- Créer des exercices personnalisés réutilisables
- Créer et planifier des séances avec blocs (échauffement, corps, cooldown)
- Exécuter des séances avec timer guidé et TTS
- Enregistrer les résultats et ressentis
- Partager dans un espace duo privé avec likes, réactions et commentaires
- Suivre des streaks duo, badges et défis

## User Personas
1. **Couple sportif** - Partenaires motivés qui s'entraînent ensemble
2. **Coach/Élève** - Un coach créant des programmes pour son client
3. **Partenaire à distance** - Motivation mutuelle même sans être ensemble

## Stack Technique
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Auth**: JWT avec cookies httpOnly
- **TTS**: Web Speech API navigateur

## What's Been Implemented

### MVP (April 2026)
- [x] Auth (register, login, logout, me, profile update)
- [x] Partner system (request, accept, reject, unlink)
- [x] Exercise library (CRUD + system exercises)
- [x] Workout templates (CRUD)
- [x] Scheduled workouts (CRUD + duplication)
- [x] Workout sessions (create + reactions + comments)
- [x] Duo stats (streaks, badges, challenges)
- [x] Login/Register pages
- [x] Home dashboard avec vue semaine
- [x] Page Séances avec Today/Agenda tabs
- [x] Page création de séance avec blocs
- [x] Player de séance avec timer + TTS
- [x] Page Duo avec feed d'activité
- [x] Page Profil avec changement de thème
- [x] Bottom navigation mobile
- [x] Deux thèmes: Sporty (cyan/green) et Girly (pink/violet)
- [x] Likes, réactions emoji, commentaires
- [x] Streak duo calculé
- [x] Badges et défis hebdomadaires

### V2 Features (April 2026 - Needs full regression test)
- [x] Multi-day/multi-month workout scheduling (batch scheduling, weekly repeats)
- [x] Stop Workout button with modal (Resume/Abandon/Cancel) + save progress
- [x] Detailed stats dashboard for coach/partner in Duo space
- [x] GIFs/Images support in exercises

### Streak Management (April 10, 2026 - Tested & Working)
- [x] Jours de repos (rest days) - ne cassent pas la streak
- [x] Abandon de streak (skip days) - casse la streak volontairement
- [x] Vue semaine avec indicateurs visuels (bleu=repos, rouge=skip)
- [x] Modal de gestion au clic sur un jour
- [x] CRUD API pour streak days (POST rest-day, POST skip-day, GET days, DELETE day)

## Key API Endpoints
- POST /api/streak/rest-day - Marquer jour de repos
- POST /api/streak/skip-day - Marquer jour skip (casse streak)
- GET /api/streak/days?start_date=X&end_date=Y - Récupérer jours marqués
- DELETE /api/streak/day/{date} - Supprimer un marqueur

## DB Collections
- `users`, `partner_requests`, `exercises`, `workout_templates`
- `scheduled_workouts`, `workout_sessions`
- `streak_days` (NEW): {user_id, date, type: "rest"|"skip", created_at}

## Prioritized Backlog

### P1 - High Priority (Next)
- [ ] Vérifier/stabiliser les 4 features V2 (multi-scheduling, stop workout, duo stats, GIFs) - besoin de test complet
- [ ] Vérifier PWA (Service Worker)
- [ ] Vérifier TTS dans le player
- [ ] Notifications push

### P2 - Medium Priority
- [ ] Upload d'images exercices
- [ ] Export/Import de programmes
- [ ] Mode hors-ligne complet (PWA)

### P3 - Low Priority
- [ ] Partage de modèles entre partenaires
- [ ] Historique détaillé
- [ ] Graphiques de progression
- [ ] Sons personnalisés timer

## Test Credentials
- Username: testuser
- Password: test123
