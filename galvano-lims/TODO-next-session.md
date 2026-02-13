# TODO - Next Session

1. Zweryfikować na danych produkcyjnych scenariusz zmiany kodu typu procesu (rename code) i wpływ na istniejące procesy.
2. Dodać testy API dla `/processes/types` (CRUD + blokada usunięcia typu używanego przez proces).
3. Dodać test UI dla panelu administratora typów procesów (dodanie/edycja/usunięcie).
4. Rozważyć blokadę tworzenia procesu dla nieaktywnego typu także w UI (obecnie backend już to waliduje).
5. Ujednolicić mapowanie kolorów badge typów procesów tak, by było konfigurowalne (nie tylko fallback dla domyślnych kodów).
