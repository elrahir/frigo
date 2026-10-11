"""Uçtan uca boru hattı (Claude API ile). Claude Code içinde aynı adımları
skills/sarki-yaz/SKILL.md alt ajanlarla yürütür.

 1 profil      ölçülmüş stil profili (profiller/*.json)
 2 örnekleme   temaya en yakın korpus şarkıları
 3 fikir       Verbalized Sampling ile 10 konsept, düşük olasılıklı + somut seçilir
 4 detay       sahneye ait 15–20 somut ayrıntı
 5 taslaklar   farklı model ve yaklaşımlarla 3–5 taslak (+ varsa base model)
 6 ölçüm       her taslağa prozodi, klişe, stil, özgünlük raporu
 7 baş editör  gövde seçimi ve aşı
 8 turlar      prozodi onarımı → klişe editörü → "hangisi gerçek?" hakemi → revizyon
 9 kesme       yüzde 15–20
10 son ölçüm   kalan prozodi ihlali onarılır, rapor yazılır
"""

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import klise, ozgunluk, prozodi, stil
from .duzenle import hakem_cifti, json_bul, kesme_olc, uygula, yaz
from .llm import Istemci, ham_ses
from .ornekleme import ornek_metni, ornekle
from .turkce import kucult, sozcukler
from .veri import korpus_oku


def sarki_bul(yanit: str) -> str:
    m = re.search(r"```sarki\s*\n(.*?)```", yanit, re.S)
    metin = m.group(1) if m else yanit
    return metin.strip() + "\n"


def numarali(metin: str) -> str:
    return "\n".join(f"{i:>3}| {s}" for i, s in enumerate(metin.splitlines(), 1))


def profil_metni(profil: dict) -> str:
    o = profil["olcumler"]
    h = o["dize_hece"]
    parcalar = [f"## Profil: {profil['ad']} ({profil.get('kaynak', '?')})"]
    if profil.get("kaynak") == "tohum":
        parcalar.append("(Sayılar tahmini tohum değerlerdir; korpus ölçülünce güncellenir.)")
    parcalar.append(
        f"Sayılar: dize başına hece ort. {h['ort']} (p05 {h['p05']}, p95 {h['p95']}); "
        f"şarkı başına benzersiz dize {o['sarki_benzersiz_dize']['p10']}–{o['sarki_benzersiz_dize']['p90']}; "
        f"zamir (binde) ben {o['zamir_binde']['ben']}, sen {o['zamir_binde']['sen']}; "
        f"hitap eden dize oranı {o['hitap_dize_orani']}; soru {o['soru_dize_orani']}; ünlem {o['unlem_dize_orani']}; "
        f"uyaklı dize {o['uyakli_dize_orani']}; 'gibi' binde {o['gibi_binde']}.")
    alanlar = ", ".join(f"{k} {v}" for k, v in list(o["imge_alanlari_binde"].items())[:8])
    parcalar.append(f"İmge alanları (binde): {alanlar}.")
    if profil.get("bicim"):
        parcalar.append("Biçim: " + "; ".join(f"{k}: {v}" for k, v in profil["bicim"].items()))
    if profil.get("imza_sozcukler"):
        parcalar.append("İmza sözcükler: " + ", ".join(x["sozcuk"] for x in profil["imza_sozcukler"][:30]))
    if profil.get("zanaat_notlari"):
        parcalar.append("Zanaat notları:\n" + "\n".join(f"- {n}" for n in profil["zanaat_notlari"]))
    if profil.get("kacinir"):
        parcalar.append("Kaçındıkları:\n" + "\n".join(f"- {n}" for n in profil["kacinir"]))
    if profil.get("yasak_sozcukler"):
        parcalar.append("Hiç kullanmadığı sözcükler: " + ", ".join(profil["yasak_sozcukler"]))
    return "\n\n".join(parcalar)


def konsept_sec(veri: dict) -> dict:
    """Somutluğu 4+ olanlar arasından olasılığı en düşük olan; yoksa ajanın önerisi."""
    ks = veri["konseptler"]
    aday = [k for k in ks if k.get("somutluk", 0) >= 4]
    if aday:
        return min(aday, key=lambda k: k.get("olasilik", 1))
    oneri = veri.get("oneri", {}).get("no")
    return next((k for k in ks if k.get("no") == oneri), ks[0])


def konsept_metni(k: dict) -> str:
    return (f"Çalışma başlığı: {k.get('calisma_basligi')}\nDurum: {k.get('durum')}\n"
            f"Somut çekirdek: {k.get('somut_cekirdek')}\nHitap: {k.get('hitap')}\nTon: {k.get('ton')}")


