"""Dinamik örnekleme: yeni şarkının tema ve duygusuna en yakın gerçek şarkılar.

Türkçe sondan eklemeli olduğu için sözcükler ilk beş harflerine indirilir
(F5 kökleme; Türkçe bilgi erişiminde basit ve etkili). TF-IDF + kosinüs,
etiket eşleşmesine ve imge alanı örtüşmesine küçük ek puan.
"""

import math
from collections import Counter

from .turkce import kucult, sade, sozcukler
from .veri import alanlar, durak


def _kokler(metin: str) -> list[str]:
    return [sade(s)[:5] for s in sozcukler(metin) if sade(s) not in durak() and len(s) > 2]


def _vektor(tf: Counter, idf: dict) -> dict:
    v = {k: (1 + math.log(c)) * idf.get(k, 0) for k, c in tf.items()}
    norm = math.sqrt(sum(x * x for x in v.values())) or 1
    return {k: x / norm for k, x in v.items()}


def ornekle(korpus: list[dict], sorgu: str, adet: int = 6) -> list[dict]:
    if not korpus:
        return []
    belgeler = [Counter(_kokler(s["baslik"] + "\n" + s["metin"] + "\n" + " ".join(s["etiketler"])))
                for s in korpus]
    n = len(belgeler)
    df = Counter(k for b in belgeler for k in b)
    idf = {k: math.log((n + 1) / (c + 1)) + 1 for k, c in df.items()}
    q = _vektor(Counter(_kokler(sorgu)), idf)
    q_alan = Counter(a for s in sozcukler(sorgu) for a in alanlar(s))
    q_soz = set(sozcukler(kucult(sorgu)))
    sonuc = []
    for s, b in zip(korpus, belgeler):
        v = _vektor(b, idf)
        puan = sum(q.get(k, 0) * x for k, x in v.items())
        puan += 0.05 * len(q_soz & set(s["etiketler"]))
        s_alan = Counter(a for w in sozcukler(s["metin"]) for a in alanlar(w))
        if q_alan and s_alan:
            ortak = sum(min(q_alan[a] / sum(q_alan.values()), s_alan[a] / sum(s_alan.values())) for a in q_alan)
            puan += 0.1 * ortak
        sonuc.append({**s, "puan": round(puan, 4)})
    sonuc.sort(key=lambda x: x["puan"], reverse=True)
    return sonuc[:adet]


def ornek_metni(secilen: list[dict]) -> str:
    parcalar = []
    for i, s in enumerate(secilen, 1):
        parcalar.append(f"### Örnek {i}: {s['baslik']}\n\n{s['metin']}")
    return "\n\n".join(parcalar)
