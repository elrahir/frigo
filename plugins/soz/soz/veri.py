"""Paketle gelen veri dosyaları ve korpus okuma."""

import json
import re
from functools import lru_cache
from pathlib import Path

from .turkce import kucult, sade, sozcukler

KOK = Path(__file__).resolve().parent.parent
VERI = KOK / "veri"

# Kısa köklerin (≤4 harf) alabileceği yaygın ekler; "el" "elma"yı, "para"
# "paramparça"yı tutmasın diye.
_KISA_EKLER = frozenset("""
 ı i u ü a e da de ta te dan den tan ten ın in un ün nın nin nun nün ya ye
 yı yi yu yü la le yla yle lar ler ları leri ların lerin larım lerim ım im um üm
 ımı imi umu ümü ımda imde umda ümde ımdan imden ına ine una üne ında inde unda
 ünde ından inden sı si su sü sını sini suna süne nda nde ndan nden na ne nı ni
 ımız imiz umuz ümüz ınız iniz unuz ünüz m n mı mi mu mü mız miz muz müz
 nız niz nuz nüz ki dır dir dur dür tır tir ydı ydi ydu ydü ymış ymiş
 sında sinde sunda sünde sına sine suna süne sını sini sunu sünü sından sinden
 mda mde mdan mden mla mle lara lere larda lerde lardan lerden larla lerle
 mın min mun mün ndaki ndeki daki deki taki teki
""".split())


def okunur(yol: Path) -> list[str]:
    return [s for s in yol.read_text(encoding="utf-8").splitlines()
            if s.strip() and not s.lstrip().startswith("#")]


@lru_cache(maxsize=None)
def durak() -> frozenset[str]:
    return frozenset(w for s in okunur(VERI / "durak.txt") for w in s.split())


@lru_cache(maxsize=None)
def imge_alanlari() -> dict[str, tuple[str, ...]]:
    ham = json.loads((VERI / "imge_alanlari.json").read_text(encoding="utf-8"))
    return {k: tuple(sade(kucult(x)) for x in v) for k, v in ham.items() if not k.startswith("_")}


def kok_eslesir(sozcuk: str, kok: str) -> bool:
    if len(kok) <= 4:
        return sozcuk == kok or (sozcuk.startswith(kok) and sozcuk[len(kok):] in _KISA_EKLER)
    return sozcuk.startswith(kok)


def alanlar(sozcuk: str) -> list[str]:
    s = sade(sozcuk)
    return [ad for ad, kokler in imge_alanlari().items() if any(kok_eslesir(s, k) for k in kokler)]


@lru_cache(maxsize=None)
def klise_listesi() -> tuple[tuple[str, str, str], ...]:
    sonuc = []
    for satir in okunur(VERI / "klise.tsv"):
        parca = satir.split("\t")
        if len(parca) >= 2:
            sonuc.append((parca[0].strip(), parca[1].strip(), parca[2].strip() if len(parca) > 2 else ""))
    return tuple(sonuc)


@lru_cache(maxsize=None)
def kacinilacak() -> tuple[str, ...]:
    return tuple(" ".join(sade(w) for w in sozcukler(s)) for s in okunur(VERI / "kacinilacak.txt"))


_ETIKET = re.compile(r"^\s*etiket(?:ler)?\s*:\s*(.+)$", re.I)


def korpus_oku(dizin: str | Path | None) -> list[dict]:
    """Korpus: her şarkı bir .txt/.md dosyası. İlk '# ' satırı başlık, 'etiketler:'
    satırı virgüllü etiketlerdir; ikisi de metinden çıkarılır."""
    if not dizin:
        return []
    dizin = Path(dizin)
    if not dizin.is_dir():
        return []
    sarkilar = []
    for yol in sorted(dizin.rglob("*")):
        if yol.suffix.lower() not in (".txt", ".md") or yol.name.lower() == "readme.md":
            continue
        baslik, etiketler, govde = yol.stem, [], []
        for satir in yol.read_text(encoding="utf-8").splitlines():
            m = _ETIKET.match(satir)
            if m:
                etiketler = [kucult(e.strip()) for e in m.group(1).split(",") if e.strip()]
            elif satir.lstrip().startswith("# ") and baslik == yol.stem and not govde:
                baslik = satir.lstrip("# ").strip()
            else:
                govde.append(satir)
        metin = "\n".join(govde).strip()
        if metin:
            sarkilar.append({"yol": str(yol), "baslik": baslik, "etiketler": etiketler, "metin": metin})
    return sarkilar
