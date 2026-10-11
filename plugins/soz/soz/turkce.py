"""Türkçe metin yardımcıları: küçültme, sözcüklere ayırma, heceleme, vurgu.

Hepsi kural tabanlı ve yalnız standart kütüphaneyle çalışır. Türkçede hece
sayısı ünlü sayısına eşittir; heceleme ve hece sayımı bu yüzden güvenilirdir.
Vurgu ise yaklaşıktır: yer adları, bazı zarflar ve vurgusuz ekler kuralı
bozar; burada en sık durumlar ele alınır, gerisi son hece sayılır.
"""

import re
import unicodedata

UNLULER = frozenset("aeıioöuüâêîôû")
DUZELT = str.maketrans({"â": "a", "ê": "e", "î": "i", "ô": "o", "û": "u"})
HARF = "a-zçğıöşüâêîôû"
SOZCUK = re.compile(rf"[{HARF}]+(?:'[{HARF}]+)?")

# Satır sonu kesme işaretleri ve tipografik kesmeler tek biçime iner.
_KESME = str.maketrans({"’": "'", "‘": "'", "`": "'", "´": "'"})


def kucult(metin: str) -> str:
    """Türkçe kurallarıyla küçük harf (I→ı, İ→i)."""
    metin = unicodedata.normalize("NFC", metin).translate(_KESME)
    return metin.replace("I", "ı").replace("İ", "i").lower()


def sozcukler(metin: str) -> list[str]:
    """Küçültülmüş sözcükler; kesmeli ekler sözcükte kalır (istanbul'a)."""
    return SOZCUK.findall(kucult(metin))


def sade(sozcuk: str) -> str:
    """Şapkasız, kesmesiz biçim (karşılaştırma için)."""
    return sozcuk.replace("'", "").translate(DUZELT)


def unlu_say(metin: str) -> int:
    return sum(1 for c in kucult(metin) if c in UNLULER)


def hecele(sozcuk: str) -> list[str]:
    """Türkçe heceleme: iki ünlü arasındaki tek ünsüz sonraki heceye,
    birden çok ünsüzün yalnız sonuncusu sonraki heceye geçer."""
    s = kucult(sozcuk).replace("'", "")
    yer = [i for i, c in enumerate(s) if c in UNLULER]
    if not yer:
        return [s] if s else []
    heceler, bas = [], 0
    for v, sonraki in zip(yer, yer[1:]):
        kes = v + 1 if sonraki - v - 1 <= 1 else sonraki - 1
        heceler.append(s[bas:kes])
        bas = kes
    heceler.append(s[bas:])
    return heceler


def dize_hece(dize: str) -> int:
    """Yazılı hece sayısı (ünlü sayısı)."""
    return sum(unlu_say(s) for s in sozcukler(dize))


def dize_hece_kaynasmali(dize: str) -> int:
    """Ünlüyle biten sözcük ünlüyle başlayana bağlanınca şarkıda iki hece
    çoğu zaman bire iner ("ne olur" → "nolur"). En düşük olası sayı."""
    ss = sozcukler(dize)
    toplam = sum(unlu_say(s) for s in ss)
    for a, b in zip(ss, ss[1:]):
        if a and b and a[-1] in UNLULER and b[0] in UNLULER:
            toplam -= 1
    return toplam


# --- Vurgu (yaklaşık) ---------------------------------------------------

