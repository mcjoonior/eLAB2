# Dokumentacja użytkownika
## GalvanoTech LIMS

Wersja dokumentu: 1.0  
Stan aplikacji na podstawie analizy kodu: 12.02.2026

## 1. Przeznaczenie systemu
GalvanoTech LIMS to system do obsługi laboratorium galwanotechnicznego. Umożliwia:
- prowadzenie kartotek klientów,
- definiowanie procesów galwanicznych i parametrów referencyjnych,
- rejestrację próbek,
- wykonywanie analiz laboratoryjnych,
- ocenę odchyleń od zakresów referencyjnych,
- generowanie i wysyłkę raportów PDF,
- import danych historycznych,
- przegląd archiwum i trendów.

## 2. Dostęp do systemu
### 2.1. Logowanie
1. Otwórz ekran logowania.
2. Wprowadź e-mail i hasło.
3. Kliknij **Zaloguj**.

Po poprawnym logowaniu użytkownik trafia na **Dashboard**.

### 2.2. Dane startowe (seed)
W obecnym seedzie aplikacji dostępne jest konto:
- `admin@galvano-lims.pl` / `Admin123!`

## 3. Role i uprawnienia
System rozróżnia role:
- `ADMIN`
- `LABORANT`
- `VIEWER`

Zakres funkcji administracyjnych (tylko `ADMIN`):
- Zarządzanie użytkownikami,
- Ustawienia firmy/SMTP/raportów,
- Dziennik audytu,
- Zatwierdzanie analiz (`COMPLETED -> APPROVED`).

Pozostałe moduły biznesowe (klienci, procesy, próbki, analizy, raporty, import, archiwum) wymagają zalogowania i są dostępne z poziomu interfejsu dla zwykłych użytkowników.

## 4. Układ interfejsu
### 4.1. Pasek boczny
Główne sekcje:
- Dashboard
- Klienci
- Procesy
- Próbki
- Analizy
- Archiwum
- Raporty
- Import
- (dla `ADMIN`) Użytkownicy, Ustawienia, Audit Log

### 4.2. Górny pasek
- wyszukiwarka globalna,
- szybkie akcje (nowa próbka / nowa analiza),
- zmiana języka PL/EN,
- przełącznik motywu jasny/ciemny,
- powiadomienia,
- wylogowanie.

## 5. Moduły systemu
### 5.1. Dashboard
Pokazuje:
- statystyki próbek (dzień/tydzień/miesiąc),
- analizy w toku i zakończone,
- liczbę krytycznych odchyleń,
- tabelę ostatnich analiz (z przejściem do szczegółu).

### 5.2. Klienci
Funkcje:
- lista klientów z wyszukiwaniem,
- dodawanie i edycja klienta,
- dezaktywacja klienta,
- eksport CSV.

W szczególe klienta:
- edycja danych firmy,
- zakładka próbek klienta,
- zakładka analiz klienta.

### 5.3. Procesy galwaniczne
Funkcje:
- lista procesów,
- filtrowanie po typie procesu,
- dodanie procesu,
- edycja procesu,
- klonowanie procesu,
- dezaktywacja procesu.

Każdy proces może mieć listę parametrów z:
- nazwą,
- jednostką,
- wartością minimalną,
- wartością maksymalną,
- wartością optymalną,
- kolejnością sortowania.

### 5.4. Próbki
Funkcje:
- rejestracja próbki,
- automatyczny kod `PRB-YYYYMM-XXXX`,
- filtrowanie po statusie, kliencie, procesie i datach,
- zmiana statusu z listy i ze szczegółu.

Workflow statusów próbek:
- `REGISTERED -> IN_PROGRESS` lub `CANCELLED`
- `IN_PROGRESS -> COMPLETED` lub `CANCELLED`
- `COMPLETED` i `CANCELLED` to statusy końcowe

W szczególe próbki można utworzyć analizę powiązaną z próbką.

### 5.5. Analizy
Funkcje listy:
- filtrowanie po statusie i dacie,
- tworzenie nowej analizy,
- przejście do szczegółu analizy.

Nowa analiza:
- wybór próbki (z listy próbek `REGISTERED`),
- wybór typu analizy,
- notatki.

Automatyczny kod analizy:
- `ANL-YYYYMM-XXXX`

W szczególe analizy:
- edycja danych analizy (jeśli niezatwierdzona),
- wpisywanie wyników,
- automatyczne liczenie odchyleń,
- dodawanie rekomendacji,
- dodawanie załączników zdjęciowych,
- generowanie raportu PDF,
- wysyłka raportu e-mailem,
- (ADMIN) zatwierdzanie analizy.

Workflow statusów analiz:
- `PENDING -> IN_PROGRESS`
- `IN_PROGRESS -> COMPLETED` lub `REJECTED`
- `COMPLETED -> APPROVED` lub `REJECTED`
- `REJECTED -> IN_PROGRESS`
- `APPROVED` to status końcowy

