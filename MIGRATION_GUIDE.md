# Guide de Migration - Template API Enterprise

Ce guide explique comment migrer depuis l'ancienne version du template API vers la nouvelle version Enterprise.

## 🎯 Changements Majeurs

### 1. Architecture

#### Avant : Architecture simple
```
src/
├── controllers/
├── services/
├── models/
└── routes/
```

#### Après : Clean Architecture + DDD
```
src/
├── domain/           # Entities, Value Objects, Domain Events
├── application/      # Use Cases, CQRS (Command/Query Bus)
├── infrastructure/   # Persistence, Auth, External APIs
└── interface/        # Controllers, DTOs, Presenters
```

### 2. Nouveaux Concepts

#### Domain Events
```typescript
// Avant : Service appelle directement
await emailService.sendWelcomeEmail(user);

// Après : Event découplé
const event = DomainEventBuilder.create()
  .withType('USER_CREATED')
  .withAggregate(user.id, 'User')
  .withPayload({ email: user.email })
  .build();

await globalEventBus.publish(event);

// Handler séparé
globalEventBus.subscribe('USER_CREATED', async (event) => {
  await emailService.sendWelcomeEmail(event.payload.email);
});
```

#### CQRS (Command Query Responsibility Segregation)
```typescript
// Command (Write)
const command = CommandBuilder.create()
  .withType('CREATE_USER')
  .withPayload({ name, email, password })
  .build();

const result = await globalCommandBus.execute(command);

// Query (Read)
const query = QueryBuilder.create()
  .withType('GET_USER')
  .withPayload({ userId })
  .build();

const result = await globalQueryBus.execute(query);
```

#### Value Objects
```typescript
// Avant : Primitives
const userId = '123e4567-e89b-12d3-a456-426614174000';
const email = 'user@example.com';

// Après : Value Objects typesafe
import { UUID, Email } from './domain/shared/value-object';

const userId = new UUID(); // Auto-generated
const email = new Email('user@example.com'); // Validation auto

// Immutables
const newDate = dateTime.addDays(7);
```

### 3. Sécurité Enterprise

#### RBAC (Role-Based Access Control)
```typescript
// Définir des rôles
const adminRole = await rbacService.createRole({
  name: 'admin',
  permissions: [
    { resource: 'users', action: 'manage', scope: 'all' },
    { resource: 'settings', action: 'manage', scope: 'all' },
  ],
});

// Assigner à un utilisateur
await rbacService.assignRoleToUser(userId, adminRole.id, adminUserId);

// Vérifier les permissions
const decision = await rbacService.checkPermission(
  userId,
  { resource: 'users', action: 'read', scope: 'all' }
);

if (decision.granted) {
  // Allow access
}
```

#### Rate Limiting
```typescript
// Configuration globale
import { createRateLimitMiddleware } from './infrastructure/security/rate-limiter';

const rateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  strategy: 'sliding-window',
});

// Usage dans Express
app.use('/api/', async (req, res, next) => {
  const { allowed, headers } = await rateLimit(req.ip);
  
  res.set(headers);
  
  if (!allowed) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  next();
});
```

#### OAuth2/OIDC
```typescript
import { GoogleOAuthProvider } from './infrastructure/auth/oauth2-providers';

const googleProvider = new GoogleOAuthProvider({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/google/callback',
});

// Générer l'URL d'autorisation
const state = generateRandomState();
const authUrl = googleProvider.getAuthorizationUrl(state);

// Échanger le code contre des tokens
const tokens = await googleProvider.exchangeCode(code);

// Récupérer les infos utilisateur
const userInfo = await googleProvider.getUserInfo(tokens.accessToken);
```

### 4. Observabilité

#### Structured Logging
```typescript
import { getDefaultLogger, JSONFormatter, FileTransport } from './infrastructure/logging/logger';

// Logger par défaut
const logger = getDefaultLogger();

logger.info('User created', { userId: '123', email: 'user@example.com' });
logger.error('Database connection failed', { error }, error);

// Logger enfant avec contexte
const requestLogger = logger.child({ requestId: 'req-123', userId: '456' });
requestLogger.info('Processing request');

// Configuration custom
import { Logger, PrettyFormatter, LogLevel } from './infrastructure/logging/logger';

const customLogger = new Logger({
  level: LogLevel.DEBUG,
  formatter: process.env.NODE_ENV === 'production' 
    ? new JSONFormatter() 
    : new PrettyFormatter(),
  transports: [
    new ConsoleTransport(),
    new FileTransport('./logs/app.log'),
  ],
  serviceName: 'my-service',
  environment: process.env.NODE_ENV,
});
```

## 🔧 Migration Checklist

### 1. Mettre à jour le CLI

```bash
# Rebuild le CLI avec les nouvelles features
cd /path/to/TemplateAPI
npm install
npm run build
```

### 2. Créer un nouveau projet

```bash
# Utiliser le nouveau générateur
node dist/cli/index.js my-migrated-api \
  --language typescript \
  --features auth,userCrud \
  --data-providers prisma \
  --package-manager npm
```

### 3. Migrer les données (si applicable)

```bash
cd my-migrated-api

# Installer les dépendances
npm install

# Configurer la base de données
# Copier .env.example vers .env et configurer DATABASE_URL

# Générer le client Prisma
npm run db:generate

# Créer et appliquer les migrations
npm run db:migrate

# (Optionnel) Seeder les données
npm run db:seed
```

### 4. Vérifier et tester

```bash
# Lancer les tests
npm run test

# Lancer en mode développement
npm run dev

# Vérifier les endpoints
curl http://localhost:3000/health
```

### 5. Déployer

```bash
# Build pour production
npm run build

# Démarrer en production
npm start

# Ou utiliser Docker
docker build -t my-api .
docker run -p 3000:3000 --env-file .env my-api
```

## 📚 Documentation Complémentaire

- [Architecture Decision Records](./docs/adr)
- [API Documentation](./docs/api)
- [Deployment Guide](./docs/deployment.md)
- [Contributing Guide](./CONTRIBUTING.md)

## 🆘 Support

Si tu rencontres des problèmes lors de la migration :

1. Vérifie que tu utilises Node.js 18+
2. Supprime `node_modules` et réinstalle
3. Vérifie les logs d'erreur détaillés
4. Ouvre une issue sur GitHub

---

**Bon courage avec ta migration !** 🚀
