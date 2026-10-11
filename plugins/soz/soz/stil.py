"""Ölçülmüş stil profili: korpustan sayılar çıkarır, taslağı profille kıyaslar.

"Melankolik ve şiirsel" gibi tarifler yerine dize başına hece, zamir oranları,
imge alanları, imza sözcükler ve hiç kullanılmayan sözcükler. Kip ve hitap
ölçümleri ek kalıplarına bakar; yaklaşıktır ama aynı ölçüt profile ve taslağa
uygulandığı için kıyas tutarlıdır.
"""

import math
import re
import statistics
from collections import Counter

from .klise import soyut_mu
from .prozodi import uyak_semasi
from .sarki import ayristir
from .turkce import UNLULER, dize_hece, kucult, sade, sozcukler
from .veri import alanlar, durak, klise_listesi

ZAMIRLER = {
    "ben": "ben beni bana benim bende benden benimle bence".split(),
    "sen": "sen seni sana senin sende senden seninle sence".split(),
    "o": "o onu ona onun onda ondan onunla".split(),
    "biz": "biz bizi bize bizim bizde bizden bizimle".split(),
    "siz": "siz sizi size sizin sizde sizden sizinle".split(),
    "onlar": "onlar onları onlara onların onlarda onlardan onlarla".split(),
}
_ZAMIR = {f: ad for ad, formlar in ZAMIRLER.items() for f in formlar}
_SORU_SOZ = set("ne neden niye niçin nasıl nerede nereye nereden kim kimi kime kimin hani hangi kaç".split())
_SORU_EK = re.compile(r"^m[ıiuü](?:yım|yim|yum|yüm|sın|sin|sun|sün|yız|yiz|yuz|yüz|ydı|ydi|ydu|ydü|ymış|ymiş)?$")
# Seslenme sözcükleri: dize bunlardan birini taşıyorsa birine konuşuyordur.
_SESLENME = set("""abla abi ağabey kızım oğlum anne anneciğim ana anam baba babacığım canım
gülüm hanım teyze dayı amca kardeşim yavrum kuzum sevgilim güzelim efendim bacım
bacı komşu hey ey be""".split())
_UNLEM = set("ah of vah hey be ya eyvah aman hadi haydi yahu oy hay vay eh öf tüh ey hu".split())
_IKINCI = re.compile(r"(?:sın|sin|sun|sün|sınız|siniz|sunuz|sünüz)$")
KIPLER = {
    "gecmis_di": re.compile(r"..(?:d|t)[ıiuü](?:m|n|k|nız|niz|nuz|nüz|lar|ler)?$"),
    "gecmis_mis": re.compile(r"..m[ıiuü]ş(?:ım|im|um|üm|sın|sin|sun|sün|ız|iz|uz|üz|lar|ler)?$"),
    "simdiki": re.compile(r"..yor(?:um|sun|uz|sunuz|lar|du|dum|dun|duk|muş)?$"),
    "gelecek": re.compile(r"..(?:a|e)(?:c|ğ)(?:a|e)(?:k|ğ)(?:ım|im|sın|sin|ız|iz|lar|ler|tı|ti)?$"),
    "genis": re.compile(r"...(?:ar|er|ır|ir|ur|ür|maz|mez)(?:ım|im|um|üm|sın|sin|sun|sün|ız|iz|uz|üz|lar|ler|dı|di)?$"),
}
_KIP_DISI = {"kadın", "adın", "kedi", "şimdi", "hadi", "haydi", "yedi", "kendi", "kardeş",
             "biraz", "beraber", "yer", "her", "bir", "kar", "nar", "dar", "var", "yar",
             "kır", "sır", "bazen", "deniz", "ateş", "ömür", "nur", "kapı", "akşam"}


def _yuzde(liste, p):
    if not liste:
        return 0
    s = sorted(liste)
    k = (len(s) - 1) * p / 100
    a, b = math.floor(k), math.ceil(k)
    return round(s[a] + (s[b] - s[a]) * (k - a), 2)


