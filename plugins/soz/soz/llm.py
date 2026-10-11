"""Model çağrıları: ajan istemleri (agents/*.md) ile Claude API, isteğe bağlı
base (ön eğitimli) model.

Claude Code içinde boru hattını skill yürütür ve ajanlar orada alt ajan olarak
çalışır; bu modül aynı istemlerle API üzerinden, Claude Code olmadan çalışmak
içindir. Güncel Claude modelleri sıcaklık (temperature) almaz; çeşitlilik
farklı modeller, farklı yaklaşım yönergeleri ve base model ile sağlanır.
"""

import json
import os
import re
import threading
import urllib.request
from pathlib import Path

from .veri import KOK

MODELLER = {
    "opus": "claude-opus-5-5",
    "sonnet": "claude-sonnet-5-5",
    "haiku": "claude-haiku-5-5",
    "fable": "claude-fable-5-1",
}
# Sunucu tarafı yedek model (refusal fallback) bu modellerde açılır.
_YEDEKLI = {"claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1"}


def ajan_oku(ad: str) -> tuple[dict, str]:
    metin = (KOK / "agents" / f"{ad}.md").read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", metin, re.S)
    if not m:
        return {}, metin
    on = {}
    for satir in m.group(1).splitlines():
        if ":" in satir:
            k, v = satir.split(":", 1)
            on[k.strip()] = v.strip()
    return on, m.group(2).strip()


def model_kimligi(takma: str | None) -> str:
    if not takma or takma == "inherit":
        return MODELLER["opus"]
    return MODELLER.get(takma, takma)


class Istemci:
    """Ajan çağırıcı. kuru=True ise API çağrılmaz; istemler diske yazılır ve
    boru hattının uçtan uca yürüyebilmesi için yer tutucu yanıt döner."""

    def __init__(self, kuru: bool = False, kayit: Path | None = None):
        self.kuru = kuru
        self.kayit = kayit
        self.sayac = 0
        self._kilit = threading.Lock()
        self._istemci = None

    def _kaydet(self, ad: str, model: str, mesaj: str, yanit: str) -> None:
        if not self.kayit:
            return
        self.kayit.mkdir(parents=True, exist_ok=True)
        with self._kilit:
            self.sayac += 1
            sira = self.sayac
        (self.kayit / f"{sira:02d}-{ad}-{model}.md").write_text(
            f"# {ad} ({model})\n\n## İstem\n\n{mesaj}\n\n## Yanıt\n\n{yanit}\n", encoding="utf-8")

    def sor(self, ajan: str, mesaj: str, model: str | None = None, effort: str = "high") -> str:
        on, sistem = ajan_oku(ajan)
        kimlik = model_kimligi(model or on.get("model"))
        if self.kuru:
            yanit = KURU_YANIT.get(ajan, "")
            self._kaydet(ajan, kimlik, mesaj, yanit)
            return yanit
        import anthropic  # pip install anthropic

        if self._istemci is None:
            self._istemci = anthropic.Anthropic()
        istek = dict(model=kimlik, max_tokens=16000, system=sistem,
                     messages=[{"role": "user", "content": mesaj}],
                     thinking={"type": "adaptive"}, output_config={"effort": effort})
        if kimlik in _YEDEKLI:
            cevap = self._istemci.beta.messages.create(
                **istek, betas=["server-side-fallback-2026-07-01"], extra_body={"fallbacks": "default"})
        else:
            cevap = self._istemci.messages.create(**istek)
        if cevap.stop_reason == "refusal":
            raise RuntimeError(f"{ajan} ({kimlik}) isteği reddetti: {cevap.stop_details}")
        yanit = "".join(b.text for b in cevap.content if b.type == "text")
        self._kaydet(ajan, kimlik, mesaj, yanit)
        return yanit


def ham_ses(ornekler: list[dict], baslik: str, adet: int = 1) -> list[str]:
    """Base modelden ham taslak: korpustan şarkılar art arda verilir, yenisinin
    başlığı ve ilk etiketi yazılıp devamı istenir. OpenAI uyumlu bir
    /v1/completions ucu gerekir (vLLM, llama.cpp sunucusu, TGI ...):
    SOZ_BASE_URL, SOZ_BASE_MODEL, isteğe bağlı SOZ_BASE_KEY."""
    url = os.environ.get("SOZ_BASE_URL")
    model = os.environ.get("SOZ_BASE_MODEL")
    if not url or not model or not ornekler:
        return []
    istem = "".join(f"### {s['baslik']}\n\n{s['metin'].strip()}\n\n" for s in ornekler)
    istem += f"### {baslik}\n\n[Kıta 1]\n"
    govde = json.dumps({"model": model, "prompt": istem, "max_tokens": 450, "temperature": 1.0,
                        "top_p": 0.95, "n": adet, "stop": ["\n### ", "\n\n\n\n"]}).encode()
    basliklar = {"Content-Type": "application/json"}
    if os.environ.get("SOZ_BASE_KEY"):
        basliklar["Authorization"] = f"Bearer {os.environ['SOZ_BASE_KEY']}"
    istek = urllib.request.Request(url.rstrip("/") + "/v1/completions", data=govde, headers=basliklar)
    with urllib.request.urlopen(istek, timeout=300) as y:
        veri = json.load(y)
    return [f"# {baslik}\n\n[Kıta 1]\n" + c["text"].strip() + "\n" for c in veri.get("choices", [])]


_KURU_SARKI = """```sarki
# Kuru Deneme

[Kıta 1]
Sabah erkenden kalktım
Çayı demledim yine

[Nakarat]
Gel desem gelmezsin
Git desem gitmezsin
```"""

KURU_YANIT = {
    "fikir": json.dumps({"konseptler": [{"no": 1, "calisma_basligi": "kuru", "durum": "kuru çalıştırma",
                                         "somut_cekirdek": "çay", "hitap": "sen", "ton": "-",
                                         "olasilik": 0.05, "somutluk": 5}],
                         "oneri": {"no": 1, "neden": "kuru"}}, ensure_ascii=False),
    "detay": json.dumps({"detaylar": [{"detay": "çay", "tur": "nesne", "zaman": "simdi", "not": "-"}],
                         "klise_ayrintilar": [], "yer_zaman": "-"}, ensure_ascii=False),
    "taslak": _KURU_SARKI,
    "bas-editor": _KURU_SARKI,
    "prozodi": '{"degisiklikler": []}',
    "klise": '{"degisiklikler": []}',
    "hakem": '{"mod": "adli", "tahmin": null, "guven": 0, "izler": [], "insan_gibi": [], "genel": "kuru"}',
    "kesici": _KURU_SARKI,
}
