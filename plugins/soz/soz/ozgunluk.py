"""Özgünlük denetimi: taslak korpustaki bir dizeyi ya da kaynağın imza
başlığını/kancasını tekrar ediyor mu? Öykünme seste olur, alıntı sözde olmaz."""

from .sarki import ayristir
from .turkce import sade, sozcukler
from .veri import kacinilacak


def _ngramlar(sozler: list[str], n: int) -> set[tuple[str, ...]]:
    return {tuple(sozler[i:i + n]) for i in range(len(sozler) - n + 1)}


def denetle(metin: str, korpus: list[dict] | None = None, n: int = 4) -> dict:
    sarki = ayristir(metin)
    dizin: dict[tuple[str, ...], str] = {}
    for s in korpus or []:
        for satir in s["metin"].splitlines():
            ss = [sade(w) for w in sozcukler(satir)]
            for g in _ngramlar(ss, n):
                dizin.setdefault(g, s["baslik"])
    kancalar = [k.split() for k in kacinilacak()]
    bulgular = []
    for d in sarki.dizeler():
        ss = [sade(w) for w in sozcukler(d.metin)]
        for g in _ngramlar(ss, n):
            if g in dizin:
                bulgular.append({"satir": d.satir, "dize": d.metin, "tur": "korpus",
                                 "eslesen": " ".join(g), "kaynak": dizin[g]})
                break
        for k in kancalar:
            if any(ss[i:i + len(k)] == k for i in range(len(ss) - len(k) + 1)):
                bulgular.append({"satir": d.satir, "dize": d.metin, "tur": "imza",
                                 "eslesen": " ".join(k), "kaynak": "kaçınılacak başlık/kanca"})
    baslik = [sade(w) for w in sozcukler(sarki.baslik)]
    for k in kancalar:
        if baslik and baslik == k:
            bulgular.append({"satir": 1, "dize": sarki.baslik, "tur": "imza-baslik",
                             "eslesen": " ".join(k), "kaynak": "kaynağın şarkı adı"})
    return {"bulgular": bulgular, "korpus_sarki": len(korpus or []), "n": n}


def rapor_metni(sonuc: dict) -> str:
    satirlar = [f"ÖZGÜNLÜK — korpus {sonuc['korpus_sarki']} şarkı, {sonuc['n']}-gram"]
    if not sonuc["bulgular"]:
        satirlar.append("  örtüşme yok")
    for b in sonuc["bulgular"]:
        satirlar.append(f"  satır {b['satir']} [{b['tur']}] «{b['eslesen']}» ← {b['kaynak']}")
        satirlar.append(f"      {b['dize']}")
    return "\n".join(satirlar)
