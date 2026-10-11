"""Klişe avcısı: kara liste + yapısal yapay zekâ izleri.

Kara liste (veri/klise.tsv) sözcük kalıplarını yakalar. Yapısal dedektörler
listenin göremediğini sayar: soyut tamlama ("yalnızlığın sesi"), benzetme
yoğunluğu, "Ve" ile açılan dizeler, evrenselleştiren "her", üçlü sıralama.
Çıktı yalnız işarettir; düzeltmeyi editör ajanı yalnız işaretli dizelerde yapar.
"""

import re
from collections import Counter

from .sarki import ayristir
from .turkce import kucult, sade, sozcukler
from .veri import alanlar, klise_listesi, kok_eslesir

_GENITIF = re.compile(r"(?:nın|nin|nun|nün|ın|in|un|ün)$")
_IYELIK3 = re.compile(r"(?:sı|si|su|sü|ı|i|u|ü|ları|leri)(?:n|nda|nde|ndan|nden|na|ne|nı|ni)?$")
_SOYUT_KOK = re.compile(r"(?:lı[kğ]|li[kğ]|lu[kğ]|lü[kğ])")


def _kalip_derle(kalip: str) -> list[re.Pattern]:
    parcalar = []
    for p in kalip.split():
        p = sade(kucult(p))
        desen = re.escape(p.rstrip("*")) + (r"\w*" if p.endswith("*") else "")
        parcalar.append(re.compile(f"^{desen}$"))
    return parcalar


def _eslesir(sozler: list[str], desenler: list[re.Pattern], bosluk: int = 2) -> str | None:
    for i, s in enumerate(sozler):
        if not desenler[0].match(s):
            continue
        j, bulunan = i, [s]
        for d in desenler[1:]:
            for k in range(j + 1, min(len(sozler), j + 2 + bosluk)):
                if d.match(sozler[k]):
                    j = k
                    bulunan.append(sozler[k])
                    break
            else:
                break
        else:
            return " … ".join(bulunan) if len(bulunan) > 1 else bulunan[0]
    return None


def tara(metin: str, profil: dict | None = None) -> dict:
    sarki = ayristir(metin)
    dizeler = sarki.dizeler()
    liste = [(k, kat, not_, _kalip_derle(k)) for k, kat, not_ in klise_listesi()]
    yasak = [(k, _kalip_derle(k)) for k in (profil or {}).get("yasak_sozcukler", [])]
    isaretler = []

    def ekle(d, kategori, eslesen, aciklama, onem="orta"):
        isaretler.append({"satir": d.satir, "dize": d.metin, "kategori": kategori,
                          "eslesen": eslesen, "aciklama": aciklama, "onem": onem})

    for d in dizeler:
        ss = [sade(s) for s in sozcukler(d.metin)]
        for kalip, kat, not_, desen in liste:
            e = _eslesir(ss, desen)
            if e:
                ekle(d, kat, e, not_, "yuksek" if kat in ("yz", "pop") else "orta")
        for kalip, desen in yasak:
            e = _eslesir(ss, desen)
            if e and not any(x["satir"] == d.satir and x["eslesen"] == e for x in isaretler):
                ekle(d, "profil", e, "yazarın korpusunda hiç geçmeyen sözcük", "orta")
        for a, b in zip(ss, ss[1:]):
            soyut_a = _SOYUT_KOK.search(a[:-2]) or "soyut_duygu" in alanlar(a)
            if soyut_a and _GENITIF.search(a) and _IYELIK3.search(b) and len(b) > 3:
                ekle(d, "yz", f"{a} {b}", "soyut tamlama (\"yalnızlığın sesi\" türü): duyguya ses/renk/beden "
                     "giydirmek LLM'in en tipik hareketi", "yuksek")
        if len([s for s in re.split(r"[,;]", d.metin) if s.strip()]) >= 3 and len(ss) <= 9:
            ekle(d, "yapi", d.metin, "üçlü sıralama; LLM üçlemeyi sever", "dusuk")

    # Şarkı geneli sayımlar
    tum = [sade(s) for d in dizeler for s in sozcukler(d.metin)]
    sayim = Counter(tum)
    genel = []
    gibi = sayim["gibi"]
    if gibi > max(2, len(dizeler) // 8):
        genel.append(f"'gibi' {gibi} kez: benzetme yoğun; en az ikisini doğrudan söyleyişe çevir")
        for d in dizeler:
            if "gibi" in [sade(s) for s in sozcukler(d.metin)]:
                ekle(d, "yapi", "gibi", "benzetme yoğunluğu", "dusuk")
    ve_dize = [d for d in dizeler if sozcukler(d.metin)[:1] == ["ve"]]
    if len(ve_dize) >= 2:
        genel.append(f"{len(ve_dize)} dize 'Ve' ile açılıyor: çeviri şiir/LLM izi")
        for d in ve_dize:
            ekle(d, "yz", "ve", "'Ve' ile açılan dize", "orta")
    if sayim["her"] >= 4:
        genel.append(f"'her' {sayim['her']} kez: evrenselleştirme (her gece, her an); somut bir ana in")
    acilis = Counter(sozcukler(d.metin)[0] for d in dizeler if sozcukler(d.metin))
    for soz, kez in acilis.items():
        if kez >= 4 and soz not in ("ben", "sen"):
            genel.append(f"{kez} dize '{soz}' ile açılıyor: anafora bilinçli değilse tekdüze")
    soyut = sum(1 for s in tum if _SOYUT_KOK.search(s) or "soyut_duygu" in alanlar(s))
    if tum and soyut / len(tum) > 0.06:
        genel.append(f"soyut sözcük oranı %{100 * soyut / len(tum):.0f}: duyguyu adlandırıyor, göstermiyor")
    return {"isaretler": isaretler, "genel": genel,
            "ozet": {"isaret": len(isaretler),
                     "yuksek": sum(1 for x in isaretler if x["onem"] == "yuksek")}}


def rapor_metni(sonuc: dict) -> str:
    o = sonuc["ozet"]
    satirlar = [f"KLİŞE AVCISI — {o['isaret']} işaret ({o['yuksek']} yüksek)"]
    for x in sorted(sonuc["isaretler"], key=lambda x: x["satir"]):
        satirlar.append(f"  satır {x['satir']} [{x['kategori']}/{x['onem']}] «{x['eslesen']}» — {x['aciklama']}")
        satirlar.append(f"      {x['dize']}")
    for g in sonuc["genel"]:
        satirlar.append(f"  • {g}")
    return "\n".join(satirlar)


__all__ = ["tara", "rapor_metni", "kok_eslesir"]
