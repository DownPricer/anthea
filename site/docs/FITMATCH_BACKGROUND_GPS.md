# FitMatch : Géolocalisation en arrière-plan

## État actuel

L'implémentation actuelle de FitMatch utilise **uniquement la géolocalisation Web du navigateur** (`navigator.geolocation.watchPosition`).

### Limitations de l'API Web Geolocation

- **Pas de suivi en arrière-plan** : Le suivi s'arrête quand l'application passe en arrière-plan ou que l'écran se verrouille
- **Précision variable** : Dépend du navigateur et de l'appareil
- **Consommation de batterie** : Non optimisée pour les longues sessions
- **Pas de wake lock garantie** : Le Wake Lock API n'empêche pas toujours la mise en veille système

### Implémentation actuelle

```
WebGeolocationAdapter (src/lib/activities/adapters/WebGeolocationAdapter.js)
└── Utilise navigator.geolocation.watchPosition
└── Options: enableHighAccuracy, maximumAge 3000ms, timeout 15000ms
└── Filtrage des points dans locationTracker.js (précision < 50m, distance min 5m)
```

## Solution future : Capacitor + Plugin natif

Pour offrir un vrai suivi GPS en arrière-plan sur Android/iOS, il faudra :

### 1. Migrer vers Capacitor

[Capacitor](https://capacitorjs.com/) permet d'empaqueter l'application React en application native Android/iOS.

```bash
npm install @capacitor/core @capacitor/cli
npx cap init FitMatch com.fitmatch.app
npx cap add android
npx cap add ios
```

### 2. Ajouter un plugin de géolocalisation native

**Option recommandée** : [@capacitor-community/background-geolocation](https://github.com/capacitor-community/background-geolocation)

```bash
npm install @capacitor-community/background-geolocation
npx cap sync
```

**Permissions Android** (AndroidManifest.xml) :
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

**Permissions iOS** (Info.plist) :
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>FitMatch utilise votre position pour suivre vos activités sportives</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>FitMatch a besoin d'accéder à votre position en arrière-plan pour enregistrer vos parcours</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

### 3. Créer un adapter natif

**NE PAS créer de fausse implémentation native maintenant**. Quand Capacitor sera intégré :

```javascript
// src/lib/activities/adapters/NativeBackgroundLocationAdapter.js
import { BackgroundGeolocation } from '@capacitor-community/background-geolocation';

export class NativeBackgroundLocationAdapter {
  async requestPermission() {
    const result = await BackgroundGeolocation.requestPermissions();
    return result.granted ? 'granted' : 'denied';
  }

  async start() {
    await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'FitMatch suit votre activité',
        backgroundTitle: 'Suivi GPS actif',
        requestPermissions: false,
        stale: false,
        distanceFilter: 5,
      },
      (location) => {
        const point = {
          lat: location.latitude,
          lon: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.time,
          altitude: location.altitude,
          speed: location.speed,
        };
        this.subscribers.forEach((cb) => cb(point));
      }
    );
  }

  // ... reste de l'implémentation
}
```

### 4. Détection automatique de la plateforme

```javascript
// src/lib/activities/locationTracker.js
import { Capacitor } from '@capacitor/core';
import { WebGeolocationAdapter } from './adapters/WebGeolocationAdapter';
// Import conditionnel futur :
// import { NativeBackgroundLocationAdapter } from './adapters/NativeBackgroundLocationAdapter';

export function createLocationTracker() {
  const adapter = Capacitor.isNativePlatform()
    ? new NativeBackgroundLocationAdapter()  // Future
    : new WebGeolocationAdapter();           // Actuel
  
  // ... reste du code identique
}
```

## Migration progressive

1. **Phase 1 (actuelle)** : Web uniquement, géolocalisation limitée
2. **Phase 2** : Intégration Capacitor, test sur Android/iOS
3. **Phase 3** : Ajout du plugin natif, tests de suivi en arrière-plan
4. **Phase 4** : Optimisations (batterie, précision, notifications)

## Avertissement utilisateur

L'avertissement suivant est affiché sur la page de démarrage d'activité GPS :

> **Mode GPS Web**
> 
> FitMatch utilise la géolocalisation web du navigateur. Pour une meilleure précision en arrière-plan, utilisez l'application native (disponible prochainement).

Cet avertissement sera retiré une fois que l'application native Capacitor sera déployée.

## Considérations techniques

### Batterie
- Le suivi GPS en continu consomme beaucoup de batterie
- Le plugin natif permet des optimisations (distanceFilter, intervalle adaptatif)
- Offrir un mode "économie de batterie" (précision réduite, intervalles plus longs)

### Confidentialité
- Toujours demander la permission explicite avant de démarrer le suivi
- Afficher une notification permanente pendant le suivi (requis Android 8+)
- Offrir des options de rognage du tracé (début/fin masqués)
- Visibilité par défaut : PRIVÉ

### Performance
- Ne pas stocker tous les points GPS en RAM
- Utiliser IndexedDB pour la queue de points en attente de sync
- Simplifier le tracé avant envoi (algorithme Douglas-Peucker)
- Sync batch toutes les 20s max

### Résilience
- Gérer les pertes de connexion (mode offline)
- Persister l'état local en continu (IndexedDB)
- Permettre la récupération après crash/fermeture
- Gestion des conflits (serveur vs local)

## Références

- [Capacitor Documentation](https://capacitorjs.com/)
- [Background Geolocation Plugin](https://github.com/capacitor-community/background-geolocation)
- [MDN Web Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