def _dagilim(liste):
    if not liste:
        return {"ort": 0, "std": 0, "p05": 0, "p10": 0, "p50": 0, "p90": 0, "p95": 0}
    return {"ort": round(statistics.fmean(liste), 2),
            "std": round(statistics.pstdev(liste), 2),
            **{f"p{p:02d}": _yuzde(liste, p) for p in (5, 10, 50, 90, 95)}}


def olc(metinler: list[str]) -> dict:
    """Bir ya da çok şarkının sayısal stil ölçümleri."""
    dize_heceler, kita_dize, benzersiz, tekrar_oranlari = [], Counter(), [], []
    uyakli_dize = toplam_kita_dize = 0
    sozler: list[str] = []
    dizeler: list[str] = []
    for metin in metinler:
        sarki = ayristir(metin)
        tum = sarki.dizeler(tekrarlar=True)
        ozgun = sarki.benzersiz_dizeler()
        if not tum:
            continue
        benzersiz.append(len(ozgun))
        tekrar_oranlari.append(round(1 - len(ozgun) / len(tum), 3))
        for b in sarki.bolumler:
            if b.tekrar:
                continue
            kita_dize[len(b.dizeler)] += 1
            sema = uyak_semasi([d.metin for d in b.dizeler])
            say = Counter(sema)
            uyakli_dize += sum(1 for h in sema if say[h] > 1)
            toplam_kita_dize += len(sema)
        for d in ozgun:
            dizeler.append(d)
            dize_heceler.append(dize_hece(d))
            sozler.extend(sade(s) for s in sozcukler(d))
    n_soz = max(len(sozler), 1)
    n_dize = max(len(dizeler), 1)
    binde = lambda x: round(1000 * x / n_soz, 2)

    zamir = Counter(_ZAMIR[s] for s in sozler if s in _ZAMIR)
    hitap = soru = unlem = 0
    for d in dizeler:
        ss = [sade(s) for s in sozcukler(d)]
        if (any(_ZAMIR.get(s) in ("sen", "siz") or s in _SESLENME for s in ss)
                or any(len(s) > 4 and _IKINCI.search(s) for s in ss)):
            hitap += 1
        if "?" in d or any(s in _SORU_SOZ or _SORU_EK.match(s) for s in ss):
            soru += 1
        if "!" in d or any(re.sub(r"(.)\1+", r"\1", s) in _UNLEM for s in ss):
            unlem += 1
    alan = Counter(a for s in sozler for a in alanlar(s))
    kip = Counter()
    for s in sozler:
        if s in _KIP_DISI:
            continue
        for ad, desen in KIPLER.items():
            if desen.search(s):
                kip[ad] += 1
                break
    kip_toplam = max(sum(kip.values()), 1)
    return {
        "sarki": len(benzersiz),
        "dize": len(dizeler),
        "sozcuk": len(sozler),
        "dize_hece": _dagilim(dize_heceler),
        "sozcuk_hece": round(sum(sum(1 for c in s if c in UNLULER) for s in sozler) / n_soz, 2),
        "kita_dize": {str(k): v for k, v in sorted(kita_dize.items())},
        "sarki_benzersiz_dize": _dagilim(benzersiz),
        "tekrar_orani": round(statistics.fmean(tekrar_oranlari), 3) if tekrar_oranlari else 0,
        "uyakli_dize_orani": round(uyakli_dize / max(toplam_kita_dize, 1), 3),
        "zamir_binde": {ad: binde(zamir[ad]) for ad in ZAMIRLER},
        "hitap_dize_orani": round(hitap / n_dize, 3),
        "soru_dize_orani": round(soru / n_dize, 3),
        "unlem_dize_orani": round(unlem / n_dize, 3),
        "soyut_isim_binde": binde(sum(1 for s in sozler if soyut_mu(s))),
        "gibi_binde": binde(sozler.count("gibi")),
        "imge_alanlari_binde": {a: binde(alan[a]) for a in sorted(alan, key=alan.get, reverse=True)},
        "kip_orani": {ad: round(kip[ad] / kip_toplam, 3) for ad in KIPLER},
        "tur_sozcuk_orani": round(len(set(sozler)) / n_soz, 3),
    }


