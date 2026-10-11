"""Prozodi aracı: hece sayımı, kafiye/redif, uyak şeması, vurgu, ihlaller.

Ölçü kodla tutulur; LLM yalnız burada ihlal çıkan dizeyi yeniden yazar.
İhlal ("ihlal") onarılır, uyarı ("uyari") editöre bilgi olarak gider.
"""

from .sarki import Sarki, ayristir
from .turkce import (UNLULER, dize_hece, dize_hece_kaynasmali, dize_son_vurgu,
                     sade, sozcukler)

# Redif sayılabilecek ekler (yüzey biçimleri). En uzun önce denenir.
EKLER = sorted(set("""
yorum yorsun yoruz yorsunuz yorlar yordu yordum yordun yorduk yor
acağım eceğim acaksın eceksin acağız eceğiz acak ecek
mışım mişim muşum müşüm mışsın mişsin muşsun müşsün mış miş muş müş
dım dim dum düm tım tim tum tüm dın din dun dün tın tin tun tün
dık dik duk dük tık tik tuk tük dı di du dü tı ti tu tü
sınız siniz sunuz sünüz sın sin sun sün
yım yim yum yüm ım im um üm yız yiz yuz yüz ız iz uz üz
ları leri ların lerin larım lerim lar ler
ndan nden dan den tan ten nda nde da de ta te
yla yle la le yken ken
nı ni nu nü yı yi yu yü
nın nin nun nün ın in un ün
sı si su sü mı mi mu mü
""".split()), key=len, reverse=True)


def _ortak_son(a: str, b: str) -> str:
    i = 0
    while i < min(len(a), len(b)) and a[-1 - i] == b[-1 - i]:
        i += 1
    return a[len(a) - i:] if i else ""


def _unlu_var(s: str) -> bool:
    return any(c in UNLULER for c in s)


def kafiye(a: str, b: str) -> dict:
    """İki dize sonunun redif ve kafiye çözümlemesi.

    redif: sondaki aynı sözcükler ve aynı görevdeki ekler;
    kafiye: rediften önceki ses benzerliği. tur: yok | yarim | tam |
    zengin | ayni-sozcuk | tekrar."""
    wa = [sade(s) for s in sozcukler(a)]
    wb = [sade(s) for s in sozcukler(b)]
    if not wa or not wb:
        return {"redif": "", "kafiye": "", "tur": "yok"}
    k = 0
    while k < min(len(wa), len(wb)) and wa[-1 - k] == wb[-1 - k]:
        k += 1
    redif_soz = wa[len(wa) - k:] if k else []
    if k == len(wa) or k == len(wb):
        return {"redif": " ".join(redif_soz), "kafiye": "", "tur": "tekrar"}
    x, y = wa[-1 - k], wb[-1 - k]
    redif_ek = ""
    while True:
        for ek in EKLER:
            if (x.endswith(ek) and y.endswith(ek) and _unlu_var(x[:-len(ek)])
                    and _unlu_var(y[:-len(ek)])):
                x, y = x[:-len(ek)], y[:-len(ek)]
                redif_ek = ek + redif_ek
                break
        else:
            break
    redif = " ".join(filter(None, ["-" + redif_ek if redif_ek else "", *redif_soz]))
    if x == y:
        return {"redif": redif, "kafiye": x, "tur": "ayni-sozcuk"}
    ses = _ortak_son(x, y)
    tur = "yok" if not ses else "yarim" if len(ses) == 1 else "tam" if len(ses) == 2 else "zengin"
    return {"redif": redif, "kafiye": ses, "tur": tur}


def uyakli(a: str, b: str) -> bool:
    k = kafiye(a, b)
    if k["tur"] in ("tam", "zengin", "ayni-sozcuk", "tekrar"):
        return True
    return bool(k["redif"])


def uyak_semasi(dizeler: list[str]) -> str:
    harfler, sema = "abcdefghijklmnopqrstuvwxyz", []
    sonraki = 0
    for i, d in enumerate(dizeler):
        for j in range(i):
            if uyakli(dizeler[j], d):
                sema.append(sema[j])
                break
        else:
            sema.append(harfler[sonraki % 26])
            sonraki += 1
    return "".join(sema)


_AD = {"kita": "kıtadaki", "nakarat": "nakarattaki"}


def _sinirlar(profil: dict | None) -> tuple[int, int]:
    try:
        h = profil["olcumler"]["dize_hece"]
        return int(h["p05"]), int(h["p95"])
    except (TypeError, KeyError):
        return 4, 14


def _aralik_farki(a: tuple[int, int], b: tuple[int, int]) -> int:
    """İki hece aralığı (kaynaşmalı en az, yazılı) arasındaki boşluk."""
    if a[0] <= b[1] and b[0] <= a[1]:
        return 0
    return min(abs(a[0] - b[1]), abs(b[0] - a[1]))


