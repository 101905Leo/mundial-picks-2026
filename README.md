# Mundial Picks 2026

Aplicacion web de quiniela para el Mundial 2026, sin apuestas con dinero real.

## Stack

- Next.js con React
- API routes de Next.js
- PostgreSQL
- Prisma ORM
- Autenticacion con numero celular, contrasena y JWT en cookie HTTP-only

## Funciones incluidas

- Registro e inicio de sesion.
- Calendario de partidos.
- Predicciones de marcador antes del inicio del partido.
- Puntos automaticos:
  - Marcador exacto: 5 puntos
  - Ganador correcto: 3 puntos
  - Diferencia de goles correcta: 2 puntos
  - Participacion: 1 punto
- Ranking global.
- Ligas privadas con codigo de invitacion.
- Ranking por liga.
- Panel administrador para crear partidos, cargar resultados y recalcular puntos.
- Importacion automatica del calendario de la Copa Mundial de la FIFA 2026™.
- Cron automatico en Vercel para actualizar resultados reales y recalcular puntos.
- Notificaciones por WhatsApp para actualizaciones del administrador, si configuras WhatsApp Cloud API.
- Inscripcion unica con Wompi por 50.000 COP.
- Premio visible de 1.000.000 COP.

## Estructura

```txt
prisma/
  schema.prisma        Modelos de base de datos
  seed.ts              Datos iniciales y usuario admin
src/
  app/
    api/               Endpoints backend
    globals.css        Estilos globales
    layout.tsx         Layout raiz
    page.tsx           App principal
  components/          Componentes reutilizables
  lib/                 Prisma, auth, validadores y scoring
```

## Endpoints principales

```txt
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

GET  /api/matches
POST /api/predictions
GET  /api/rankings

GET  /api/leagues
POST /api/leagues
POST /api/leagues/join
GET  /api/leagues/:id/ranking

POST /api/admin/matches
PUT  /api/admin/matches/:id/result
POST /api/admin/recalculate
POST /api/admin/import-worldcup-calendar
GET  /api/cron/update-results

POST /api/entry/create-checkout
POST /api/entry/confirm
POST /api/entry/events
```

## Correr localmente

1. Instala dependencias:

```bash
npm install
```

2. Crea el archivo de entorno:

```bash
cp .env.example .env
```

3. Levanta PostgreSQL con Docker:

```bash
docker compose up -d
```

4. Crea las tablas:

```bash
npm run prisma:migrate -- --name init
```

5. Carga datos iniciales:

```bash
npm run seed
```

6. Inicia la app:

```bash
npm run dev
```

Abre `http://localhost:3000`.

## App nativa iOS/Android

La app esta preparada con Capacitor. Como el proyecto usa Next.js API routes, PostgreSQL, Prisma y Wompi, la app nativa debe apuntar a una version publicada de la web con HTTPS. El celular no lleva la base de datos dentro.

1. Publica la web en una URL HTTPS, por ejemplo:

```txt
https://tu-dominio.com
```

2. Sincroniza la app nativa apuntando a esa URL:

```bash
CAPACITOR_SERVER_URL="https://tu-dominio.com" npm run native:sync
```

3. Para abrir iOS en Xcode:

```bash
npm run native:open:ios
```

4. Para abrir Android en Android Studio:

```bash
npm run native:open:android
```

Para probar contra tu Mac en la misma red WiFi, puedes usar temporalmente la URL de red que muestra Next, por ejemplo:

```bash
CAPACITOR_SERVER_URL="http://192.168.1.22:3000" npm run native:sync
```

En produccion usa siempre HTTPS.

## Usuario administrador inicial

```txt
Celular: 3008588571
Contrasena: admin123
```

Cambialo antes de usar el proyecto en un entorno real.

## Notificaciones por WhatsApp

La app esta preparada para usar WhatsApp Cloud API de Meta. Necesitas una cuenta de WhatsApp Business, un `PHONE_NUMBER_ID` y un access token con permiso `whatsapp_business_messaging`.

Agrega estos valores en `.env`:

```txt
WHATSAPP_ACCESS_TOKEN="..."
WHATSAPP_PHONE_NUMBER_ID="..."
WHATSAPP_GRAPH_API_VERSION="v24.0"
WHATSAPP_DEFAULT_COUNTRY_CODE="57"
WHATSAPP_NOTIFY_ONLY_PHONE="3008588571"
WORLD_CUP_2026_SCHEDULE_URL="https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
```

Si `WHATSAPP_NOTIFY_ONLY_PHONE` queda vacio, la app intentara notificar a todos los celulares registrados. Para mensajes fuera de la ventana de 24 horas, WhatsApp puede exigir plantillas aprobadas por Meta.

## Cargar calendario automaticamente

Entra como administrador y presiona **Cargar calendario Mundial 2026**. La app descarga el calendario desde OpenFootball y crea o actualiza los partidos sin duplicarlos.

## Automatizar resultados y puntos

El proyecto incluye `vercel.json` con un Cron Job que llama cada 30 minutos a:

```txt
GET /api/cron/update-results
```

Esa ruta consulta API-Football, actualiza resultados reales, recalcula puntos y envia notificacion por WhatsApp si hubo resultados nuevos.

Variables necesarias en Vercel:

```txt
API_FOOTBALL_KEY="..."
API_FOOTBALL_LEAGUE_ID="1"
API_FOOTBALL_SEASON="2026"
CRON_SECRET="una-clave-larga-y-secreta"
```

Tambien puedes seguir usando el boton manual **Actualizar resultados reales** desde el panel administrador.

Fuente de datos por defecto:

```txt
https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
```

## Inscripcion con Wompi

Los usuarios pueden registrarse e iniciar sesion. Para guardar picks necesitan pagar una inscripcion unica de 50.000 COP. El admin no necesita pagar inscripcion.

Agrega estos valores en `.env`:

```txt
NEXT_PUBLIC_APP_URL="http://localhost:3000"
WOMPI_PUBLIC_KEY="pub_test_..."
WOMPI_PRIVATE_KEY="prv_test_..."
WOMPI_EVENTS_SECRET="test_events_..."
WOMPI_INTEGRITY_SECRET="test_integrity_..."
WOMPI_ENVIRONMENT="sandbox"
ENTRY_FEE_COP="50000"
PRIZE_AMOUNT_COP="1000000"
```

`ENTRY_FEE_COP="50000"` cobra 50.000 COP por la inscripcion unica. `PRIZE_AMOUNT_COP="1000000"` documenta el premio visible de 1.000.000 COP.

Configura en Wompi la URL de eventos:

```txt
http://localhost:3000/api/entry/events
```

En produccion debe ser HTTPS.