def imza_sozcukler(metinler: list[str], referans: list[str] | None = None, adet: int = 40) -> list[dict]:
    """Yazarın imza sözcükleri. Referans korpus varsa düzgünleştirilmiş log-oran,
    yoksa durak sözcükleri atılmış belge sıklığı."""
    def belgeler(ms):
        return [[sade(s) for s in sozcukler(m)] for m in ms]
    yazar = belgeler(metinler)
    tf = Counter(s for b in yazar for s in b)
    df = Counter(s for b in yazar for s in set(b))
    aday = [s for s in tf if s not in durak() and len(s) >= 3 and df[s] >= 2]
    if referans:
        ref = Counter(s for b in belgeler(referans) for s in b)
        na, nr, v = sum(tf.values()), sum(ref.values()), len(set(tf) | set(ref))
        puan = {s: math.log((tf[s] + 1) / (na + v)) - math.log((ref[s] + 1) / (nr + v)) for s in aday}
    else:
        n = max(len(yazar), 1)
        puan = {s: df[s] / n * math.log(1 + tf[s]) for s in aday}
    en = sorted(aday, key=lambda s: puan[s], reverse=True)[:adet]
    return [{"sozcuk": s, "sarki": df[s], "kez": tf[s]} for s in en]


def hic_kullanilmayan(metinler: list[str]) -> list[str]:
    """Kara listedeki tek sözcüklük kalıplardan korpusta hiç geçmeyenler."""
    sozler = {sade(s) for m in metinler for s in sozcukler(m)}
    sonuc = []
    for kalip, _, _ in klise_listesi():
        if " " in kalip:
            continue
        kok = sade(kucult(kalip.rstrip("*")))
        if kalip.endswith("*"):
            bulundu = any(s.startswith(kok) for s in sozler)
        else:
            bulundu = kok in sozler
        if not bulundu:
            sonuc.append(kalip)
    return sonuc


def profil_cikar(sarkilar: list[dict], ad: str, referans: list[str] | None = None) -> dict:
    metinler = [s["metin"] for s in sarkilar]
    return {
        "ad": ad,
        "kaynak": "olculmus",
        "aciklama": f"{len(metinler)} şarkılık korpustan ölçüldü (soz analiz).",
        "olcumler": olc(metinler),
        "imza_sozcukler": imza_sozcukler(metinler, referans),
        "yasak_sozcukler": hic_kullanilmayan(metinler),
    }


# --- Kıyas -------------------------------------------------------------

def _durum(deger, alt, ust):
    if deger < alt:
        return "↓"
    if deger > ust:
        return "↑"
    return "✓"


