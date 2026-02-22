# TODO - Next Session

1. Zweryfikować na danych produkcyjnych scenariusz zmiany kodu typu procesu (rename code) i wpływ na istniejące procesy.
2. Dodać testy API dla `/processes/types` (CRUD + blokada usunięcia typu używanego przez proces).
3. Dodać test UI dla panelu administratora typów procesów (dodanie/edycja/usunięcie).
4. Rozważyć blokadę tworzenia procesu dla nieaktywnego typu także w UI (obecnie backend już to waliduje).
5. Ujednolicić mapowanie kolorów badge typów procesów tak, by było konfigurowalne (nie tylko fallback dla domyślnych kodów).

## TODO - Nowe funkcjonalnosci (przypisane)

1. [PO] Zdefiniowac wymagania i priorytet dla modulu urzadzen laboratoryjnych oraz harmonogramu kalibracji/przegladow.
2. [BE] Dodac encje `lab_devices` + pola kalibracyjne (ostatnia kalibracja, interwal, nastepna kalibracja, odpowiedzialny, status).
3. [BE] Dodac encje `device_maintenance_logs` (historia kalibracji/przegladow z zalacznikami certyfikatow).
4. [FE] Dodac widoki: lista urzadzen, karta urzadzenia, kalendarz/harmonogram terminow.
5. [BE] Dodac mechanizm alertow terminow kalibracji (30/14/7 dni i po terminie).
6. [QA] Przygotowac testy scenariuszy kalibracji (w terminie, zbliza sie termin, po terminie, brak danych).

7. [BE] Dodac encje `orders` (zlecenia klienta) i relacje klient -> zlecenie -> probki -> analizy.
8. [FE] Dodac mozliwosc grupowania probek w ramach jednego zlecenia klienta.
9. [FE] Dodac widok zbiorczy zlecenia (probki, analizy, statusy, cena).
10. [PO] Zdefiniowac statusy zlecenia i reguly przejsc (nowe, w toku, zakonczone, zafakturowane).
11. [QA] Przygotowac testy procesu obslugi zlecenia od utworzenia po zamkniecie.

12. [BE] Dodac automatyczne wyliczanie ceny zlecenia na podstawie analiz przypisanych do probek.
13. [BE] Dodac obsluge rabatu/narzutu recznego z pelnym audytem zmian.
14. [FE] Dodac prezentacje ceny: suma, skladniki, rabat/narzut, wartosc koncowa.
15. [QA] Zweryfikowac przeliczenia ceny po kazdej zmianie analiz i liczby probek.

16. [PO] Okreslic zasady biznesowe cennika analiz (wersjonowanie, aktywnosc, waluta, netto/brutto).
17. [BE] Dodac modul `analysis_price_list` z wersjonowaniem cen (effective_from) i blokada edycji historycznych danych.
18. [FE] Dodac panel administracyjny do zarzadzania cennikiem analiz.
19. [QA] Przygotowac testy regresji dla zmian cennika i poprawnosci wyceny archiwalnych zlecen.

20. [Lab/Technolog] Zdefiniowac reguly korekty reagentow dla odchylen (ile dodac / 100 l, per parametr).
21. [BE] Dodac silnik rekomendacji korekty reagentow na podstawie odchylen i konfiguracji.
22. [FE] Dodac prezentacje rekomendacji w ekranie analiz + mozliwosc potwierdzenia/edycji decyzji operatora.
23. [QA] Dodac testy graniczne dla rekomendacji (odchylenie minimalne, duze, brak reguly, przekroczenie bezpiecznego zakresu).