def analiz(metin: str, profil: dict | None = None, tolerans: int = 1) -> dict:
    sarki: Sarki = ayristir(metin)
    alt, ust = _sinirlar(profil)
    bolumler, ihlaller = [], []

    def ekle(onem, tur, dize, aciklama):
        ihlaller.append({"onem": onem, "tur": tur, "satir": dize.satir,
                         "dize": dize.metin, "aciklama": aciklama})

    for i, b in enumerate(sarki.bolumler):
        satirlar = []
        for d in b.dizeler:
            h, hk = dize_hece(d.metin), dize_hece_kaynasmali(d.metin)
            satirlar.append({"satir": d.satir, "dize": d.metin, "hece": h, "hece_min": hk,
                             "son_vurgu": dize_son_vurgu(d.metin)})
            if b.tekrar:
                continue
            if hk > ust:
                ekle("ihlal", "uzun", d, f"{h} hece (kaynaşmayla {hk}); üst sınır {ust}")
            elif h < alt:
                ekle("uyari", "kisa", d, f"{h} hece; alt sınır {alt}")
        metinler = [d.metin for d in b.dizeler]
        sema = uyak_semasi(metinler)
        bolumler.append({"sira": i, "tur": b.tur, "ad": b.ad, "tekrar": b.tekrar,
                         "uyak_semasi": sema, "dizeler": satirlar})
        if not b.tekrar and len(metinler) >= 3 and len(set(sema)) == len(sema):
            onem = "uyari"
            ekle(onem, "uyaksiz", b.dizeler[-1],
                 f"{b.ad or b.tur} bölümünde hiç uyak/redif yok (şema {sema})")
        if not b.tekrar and len(b.dizeler) >= 4:
            hs = [s["hece"] for s in satirlar]
            if max(hs) - min(hs) > 6:
                ekle("uyari", "dengesiz", b.dizeler[hs.index(max(hs))],
                     f"bölüm içinde hece farkı {max(hs) - min(hs)} ({min(hs)}–{max(hs)})")

    # Paralel bölümler aynı ezgiye oturur: ilk örnek ölçüdür.
    for tur in ("kita", "nakarat"):
        grup = [(b, bolumler[i]) for i, b in enumerate(sarki.bolumler)
                if b.tur == tur and not b.tekrar]
        if len(grup) < 2:
            continue
        ref_b, ref_r = grup[0]
        for b, r in grup[1:]:
            if len(b.dizeler) != len(ref_b.dizeler):
                ekle("uyari", "kita-uzunlugu", b.dizeler[0],
                     f"{b.ad or tur}: {len(b.dizeler)} dize, ilk {tur} {len(ref_b.dizeler)} dize")
            for j, (d, s) in enumerate(zip(b.dizeler, r["dizeler"])):
                rs = ref_r["dizeler"][j]
                fark = _aralik_farki((s["hece_min"], s["hece"]), (rs["hece_min"], rs["hece"]))
                if fark > tolerans:
                    ekle("ihlal", "paralel", d,
                         f"{s['hece']} hece; ilk {_AD[tur]} karşılığı ({rs['dize']!r}) "
                         f"{rs['hece']} hece — aynı ezgiye oturmaz")
                if s["son_vurgu"] != rs["son_vurgu"] and "?" not in (s["son_vurgu"], rs["son_vurgu"]):
                    ekle("uyari", "vurgu", d,
                         f"dize sonu vurgusu '{s['son_vurgu']}', karşılığı '{rs['son_vurgu']}' (yaklaşık)")

    tum = [d for b in sarki.bolumler if not b.tekrar for d in b.dizeler]
    ozet = {
        "baslik": sarki.baslik,
        "bolum": len(sarki.bolumler),
        "dize": len(tum),
        "benzersiz_dize": len(sarki.benzersiz_dizeler()),
        "ortalama_hece": round(sum(dize_hece(d.metin) for d in tum) / len(tum), 2) if tum else 0,
        "sinirlar": [alt, ust],
        "ihlal": sum(1 for x in ihlaller if x["onem"] == "ihlal"),
        "uyari": sum(1 for x in ihlaller if x["onem"] == "uyari"),
    }
    return {"ozet": ozet, "bolumler": bolumler, "ihlaller": ihlaller}


def rapor_metni(sonuc: dict) -> str:
    o = sonuc["ozet"]
    satirlar = [f"PROZODİ — {o['baslik'] or '(başlıksız)'}",
                f"{o['bolum']} bölüm, {o['dize']} dize ({o['benzersiz_dize']} benzersiz), "
                f"ortalama {o['ortalama_hece']} hece, sınır {o['sinirlar'][0]}–{o['sinirlar'][1]}; "
                f"{o['ihlal']} ihlal, {o['uyari']} uyarı", ""]
    for b in sonuc["bolumler"]:
        bas = f"[{b['ad'] or b['tur']}]" + (" (tekrar)" if b["tekrar"] else "") + f"  şema {b['uyak_semasi']}"
        satirlar.append(bas)
        for s, harf in zip(b["dizeler"], b["uyak_semasi"]):
            hece = f"{s['hece']}" if s["hece"] == s["hece_min"] else f"{s['hece']}/{s['hece_min']}"
            satirlar.append(f"  {s['satir']:>3} {hece:>5} {harf} {s['son_vurgu']:<4} {s['dize']}")
        satirlar.append("")
    if sonuc["ihlaller"]:
        satirlar.append("İHLALLER VE UYARILAR")
        for x in sonuc["ihlaller"]:
            satirlar.append(f"  [{x['onem']}] satır {x['satir']} ({x['tur']}): {x['aciklama']}")
            satirlar.append(f"      {x['dize']}")
    return "\n".join(satirlar)
