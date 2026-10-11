"""Komut satırı: python3 arac.py <komut> ...

  analiz   KORPUS -o profil.json      korpustan ölçülmüş stil profili
  olc      DOSYA                      prozodi + klişe + stil + özgünlük, tek rapor
  prozodi  DOSYA                      hece, kafiye/redif, paralel kıta, vurgu
  klise    DOSYA                      kara liste + yapısal YZ izleri
  stil     DOSYA                      taslağı profille kıyasla
  ozgun    DOSYA                      korpus ve imza kancalarıyla örtüşme
  ornekle  --sorgu METİN              temaya en yakın korpus şarkıları
  uygula   DOSYA DEGISIKLIK.json      yalnız gösterilen dizeleri değiştir
  kes-olc  ONCE SONRA                 kesme turunun oranı
  hakem-cifti DOSYA                   kör A/B çifti (gerçek + taslak)
  ham      --baslik B --sorgu METİN   base modelden ham taslak (SOZ_BASE_URL)
  yaz      --tema METİN               API ile uçtan uca boru hattı

Profil ve korpus varsayılanı eklenti kökündeki profiller/sezen-aksu.json ve
korpus/ dizinidir; --profil ve --korpus ile değişir.
"""

import argparse
import json
import sys
from pathlib import Path

from . import klise, ozgunluk, prozodi, stil
from .duzenle import hakem_cifti, kesme_olc, uygula, yaz
from .ornekleme import ornek_metni, ornekle
from .veri import KOK, korpus_oku

VARSAYILAN_PROFIL = KOK / "profiller" / "sezen-aksu.json"
VARSAYILAN_KORPUS = KOK / "korpus"


def _profil(yol):
    return json.loads(Path(yol).read_text(encoding="utf-8"))


def _oku(yol):
    return Path(yol).read_text(encoding="utf-8")


def _cikti(veri, metin, args):
    if getattr(args, "json", False):
        print(json.dumps(veri, ensure_ascii=False, indent=2))
    else:
        print(metin)


def olc_hepsi(metin: str, profil: dict, korpus: list[dict]) -> tuple[dict, str]:
    p = prozodi.analiz(metin, profil)
    k = klise.tara(metin, profil)
    s = stil.karsilastir(profil, metin)
    o = ozgunluk.denetle(metin, korpus)
    veri = {"prozodi": p, "klise": k, "stil": s["satirlar"], "ozgunluk": o}
    metin = "\n\n".join([prozodi.rapor_metni(p), klise.rapor_metni(k),
                         stil.kiyas_metni(s), ozgunluk.rapor_metni(o)])
    return veri, metin