# Vurgusu son hecede olmayan sık sözcükler: değer, sondan kaçıncı hece.
VURGU_ISTISNA = {
    "şimdi": 2, "belki": 2, "sonra": 2, "ama": 2, "ancak": 2, "yarın": 2,
    "bugün": 2, "nasıl": 2, "nerede": 3, "nereye": 3, "nereden": 3,
    "niye": 2, "neden": 2, "hani": 2, "işte": 2, "hemen": 2, "çünkü": 2,
    "öyle": 2, "böyle": 2, "şöyle": 2, "evet": 2, "hayır": 2, "haydi": 2,
    "hadi": 2, "lütfen": 2, "sanki": 2, "yine": 2, "gene": 2, "daha": 2,
    "aslında": 3, "galiba": 3, "yoksa": 2, "bile": 2, "yalnız": 2,
    "dünya": 2, "anne": 2, "baba": 2, "masa": 2, "lokanta": 2, "patates": 2,
    "domates": 2, "efendi": 2, "istanbul": 2, "ankara": 3, "izmir": 2,
    "ege": 2, "akdeniz": 3, "türkiye": 3, "avrupa": 2, "anadolu": 3,
    "kimse": 2, "hiçbir": 2, "herkes": 2, "nice": 2, "kimi": 2, "biraz": 2,
    "seninle": 2, "benimle": 2, "onunla": 2, "bizimle": 2, "sizinle": 2,
    "onlarla": 2, "kiminle": 2, "neyle": 2,
}

# Kendinden önceki heceyi vurgulayan son ekler (en uzunlar önce denenir).
# -ce/-le gibi kısa ekler "gece", "güle" gibi köklerle karışacağı için yok.
_ONVURGULU_SONEK = sorted(
    """sınız siniz sunuz sünüz sın sin sun sün dır dir dur dür tır tir tur
    tür yken ken leyin layın yle yla""".split(),
    key=len, reverse=True)
_SORU = re.compile(r"^m[ıiuü](?:yım|yim|yum|yüm|sın|sin|sun|sün|yız|yiz|yuz|yüz|"
                   r"sınız|siniz|sunuz|sünüz|ydı|ydi|ydu|ydü|ymış|ymiş|ymuş|ymüş)?$")
_OLUMSUZ = re.compile(r"m[ae](?:d[ıi]|d[ıi]m|d[ıi]n|d[ıi]k|d[ıi]nız|d[ıi]niz|z|zs[ıi]n|"
                      r"m|y[ae]c[ae]k|y[ae]n|s[ıi]n|y[ıi]m|y[ıi]z|m[ıi]ş)\w*$")


def vurgu_sondan(sozcuk: str, sonraki: str | None = None) -> int:
    """Vurgulu hecenin sondan sırası (1 = son hece). Yaklaşık."""
    k = kucult(sozcuk)
    if "'" in k:
        # Özel ad + ek (İstanbul'a): ek vurgusuzdur, vurgu adın içinde kalır.
        ad, ek = k.split("'", 1)
        ad = sade(ad)
        ad_hece = len(hecele(ad))
        icinde = VURGU_ISTISNA.get(ad, 2 if ad_hece > 1 else 1)
        return min(icinde, ad_hece) + len(hecele(ek))
    s = sade(k)
    hc = hecele(s)
    n = len(hc)
    if n <= 1:
        return 1
    if s in VURGU_ISTISNA:
        return min(VURGU_ISTISNA[s], n)
    # -yor: vurgu -yor'dan önceki hecede (geLİyorum)
    for i in range(n - 1, 0, -1):
        if hc[i].startswith("yor") or hc[i] == "yo":
            return min(n - i + 1, n)
    m = _OLUMSUZ.search(s)
    if m and m.start() > 0:
        once = len(hecele(s[: m.start()]))
        if once:
            return n - once + 1
    for ek in _ONVURGULU_SONEK:
        if s.endswith(ek) and len(s) > len(ek) + 1:
            kalan = len(hecele(s[: -len(ek)]))
            if kalan:
                return min(n - kalan + 1, n)
    return 1


def dize_son_vurgu(dize: str) -> str:
    """Dizenin sonu nasıl düşüyor: 'son' (son hece vurgulu, erkek uyak gibi)
    ya da 'once' (vurgu daha önde, dişi uyak gibi). Soru eki mi/mı tek başına
    gelirse kendinden önceki sözcük vurgu taşır, dize 'once' biter."""
    ss = sozcukler(dize)
    if not ss:
        return "?"
    if len(ss) > 1 and _SORU.match(sade(ss[-1])):
        return "once"
    return "son" if vurgu_sondan(ss[-1]) == 1 else "once"


def son_sozcuk(dize: str) -> str:
    ss = sozcukler(dize)
    return sade(ss[-1]) if ss else ""
