# GalvanoTech LIMS

System zarządzania laboratorium (LIMS) dla firmy chemicznej z branży galwanotechniki.
Służy do zarządzania próbkami i analizami kąpieli galwanicznych klientów.

## Stack technologiczny

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend:** Node.js + Express + TypeScript
- **Baza danych:** PostgreSQL + Prisma ORM
- **Autentykacja:** JWT (access + refresh tokens)
- **PDF:** PDFKit
- **Email:** Nodemailer (SMTP)
- **Walidacja:** Zod
- **i18n:** react-i18next (PL/EN)

## Wymagania

- Node.js 18+
- PostgreSQL 14+ (lub Docker)
- npm 9+

## Szybki start z Docker

```bash
docker-compose up -d
```

Aplikacja będzie dostępna pod:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432

## Wdrożenie na Debian VPS

Gotowa konfiguracja produkcyjna z Docker Compose, prywatną siecią usług i
automatycznym HTTPS przez Caddy znajduje się w [DEPLOYMENT.md](DEPLOYMENT.md).

## Uruchomienie lokalne (development)

### 1. Baza danych

Uruchom PostgreSQL (np. przez Docker):

```bash
docker run -d \
  --name galvano-postgres \
  -e POSTGRES_DB=galvano_lims \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Backend

```bash
cd server
cp .env.example .env    # Skonfiguruj zmienne środowiskowe
npm install
npx prisma migrate dev  # Utworzenie tabel w bazie
npx prisma db seed      # Załadowanie danych przykładowych
npm run dev             # Uruchomienie serwera (port 3001)
```

### 3. Frontend

```bash
cd client
npm install
npm run dev             # Uruchomienie (port 5173)
```

### 4. Otwórz przeglądarkę

Przejdź do http://localhost:5173

## Dane logowania (seed)

| Rola     | Email                              | Hasło      |
|----------|------------------------------------|------------|
| Admin    | admin@galvano-lims.pl              | Admin123!  |
| Laborant | anna.nowak@galvano-lims.pl         | Laborant1! |
| Laborant | piotr.wisniewski@galvano-lims.pl   | Laborant1! |
| Viewer   | viewer@galvano-lims.pl             | Viewer123! |

## Funkcjonalności

### Panel główny (Dashboard)
- Widżety statystyk: próbki, analizy, odchylenia krytyczne
- Lista ostatnich analiz
- Alerty o parametrach krytycznych
- Szybkie akcje

### Zarządzanie klientami
- CRUD klientów z wyszukiwaniem
- Historia próbek i analiz klienta
- Eksport do CSV

### Procesy galwaniczne
- Predefiniowane procesy: cynkowanie kwaśne/alkaliczne, niklowanie Wattsa, chromowanie, miedziowanie, cynowanie, pasywacja
- Edytor parametrów rekomendowanych (min/max/optimum)
- Klonowanie procesów

### Próbki
- Rejestracja z automatycznym kodem (PRB-YYYYMM-XXXX)
- Workflow statusów: REGISTERED → IN_PROGRESS → COMPLETED
- Filtrowanie po statusie, kliencie, procesie, dacie

### Analizy laboratoryjne
- Formularz wyników z automatycznym ładowaniem parametrów z procesu
- Automatyczne obliczanie odchyleń od wartości rekomendowanych
- Kolorowe oznaczenie wyników:
  - 🟢 W normie
  - 🟡 Poza zakresem (±10-20%)
  - 🔴 Krytyczne odchylenie (>20%)
- Rekomendacje korekcyjne
- Zatwierdzanie przez administratora

### Archiwum i wykresy
- Wykresy trendów parametrów w czasie (Recharts)
- Linie odniesienia min/max/optimum
- Wykres odchyleń (bar chart)
- Eksport danych do CSV

### Raporty PDF
- Profesjonalny szablon z logo firmy
- Tabela wyników z kolorowaniem
- Sekcja rekomendacji
- Podpisy i stopka
- Wysyłanie emailem

### Import danych historycznych
- Kreator importu krok po kroku (6 kroków)
- Obsługiwane formaty: CSV, Excel, JSON, XML
- Automatyczne mapowanie kolumn (fuzzy matching)
- Walidacja przed importem (dry run)
- Szablony mapowania wielokrotnego użytku
- Możliwość cofnięcia importu

### Panel administracyjny
- Zarządzanie użytkownikami i rolami
- Konfiguracja firmy i SMTP
- Dziennik audytu

### Dodatkowe
- Tryb ciemny/jasny
- Lokalizacja PL/EN
- Responsywność (tablet/mobile)
- Wyszukiwanie globalne

## Struktura projektu

```
galvano-lims/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components (layout, common, ui)
│   │   ├── pages/       # Route pages
│   │   ├── hooks/       # Custom hooks
│   │   ├── services/    # API calls
│   │   ├── store/       # Zustand stores
│   │   ├── types/       # TypeScript types
│   │   ├── utils/       # Helpers
│   │   └── locales/     # i18n translations (pl, en)
│   └── Dockerfile
├── server/              # Express backend
│   ├── src/
│   │   ├── routes/      # Express routes
│   │   ├── controllers/ # Request handlers
│   │   ├── services/    # Business logic
│   │   ├── middleware/   # Auth, validation, error handling
│   │   ├── utils/       # Utilities
│   │   └── prisma/      # Schema + seed
│   └── Dockerfile
├── shared/              # Shared types
├── docker-compose.yml
└── README.md
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Logowanie
- `POST /api/auth/register` - Rejestracja (admin)
- `POST /api/auth/refresh` - Odświeżenie tokena
- `GET /api/auth/me` - Dane zalogowanego użytkownika

### Clients
- `GET /api/clients` - Lista klientów
- `GET /api/clients/:id` - Szczegóły klienta
- `POST /api/clients` - Dodanie klienta
- `PUT /api/clients/:id` - Aktualizacja
- `DELETE /api/clients/:id` - Dezaktywacja

### Processes
- `GET /api/processes` - Lista procesów
- `POST /api/processes` - Dodanie procesu
- `POST /api/processes/:id/clone` - Klonowanie

### Samples
- `GET /api/samples` - Lista próbek
- `POST /api/samples` - Rejestracja próbki
- `PATCH /api/samples/:id/status` - Zmiana statusu

### Analyses
- `GET /api/analyses` - Lista analiz
- `POST /api/analyses` - Nowa analiza
- `POST /api/analyses/:id/results` - Zapis wyników
- `PATCH /api/analyses/:id/approve` - Zatwierdzenie

### Reports
- `POST /api/reports/generate/:analysisId` - Generowanie PDF
- `GET /api/reports/:id/download` - Pobranie PDF
- `POST /api/reports/:id/send-email` - Wysłanie emailem

### Import
- `POST /api/import/upload` - Upload pliku
- `POST /api/import/validate` - Walidacja (dry run)
- `POST /api/import/execute` - Wykonanie importu
- `POST /api/import/jobs/:id/rollback` - Cofnięcie importu

## Licencja

Oprogramowanie własnościowe. Wszelkie prawa zastrzeżone.