def olc_rapor(metin: str, profil: dict, korpus: list[dict]) -> tuple[dict, str]:
    p = prozodi.analiz(metin, profil)
    k = klise.tara(metin, profil)
    s = stil.karsilastir(profil, metin)
    o = ozgunluk.denetle(metin, korpus)
    return ({"prozodi": p, "klise": k, "stil": s, "ozgunluk": o},
            "\n\n".join([prozodi.rapor_metni(p), klise.rapor_metni(k), stil.kiyas_metni(s),
                         ozgunluk.rapor_metni(o)]))


def calistir(tema: str, cikti: str, profil_yolu: str, korpus_yolu: str, kuru: bool = False,
             taslak_modelleri: str = "opus:sade,opus:cesur,sonnet:sade,fable:cesur", tur: int = 2) -> Path:
    ad = "-".join(sozcukler(kucult(tema))[:4]) or "sarki"
    dizin = Path(cikti) / f"{time.strftime('%Y%m%d-%H%M')}-{ad}"
    dizin.mkdir(parents=True, exist_ok=True)
    gunluk = []

    def not_(s):
        print(s, flush=True)
        gunluk.append(s)

    profil = json.loads(Path(profil_yolu).read_text(encoding="utf-8"))
    korpus = korpus_oku(korpus_yolu)
    ist = Istemci(kuru, dizin / "istemler")
    pmetin = profil_metni(profil)
    not_(f"profil: {profil['ad']} ({profil.get('kaynak')}); korpus: {len(korpus)} şarkı")

    # 3 fikir
    basliklar = ", ".join(s["baslik"] for s in ornekle(korpus, tema, 12)) if korpus else "(korpus yok)"
    fikir = json_bul(ist.sor("fikir", f"Tema / istek: {tema}\n\n{pmetin}\n\nKorpustan yakın şarkı adları: {basliklar}"))
    yaz(dizin / "01-konseptler.json", json.dumps(fikir, ensure_ascii=False, indent=2))
    konsept = konsept_sec(fikir)
    kmetin = konsept_metni(konsept)
    not_(f"konsept: {konsept.get('calisma_basligi')} (olasılık {konsept.get('olasilik')}, somutluk {konsept.get('somutluk')})")

    # 2 dinamik örnekleme (konsepte göre)
    secilen = ornekle(korpus, f"{tema}\n{kmetin}", 6)
    ornekler = ornek_metni(secilen) if secilen else "(Korpus yok; profilin zanaat notlarına dayan.)"
    if secilen:
        not_("örnekler: " + ", ".join(s["baslik"] for s in secilen))

    # 4 detay
    detay = json_bul(ist.sor("detay", f"{kmetin}\n\n{pmetin}"))
    yaz(dizin / "02-detaylar.json", json.dumps(detay, ensure_ascii=False, indent=2))
    dmetin = "\n".join(f"- {d['detay']} ({d.get('tur', '')}, {d.get('zaman', '')})" for d in detay["detaylar"])
    dmetin += "\n\nKlişe ayrıntılar (kullanma): " + "; ".join(detay.get("klise_ayrintilar", []))

    # 5 çoklu taslak
    def taslak_yaz(spec):
        model, _, yaklasim = spec.partition(":")
        mesaj = (f"Yaklaşım: {yaklasim or 'sade'}\n\n# Konsept\n{kmetin}\n\n# Detay bankası\n{dmetin}\n\n"
                 f"# Profil\n{pmetin}\n\n# Örnekler\n{ornekler}")
        return spec, sarki_bul(ist.sor("taslak", mesaj, model=model))

    with ThreadPoolExecutor(max_workers=4) as havuz:
        taslaklar = list(havuz.map(taslak_yaz, [s.strip() for s in taslak_modelleri.split(",") if s.strip()]))
    for ham in ham_ses(secilen, konsept.get("calisma_basligi", "Yeni"), 2):
        taslaklar.append(("base:ham", ham))
    paket = []
    for i, (spec, metin) in enumerate(taslaklar, 1):
        yaz(dizin / "03-taslaklar" / f"{i:02d}-{spec.replace(':', '-')}.txt", metin)
        _, rapor = olc_rapor(metin, profil, korpus)
        yaz(dizin / "03-taslaklar" / f"{i:02d}-{spec.replace(':', '-')}.rapor.txt", rapor)
        paket.append(f"## Taslak {i} ({spec})\n\n{metin}\n\n### Ölçüm\n\n{rapor}")
    not_(f"{len(taslaklar)} taslak yazıldı")

    # 7 baş editör
    yanit = ist.sor("bas-editor", f"# Profil\n{pmetin}\n\n# Konsept\n{kmetin}\n\n" + "\n\n".join(paket))
    sarki = sarki_bul(yanit)
    yaz(dizin / "04-birlesik.txt", sarki)
    yaz(dizin / "04-editor-gerekce.md", yanit.split("```")[0].strip() + "\n")

    def duzelt(ajan, metin, mesaj):
        degisiklik = json_bul(ist.sor(ajan, mesaj))
        yeni, notlar = uygula(metin, degisiklik)
        for n in notlar:
            not_(f"  {ajan}: {n}")
        return yeni

    # 8 turlar
    for t in range(1, tur + 1):
        p = prozodi.analiz(sarki, profil)
        if p["ozet"]["ihlal"]:
            ihlaller = "\n".join(f"- satır {x['satir']} [{x['onem']}/{x['tur']}]: {x['aciklama']}" for x in p["ihlaller"])
            sarki = duzelt("prozodi", sarki, f"# Şarkı\n{numarali(sarki)}\n\n# Prozodi raporu\n{prozodi.rapor_metni(p)}\n\n# İhlaller\n{ihlaller}")
        k = klise.tara(sarki, profil)
        if k["isaretler"] or k["genel"]:
            sarki = duzelt("klise", sarki, f"# Şarkı\n{numarali(sarki)}\n\n# Klişe avcısı\n{klise.rapor_metni(k)}\n\n# Detay bankası\n{dmetin}\n\n{pmetin}")
        if korpus:
            cift, anahtar = hakem_cifti(sarki, ornekle(korpus, sarki, 1)[0])
            hk = json_bul(ist.sor("hakem", cift))
            hk["dogru_mu"] = hk.get("tahmin") is not None and anahtar.get(hk["tahmin"]) == "taslak"
        else:
            hk = json_bul(ist.sor("hakem", f"Adli mod. Metin:\n\n{sarki}"))
        yaz(dizin / f"05-hakem-tur{t}.json", json.dumps(hk, ensure_ascii=False, indent=2))
        izler = [x for x in hk.get("izler", []) if x.get("agirlik") in ("yuksek", "orta")]
        not_(f"tur {t}: hakem {hk.get('mod')} güven {hk.get('guven')}, {len(izler)} önemli iz")
        if not izler:
            break
        notlar = "\n".join(f"- «{x['dize']}» — {x['iz']}: {x['neden']} → {x.get('oneri', '')}" for x in izler)
        korunacak = "\n".join(f"- {d}" for d in hk.get("insan_gibi", []))
        sarki = duzelt("taslak", sarki, f"revizyon\n\n# Şarkı\n{numarali(sarki)}\n\n# Hakemin yapay zekâ izleri\n{notlar}\n\n"
                                         f"# Koru (insan gibi duran dizeler)\n{korunacak}\n\n# Detay bankası\n{dmetin}\n\n{pmetin}")
        yaz(dizin / f"06-revizyon-tur{t}.txt", sarki)

    # 9 kesme
    once = sarki
    for deneme in range(2):
        ek = "" if deneme == 0 else f"\n\nİlk denemede kesilen oran %{olcu['kesilen_yuzde']}; hedef %15–20."
        kesik = sarki_bul(ist.sor("kesici", f"{once}{ek}"))
        olcu = kesme_olc(once, kesik)
        if 10 <= olcu["kesilen_yuzde"] <= 25 or kuru:
            break
    not_(f"kesme: %{olcu['kesilen_yuzde']} ({olcu['sozcuk_once']} → {olcu['sozcuk_sonra']} sözcük)")
    sarki = kesik
    yaz(dizin / "07-kesilmis.txt", sarki)

    # 10 son ölçüm
    p = prozodi.analiz(sarki, profil)
    if p["ozet"]["ihlal"]:
        ihlaller = "\n".join(f"- satır {x['satir']} [{x['onem']}/{x['tur']}]: {x['aciklama']}" for x in p["ihlaller"])
        sarki = duzelt("prozodi", sarki, f"# Şarkı\n{numarali(sarki)}\n\n# İhlaller\n{ihlaller}")
    yaz(dizin / "son.txt", sarki)
    _, rapor = olc_rapor(sarki, profil, korpus)
    yaz(dizin / "son.rapor.txt", rapor)
    yaz(dizin / "gunluk.txt", "\n".join(gunluk) + "\n")
    not_(f"bitti → {dizin / 'son.txt'}")
    return dizin
