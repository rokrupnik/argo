# Argo ⛵

Družinska aplikacija za sledenje investicijam na IBKR računih — zame in za tri sinove.
Lokalna PWA: vsi podatki ostanejo na napravi (IndexedDB), cene pa se dnevno osvežujejo
z Ljubljanske borze prek GitHub Actions.

## Funkcionalnosti

- **4 profili** (Rok, Simon, Jakob, Andrej) z velikim, otrokom prijaznim vmesnikom v slovenščini
- **Vplačila, dvigi in stroški** — seznam + dodajanje/urejanje/brisanje
- **Trgovanje** — nakupi/prodaje z instrumentom, količino, ceno in provizijo
- **Graf v slogu IBKR** z obdobji 1T / MTD / 1M / 3M / YTD / 1L / Vse in zavihki:
  - **Vrednost** — vrednost računa (gotovina + tržna vrednost pozicij) po dnevih
  - **Donos** — časovno utežen donos (TWR) v %
  - **Primerjava** — portfelj proti scenariju »brez trgovanja« (samo neto vplačila)
- **Primerjava vseh** — večlinijski graf vrednosti vseh štirih računov skozi čas
  (gumb na začetnem zaslonu); računi so odprti 8. 5. 2026 (privzeto ob prvem zagonu)
- **Varnostna kopija** — izvoz/uvoz vseh podatkov v JSON
- **Ročni vnos cen** za instrumente, ki jih feed ne pokriva

## Arhitektura cen

Brskalnik ne more klicati API-ja LJSE neposredno (ni CORS glav), zato:

1. `scripts/fetch-prices.mjs` povleče zgodovino cen za vse instrumente iz
   `public/instruments.json` prek `rest.ljse.si` (žeton se prebere iz HTML-ja strani).
2. Workflow `prices.yml` to požene vsak trgovalni dan ob 16:05 UTC in spremembe commita.
3. Workflow `deploy.yml` (ob pushu in po urniku) zgradi aplikacijo — ob buildu se cene
   še enkrat sveže povlečejo — in jo objavi na GitHub Pages.
4. Aplikacija bere `prices/{ticker}.json` z lastnega izvora in jih hrani v IndexedDB,
   zato deluje tudi offline.

Nov instrument dodaš tako, da ga vpišeš v `public/instruments.json` (ticker, name, mic,
isin — glej ICSLO za primer). Instrument brez `mic`/`isin` se preskoči pri feedu in
zanj vnašaš cene ročno v Nastavitvah.

## Razvoj

```bash
npm install
npm run dev            # http://localhost:5173/argo/
node scripts/fetch-prices.mjs   # ročna osvežitev cen v public/prices/
npm run build          # produkcijski build v dist/
```

## Prva namestitev (GitHub Pages)

1. V nastavitvah repozitorija na GitHubu: **Settings → Pages → Source: GitHub Actions**.
2. Push na `main` sproži deploy; aplikacija bo na `https://rokrupnik.github.io/argo/`.
3. Na telefonu odpri ta URL v Safariju/Chromu in izberi **Add to Home Screen**
   (Dodaj na začetni zaslon) — aplikacija se namesti kot PWA.

## Opombe

- Vse vrednosti so v EUR; račun se začne z 0 € na datum odprtja (nastavljiv v Nastavitvah).
- Podatki so samo na napravi — redno delaj izvoz varnostne kopije.
- TWR obravnava vplačila/dvige kot zunanje tokove, stroški in provizije pa znižujejo donos.
