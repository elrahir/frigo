"""Dize düzeyinde düzenleme: ajanların önerdiği değişiklikleri yalnız hedef
dizelere uygular, kesme oranını ölçer, hakem için kör A/B çifti hazırlar."""

import json
import random
import re
from pathlib import Path

from .sarki import ayristir
from .turkce import kucult, sozcukler


def _norm(s: str) -> str:
    return " ".join(sozcukler(kucult(s)))


def json_bul(metin: str):
    """Model çıktısındaki ilk JSON bloğunu ayıklar (```json ... ``` ya da çıplak)."""
    m = re.search(r"```(?:json)?\s*(.+?)```", metin, re.S)
    aday = m.group(1) if m else metin
    for bas, son in (("{", "}"), ("[", "]")):
        i, j = aday.find(bas), aday.rfind(son)
        if i != -1 and j > i:
            try:
                return json.loads(aday[i:j + 1])
            except json.JSONDecodeError:
                continue
    raise ValueError("çıktıda JSON bulunamadı")


def uygula(metin: str, degisiklik) -> tuple[str, list[str]]:
    """degisiklik: {"degisiklikler": [{"satir": n, "eski": "...", "yeni": "..."}]}
    ya da doğrudan liste. "yeni" boşsa dize silinir, satır sonu içeriyorsa
    bölünür. "eski" verilmişse o satırdaki dizeyle eşleşmeyen öneri reddedilir:
    ajan yalnız gösterdiği dizeyi değiştirebilir."""
    if isinstance(degisiklik, dict):
        liste = degisiklik.get("degisiklikler", [])
        liste += [{"satir": n, "yeni": ""} for n in degisiklik.get("sil", [])]
    else:
        liste = degisiklik
    satirlar = metin.splitlines()
    notlar, yeni = [], {}
    for d in liste:
        n = int(d["satir"])
        if not 1 <= n <= len(satirlar):
            notlar.append(f"reddedildi: satır {n} yok")
            continue
        if "eski" in d and _norm(d["eski"]) != _norm(satirlar[n - 1]):
            notlar.append(f"reddedildi: satır {n} '{satirlar[n - 1]}' iken öneri '{d['eski']}' için yazılmış")
            continue
        yeni[n] = d.get("yeni", "")
        notlar.append(f"satır {n}: '{satirlar[n - 1]}' → '{yeni[n]}'" if yeni[n] else f"satır {n} silindi: '{satirlar[n - 1]}'")
    cikti = []
    for i, s in enumerate(satirlar, 1):
        if i not in yeni:
            cikti.append(s)
        elif yeni[i]:
            cikti.extend(yeni[i].splitlines())
    # Silmeler ardışık boş satır bıraktıysa sadeleştir.
    temiz = re.sub(r"\n{3,}", "\n\n", "\n".join(cikti)).strip() + "\n"
    return temiz, notlar


def kesme_olc(once: str, sonra: str) -> dict:
    def say(m):
        dz = ayristir(m).benzersiz_dizeler()
        return len(dz), sum(len(sozcukler(d)) for d in dz)
    d0, s0 = say(once)
    d1, s1 = say(sonra)
    oran = round(100 * (s0 - s1) / s0, 1) if s0 else 0
    return {"dize_once": d0, "dize_sonra": d1, "sozcuk_once": s0, "sozcuk_sonra": s1, "kesilen_yuzde": oran}


def hakem_cifti(taslak: str, gercek: dict, tohum: int | None = None) -> tuple[str, dict]:
    """Kör çift: biri gerçek şarkı, biri taslak; sıra rastgele. Başlıklar atılır."""
    rnd = random.Random(tohum)
    def govde(m):
        return "\n".join(s for s in m.splitlines() if not s.lstrip().startswith("#")).strip()
    metinler = [("gercek", govde(gercek["metin"])), ("taslak", govde(taslak))]
    rnd.shuffle(metinler)
    anahtar = {"A": metinler[0][0], "B": metinler[1][0], "gercek_baslik": gercek["baslik"]}
    cift = f"METİN A\n\n{metinler[0][1]}\n\n---\n\nMETİN B\n\n{metinler[1][1]}\n"
    return cift, anahtar


def yaz(yol: str | Path, metin: str) -> None:
    Path(yol).parent.mkdir(parents=True, exist_ok=True)
    Path(yol).write_text(metin, encoding="utf-8")