def karsilastir(profil: dict, metin: str) -> dict:
    p = profil["olcumler"]
    t = olc([metin])
    satirlar = []

    def ekle(ad, deger, alt, ust, yorum_az, yorum_cok, profil_metni):
        d = _durum(deger, alt, ust)
        yorum = "" if d == "✓" else (yorum_az if d == "↓" else yorum_cok)
        satirlar.append({"olcu": ad, "taslak": deger, "profil": profil_metni, "durum": d, "yorum": yorum})

    ph = p["dize_hece"]
    ekle("dize başına hece (ort.)", t["dize_hece"]["ort"], ph["ort"] - ph["std"] / 2, ph["ort"] + ph["std"] / 2,
         "dizeler profile göre kısa", "dizeler profile göre uzun; söz konuşur gibi değil yazı gibi akıyor",
         f"{ph['ort']} ± {ph['std']}")
    pb = p["sarki_benzersiz_dize"]
    ekle("benzersiz dize", t["dize"], pb["p10"], pb["p90"], "şarkı kısa", "şarkı uzun; kesme turunda budanmalı",
         f"{pb['p10']}–{pb['p90']}")
    for z in ("ben", "sen"):
        pv = p["zamir_binde"].get(z, 0)
        ekle(f"'{z}' zamiri (binde)", t["zamir_binde"][z], pv * 0.4, pv * 2.2 + 5,
             f"'{z}' sesi zayıf", f"'{z}' zamiri fazla; Türkçe zamiri ekle taşır, düşürülebilir", f"{pv}")
    for anahtar, ad, az, cok in (
            ("hitap_dize_orani", "hitap eden dize", "şarkı kimseye konuşmuyor; profil doğrudan hitap ediyor",
             "her dize hitap; biraz anlatıya yer aç"),
            ("soru_dize_orani", "soru dizesi", "hiç soru yok; profil soru sorar", "soru fazla"),
            ("unlem_dize_orani", "ünlem dizesi", "ünlem/seslenme yok", "ünlem fazla; abartı kokar"),
            ("uyakli_dize_orani", "uyaklı dize", "uyak/redif zayıf", "uyak çok sıkı; zorlama kafiye riski")):
        pv = p.get(anahtar, 0)
        ekle(ad, t[anahtar], pv * 0.5, min(1.0, pv * 1.6 + 0.05), az, cok, f"{pv}")
    pv = p.get("soyut_isim_binde", 0)
    ekle("soyut isim (binde)", t["soyut_isim_binde"], 0, pv * 1.4 + 5, "", "soyut isim fazla; duyguyu adlandırma, nesneyle göster", f"{pv}")
    pv = p.get("gibi_binde", 0)
    ekle("'gibi' (binde)", t["gibi_binde"], 0, pv * 2 + 4, "", "benzetme fazla", f"{pv}")
    pa = p.get("imge_alanlari_binde", {})
    ta = t["imge_alanlari_binde"]
    for alan, deger in ta.items():
        pv = pa.get(alan, 0)
        if alan == "soyut_duygu":
            ekle("imge: soyut_duygu (binde)", deger, 0, pv * 1.5 + 5, "", "duygu adları fazla; somut nesneye çevir", f"{pv}")
        elif pv < 1 and deger > 15:
            satirlar.append({"olcu": f"imge: {alan} (binde)", "taslak": deger, "profil": f"{pv}", "durum": "↑",
                             "yorum": "profilde neredeyse hiç olmayan bir imge alanı baskın"})
    yasak = set(profil.get("yasak_sozcukler", []))
    kullanilan = []
    for kalip in yasak:
        kok = sade(kucult(kalip.rstrip("*")))
        for s in sozcukler(metin):
            ss = sade(s)
            if (kalip.endswith("*") and ss.startswith(kok)) or ss == kok:
                kullanilan.append(s)
    if kullanilan:
        satirlar.append({"olcu": "profilin hiç kullanmadığı sözcük", "taslak": ", ".join(sorted(set(kullanilan))),
                         "profil": "0", "durum": "↑", "yorum": "yazar bunları hiç kullanmıyor"})
    return {"taslak": t, "satirlar": satirlar}


def kiyas_metni(sonuc: dict) -> str:
    satirlar = ["STİL KIYASI (taslak / profil)"]
    for s in sonuc["satirlar"]:
        satirlar.append(f"  {s['durum']} {s['olcu']}: {s['taslak']} / {s['profil']}" + (f" — {s['yorum']}" if s["yorum"] else ""))
    ta = sonuc["taslak"]["imge_alanlari_binde"]
    if ta:
        satirlar.append("  imge alanları: " + ", ".join(f"{k} {v}" for k, v in list(ta.items())[:6]))
    return "\n".join(satirlar)
