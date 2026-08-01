# Validation responsive de la landing publique

Validation manuelle effectuée le 1er août 2026 sur le build de production.

- Viewports vérifiés : 320, 360, 390, 430, 768, 1024, 1366 et 1440 px.
- Aucun débordement horizontal détecté (`scrollWidth <= clientWidth`).
- Header sur une ligne et CTA entièrement visibles.
- Titre du hero contenu sur 2 à 4 lignes selon la langue.
- Grille des posts : 1 colonne à 320 px, 2 à 768 px, 3 à 1440 px.
- Six cartes avec textes longs : largeur fluide, hauteurs identiques à 1440 px.
- Thèmes vérifiés : sombre et clair.
- Locales vérifiées : français, anglais et espagnol.

Les tests Jest vérifient en complément les CTA, la limite de six posts, les
classes responsive, le lazy loading des médias, la modale anonyme et la parité
des traductions. Jest ne remplace pas cette validation visuelle.