def main(argv=None):
    ap = argparse.ArgumentParser(prog="soz", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--profil", default=str(VARSAYILAN_PROFIL))
    ap.add_argument("--korpus", default=str(VARSAYILAN_KORPUS))
    alt = ap.add_subparsers(dest="komut", required=True)

    a = alt.add_parser("analiz")
    a.add_argument("dizin")
    a.add_argument("-o", "--cikti", required=True)
    a.add_argument("--ad", default="Yazar")
    a.add_argument("--referans", help="karşılaştırma korpusu (imza sözcükler için)")

    for ad in ("olc", "prozodi", "klise", "stil", "ozgun"):
        p = alt.add_parser(ad)
        p.add_argument("dosya")
        p.add_argument("--json", action="store_true")

    o = alt.add_parser("ornekle")
    o.add_argument("--sorgu", required=True)
    o.add_argument("-k", type=int, default=6)
    o.add_argument("-o", "--cikti")

    u = alt.add_parser("uygula")
    u.add_argument("dosya")
    u.add_argument("degisiklik")
    u.add_argument("-o", "--cikti")

    k = alt.add_parser("kes-olc")
    k.add_argument("once")
    k.add_argument("sonra")

    h = alt.add_parser("hakem-cifti")
    h.add_argument("dosya")
    h.add_argument("-o", "--cikti", required=True)
    h.add_argument("--anahtar", required=True)
    h.add_argument("--tohum", type=int)

    hm = alt.add_parser("ham")
    hm.add_argument("--baslik", required=True)
    hm.add_argument("--sorgu", required=True)
    hm.add_argument("-n", type=int, default=2)
    hm.add_argument("-o", "--cikti", required=True, help="dizin")

    y = alt.add_parser("yaz")
    y.add_argument("--tema", required=True)
    y.add_argument("--cikti", default="sarkilar")
    y.add_argument("--kuru", action="store_true", help="API çağırmadan istemleri yaz")
    y.add_argument("--taslak-modelleri", default="opus:sade,opus:cesur,sonnet:sade,fable:cesur")
    y.add_argument("--tur", type=int, default=2, help="hakem/revizyon tur sayısı")

    args = ap.parse_args(argv)

    if args.komut == "analiz":
        sarkilar = korpus_oku(args.dizin)
        if not sarkilar:
            sys.exit(f"{args.dizin} içinde şarkı yok (.txt/.md)")
        ref = [s["metin"] for s in korpus_oku(args.referans)] if args.referans else None
        profil = stil.profil_cikar(sarkilar, args.ad, ref)
        if Path(args.profil).exists():
            eski = _profil(args.profil)
            for anahtar in ("zanaat_notlari", "kacinilacak_basliklar"):
                if anahtar in eski:
                    profil[anahtar] = eski[anahtar]
        yaz(args.cikti, json.dumps(profil, ensure_ascii=False, indent=2) + "\n")
        print(f"{len(sarkilar)} şarkı ölçüldü → {args.cikti}")
        return

    if args.komut in ("olc", "prozodi", "klise", "stil", "ozgun"):
        metin = _oku(args.dosya)
        profil = _profil(args.profil)
        if args.komut == "olc":
            veri, rapor = olc_hepsi(metin, profil, korpus_oku(args.korpus))
        elif args.komut == "prozodi":
            veri = prozodi.analiz(metin, profil)
            rapor = prozodi.rapor_metni(veri)
        elif args.komut == "klise":
            veri = klise.tara(metin, profil)
            rapor = klise.rapor_metni(veri)
        elif args.komut == "stil":
            veri = stil.karsilastir(profil, metin)
            rapor = stil.kiyas_metni(veri)
        else:
            veri = ozgunluk.denetle(metin, korpus_oku(args.korpus))
            rapor = ozgunluk.rapor_metni(veri)
        _cikti(veri, rapor, args)
        return

    if args.komut == "ornekle":
        korpus = korpus_oku(args.korpus)
        if not korpus:
            print(f"korpus boş ({args.korpus}); örnek yok. Profilin zanaat notlarıyla devam edin.")
            return
        secilen = ornekle(korpus, args.sorgu, args.k)
        metin = ornek_metni(secilen)
        if args.cikti:
            yaz(args.cikti, metin + "\n")
            print("\n".join(f"{s['puan']:.3f}  {s['baslik']}" for s in secilen))
        else:
            print(metin)
        return

    if args.komut == "uygula":
        yeni, notlar = uygula(_oku(args.dosya), json.loads(_oku(args.degisiklik)))
        yaz(args.cikti or args.dosya, yeni)
        print("\n".join(notlar))
        return

    if args.komut == "kes-olc":
        print(json.dumps(kesme_olc(_oku(args.once), _oku(args.sonra)), ensure_ascii=False))
        return

    if args.komut == "hakem-cifti":
        korpus = korpus_oku(args.korpus)
        if not korpus:
            print("korpus boş: hakem tek metinli adli mod ile çalışmalı")
            sys.exit(3)
        taslak = _oku(args.dosya)
        gercek = ornekle(korpus, taslak, 3)
        cift, anahtar = hakem_cifti(taslak, gercek[0], args.tohum)
        yaz(args.cikti, cift)
        yaz(args.anahtar, json.dumps(anahtar, ensure_ascii=False) + "\n")
        print(f"çift → {args.cikti}; anahtar → {args.anahtar} (hakeme gösterme)")
        return

    if args.komut == "ham":
        from .llm import ham_ses
        korpus = korpus_oku(args.korpus)
        if not korpus:
            sys.exit("ham ses için korpus gerekir: base model örneklerin devamını yazar")
        taslaklar = ham_ses(ornekle(korpus, args.sorgu, 6), args.baslik, args.n)
        if not taslaklar:
            sys.exit("SOZ_BASE_URL ve SOZ_BASE_MODEL tanımlı değil; ham ses adımı atlandı")
        for i, t in enumerate(taslaklar, 1):
            yaz(Path(args.cikti) / f"ham-{i}.txt", t)
        print(f"{len(taslaklar)} ham taslak → {args.cikti}")
        return

    if args.komut == "yaz":
        from .boru_hatti import calistir
        calistir(tema=args.tema, cikti=args.cikti, profil_yolu=args.profil, korpus_yolu=args.korpus,
                 kuru=args.kuru, taslak_modelleri=args.taslak_modelleri, tur=args.tur)
        return


if __name__ == "__main__":
    main()
