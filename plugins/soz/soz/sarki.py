"""Şarkı metnini bölümlere ayırır.

Biçim düz metindir. Bölümler boş satırla ayrılır; isteğe bağlı etiketler
köşeli parantez içinde kendi satırındadır: [Kıta 1], [Nakarat], [Köprü],
[Son]. İçi boş bir etiket ([Nakarat] tek başına) önceki nakaratın tekrarıdır.
'#' ile başlayan ilk satır başlıktır. Satır sonundaki (x2) gibi işaretler
atılır.
"""

import re
from dataclasses import dataclass, field

from .turkce import kucult

_ETIKET = re.compile(r"^\s*\[(.+?)\]\s*$")
_TEKRAR = re.compile(r"\s*[\(\[]?\s*[x×]\s*\d+\s*[\)\]]?\s*$", re.I)


@dataclass
class Dize:
    metin: str
    satir: int          # dosyadaki satır numarası (1'den)
    bolum: int          # bölüm sırası (0'dan)
    sira: int           # bölüm içindeki sıra (0'dan)


@dataclass
class Bolum:
    tur: str            # kita | nakarat | kopru | giris | son | diger
    ad: str
    dizeler: list[Dize] = field(default_factory=list)
    tekrar: bool = False  # içi boş etiketle tekrarlanan nakarat

    @property
    def metin(self) -> str:
        return "\n".join(d.metin for d in self.dizeler)


@dataclass
class Sarki:
    baslik: str
    bolumler: list[Bolum]

    def dizeler(self, tekrarlar: bool = False) -> list[Dize]:
        return [d for b in self.bolumler if tekrarlar or not b.tekrar for d in b.dizeler]

    def benzersiz_dizeler(self) -> list[str]:
        gorulen, sonuc = set(), []
        for d in self.dizeler(tekrarlar=True):
            k = kucult(d.metin).strip(" .,;:!?…-")
            if k and k not in gorulen:
                gorulen.add(k)
                sonuc.append(d.metin)
        return sonuc


def _tur(etiket: str) -> str:
    e = kucult(etiket)
    for anahtar, tur in (("nakarat", "nakarat"), ("chorus", "nakarat"), ("refrain", "nakarat"),
                         ("köprü", "kopru"), ("bridge", "kopru"), ("ara", "kopru"),
                         ("giriş", "giris"), ("intro", "giris"),
                         ("son", "son"), ("outro", "son"), ("kapanış", "son"), ("final", "son"),
                         ("kıta", "kita"), ("verse", "kita"), ("bölüm", "kita")):
        if anahtar in e:
            return tur
    return "diger"


def ayristir(metin: str) -> Sarki:
    baslik = ""
    bolumler: list[Bolum] = []
    gecerli: Bolum | None = None
    etiketli_bos: Bolum | None = None

    def kapat():
        nonlocal gecerli
        if gecerli is not None and gecerli.dizeler:
            bolumler.append(gecerli)
        gecerli = None

    for no, ham in enumerate(metin.splitlines(), start=1):
        satir = ham.rstrip()
        if not baslik and not bolumler and gecerli is None and satir.lstrip().startswith("#"):
            baslik = satir.lstrip("# ").strip()
            continue
        if satir.lstrip().startswith("#"):
            continue
        m = _ETIKET.match(satir)
        if m:
            kapat()
            if etiketli_bos is not None:
                _tekrar_ekle(etiketli_bos, bolumler)
            gecerli = Bolum(_tur(m.group(1)), m.group(1).strip())
            etiketli_bos = gecerli
            continue
        if not satir.strip():
            if gecerli is not None and not gecerli.dizeler:
                continue  # etiketten sonraki boşluk
            kapat()
            if etiketli_bos is not None and etiketli_bos not in bolumler:
                _tekrar_ekle(etiketli_bos, bolumler)
            etiketli_bos = None
            continue
        if gecerli is None:
            gecerli = Bolum("kita", "")
        etiketli_bos = None
        temiz = _TEKRAR.sub("", satir).strip()
        if temiz:
            gecerli.dizeler.append(Dize(temiz, no, len(bolumler), len(gecerli.dizeler)))
    kapat()
    if etiketli_bos is not None and etiketli_bos not in bolumler:
        _tekrar_ekle(etiketli_bos, bolumler)

    # Etiketsiz bölümler: metni aynen tekrarlanan bölüm nakarattır.
    gorulen: dict[str, int] = {}
    for i, b in enumerate(bolumler):
        if b.ad:
            continue
        anahtar = kucult(b.metin)
        if anahtar in gorulen:
            bolumler[gorulen[anahtar]].tur = "nakarat"
            b.tur = "nakarat"
            b.tekrar = True
        else:
            gorulen[anahtar] = i
    for i, b in enumerate(bolumler):
        for d in b.dizeler:
            d.bolum = i
    return Sarki(baslik, bolumler)


def _tekrar_ekle(etiket: Bolum, bolumler: list[Bolum]) -> None:
    """İçi boş etiket: aynı türden son bölümün tekrarı."""
    for onceki in reversed(bolumler):
        if onceki.tur == etiket.tur and onceki.dizeler:
            kopya = Bolum(etiket.tur, etiket.ad, tekrar=True)
            kopya.dizeler = [Dize(d.metin, d.satir, len(bolumler), d.sira) for d in onceki.dizeler]
            bolumler.append(kopya)
            return