Ważne reguły:
- zatwierdzić można tylko analizę `COMPLETED` z zapisanymi wynikami,
- analizy `APPROVED` nie można edytować ani modyfikować wyników.

### 5.6. Archiwum
Zakładki:
- **Trend**: wykresy liniowe parametrów w czasie,
- **Odchylenia**: statystyki odchyleń,
- **Tabela**: tabela archiwalnych analiz.

Dostępne akcje:
- filtrowanie (klient, proces, parametr, zakres dat),
- eksport CSV,
- eksport wykresu trendu do PNG.

### 5.7. Raporty
Funkcje:
- lista wygenerowanych raportów,
- pobieranie PDF,
- wysyłka raportu e-mailem (adres domyślny lub wpisany ręcznie).

Automatyczny kod raportu:
- `RPT-YYYYMM-XXXX`

Raport można wygenerować tylko dla analizy:
- `COMPLETED` lub `APPROVED`,
- z co najmniej jednym wynikiem.

### 5.8. Import danych
Kreator importu ma 6 kroków:
1. Upload pliku,
2. Mapowanie kolumn,
3. Transformacje,
4. Walidacja,
5. Import,
6. Podsumowanie.

Obsługiwane formaty:
- CSV, TSV, XLSX, XLS, JSON, XML

Funkcje:
- podgląd danych,
- mapowanie kolumn na pola systemowe,
- zapisywanie szablonów mapowania,
- walidacja przed wykonaniem,
- import właściwy,
- historia zadań importu,
- rollback importu.

### 5.9. Panel administracyjny
#### Użytkownicy
- lista użytkowników,
- dodanie użytkownika,
- edycja użytkownika,
- dezaktywacja użytkownika,
- przypisanie roli.

#### Ustawienia
Zakładki:
- dane firmy,
- SMTP,
- ustawienia raportów.

Dodatkowo:
- upload logo,
- test połączenia SMTP.

#### Audit log
- lista zdarzeń,
- filtrowanie po akcji, typie encji i dacie,
- śledzenie kto i kiedy wykonał operacje.

## 6. Wyszukiwanie globalne
Wyszukiwarka (min. 2 znaki) przeszukuje:
- klientów,
- próbki,
- analizy,
- procesy.

Wynik przenosi bezpośrednio do odpowiedniego szczegółu rekordu.

## 7. Typowe scenariusze pracy
### 7.1. Od próbki do raportu
1. Dodaj klienta (jeśli nie istnieje).
2. Sprawdź/utwórz proces z parametrami.
3. Zarejestruj próbkę.
4. Utwórz analizę dla próbki.
5. Zapisz wyniki i rekomendacje.
6. Zmień status analizy na `COMPLETED`.
7. (ADMIN) zatwierdź analizę.
8. Wygeneruj raport PDF.
9. Wyślij raport e-mailem do klienta.

### 7.2. Import danych historycznych
1. Wejdź w **Import**.
2. Wgraj plik.
3. Zmapuj kolumny.
4. Uruchom walidację i popraw błędy krytyczne.
5. Wykonaj import.
6. Sprawdź wynik w historii zadań i w razie potrzeby wykonaj rollback.

## 8. Limity i walidacje
- Hasło użytkownika: min. 8 znaków, mała i wielka litera, cyfra, znak specjalny.
- Upload logo: do 5 MB.
- Upload importu: do 50 MB.
- Załączniki analizy: do 10 plików, do 10 MB każdy, formaty obrazów.
- Pola obowiązkowe zależą od formularza (np. klient/proces przy próbce).

## 9. Najczęstsze problemy
- Brak uprawnień do sekcji administracyjnych: zaloguj się kontem `ADMIN`.
- Nie można wygenerować raportu: sprawdź, czy analiza ma status `COMPLETED`/`APPROVED` i zapisane wyniki.
- Nie można zatwierdzić analizy: status musi być `COMPLETED`.
- Nie można zmienić statusu: workflow dopuszcza tylko określone przejścia.
- Błędy importu: uruchom walidację i popraw mapowanie/formaty danych.

## 10. Słownik statusów
### 10.1. Próbki
- `REGISTERED` - zarejestrowana
- `IN_PROGRESS` - w trakcie
- `COMPLETED` - zakończona
- `CANCELLED` - anulowana

### 10.2. Analizy
- `PENDING` - oczekuje
- `IN_PROGRESS` - w trakcie
- `COMPLETED` - zakończona
- `APPROVED` - zatwierdzona
- `REJECTED` - odrzucona

### 10.3. Odchylenia wyników
- `WITHIN_RANGE` - w zakresie
- `BELOW_MIN` - poniżej minimum
- `ABOVE_MAX` - powyżej maksimum
- `CRITICAL_LOW` - krytycznie nisko
- `CRITICAL_HIGH` - krytycznie wysoko

