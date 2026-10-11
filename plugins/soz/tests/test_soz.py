"""python3 -m unittest discover -s tests  (eklenti kökünden)"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KOK))

from soz import klise, ozgunluk, prozodi, stil  # noqa: E402
from soz.boru_hatti import calistir, konsept_sec, sarki_bul  # noqa: E402
from soz.duzenle import json_bul, kesme_olc, uygula  # noqa: E402
from soz.ornekleme import ornekle  # noqa: E402
from soz.sarki import ayristir  # noqa: E402
from soz.turkce import (dize_hece, dize_hece_kaynasmali, dize_son_vurgu, hecele,  # noqa: E402
                        kucult, vurgu_sondan)

PROFIL = json.loads((KOK / "profiller" / "sezen-aksu.json").read_text(encoding="utf-8"))

SARKI = """# Deneme

[Kıta 1]
Sabah erkenden kalktım
Çayı demledim yine
Pencereyi araladım
Bir kuş kondu kenarına

[Nakarat]
Gel desem gelmezsin
Git desem gitmezsin

[Kıta 2]
Akşam oldu yine bak burada oturuyorum yalnız
Çay soğudu
Pencereyi kapadım
Kuş uçtu gitti uzağa

[Nakarat]
"""


class Turkce(unittest.TestCase):
    def test_kucult(self):
        self.assertEqual(kucult("IŞIK İstanbul"), "ışık istanbul")

    def test_hecele(self):
        self.assertEqual(hecele("gidiyorum"), ["gi", "di", "yo", "rum"])
        self.assertEqual(hecele("Türkçe"), ["türk", "çe"])
        self.assertEqual(hecele("tren"), ["tren"])
        self.assertEqual(hecele("saat"), ["sa", "at"])

    def test_hece_sayisi(self):
        self.assertEqual(dize_hece("Ne olur bir kere daha"), 8)
        self.assertEqual(dize_hece_kaynasmali("Ne olur bir kere daha"), 7)
        self.assertEqual(dize_hece("İstanbul'a döndüm"), 6)

    def test_vurgu(self):
        self.assertEqual(vurgu_sondan("geliyorum"), 3)
        self.assertEqual(vurgu_sondan("gelmedi"), 3)
        self.assertEqual(vurgu_sondan("kaldım"), 1)
        self.assertEqual(vurgu_sondan("şimdi"), 2)
        self.assertEqual(vurgu_sondan("güzelsin"), 2)
        self.assertEqual(vurgu_sondan("İstanbul'a"), 3)
        self.assertEqual(dize_son_vurgu("Beni sever misin"), "once")
        self.assertEqual(dize_son_vurgu("Kapıyı kapadım"), "son")


class Kafiye(unittest.TestCase):
    def test_redif_ve_kafiye(self):
        k = prozodi.kafiye("yine kaldım", "yine daldım")
        self.assertEqual((k["redif"], k["kafiye"], k["tur"]), ("-dım", "al", "tam"))
        k = prozodi.kafiye("bana bak", "sana bak")
        self.assertEqual((k["redif"], k["kafiye"]), ("bak", "ana"))
        self.assertEqual(prozodi.kafiye("gece", "hece")["tur"], "zengin")
        self.assertEqual(prozodi.kafiye("deniz", "yalnız")["tur"], "yarim")

    def test_sema(self):
        self.assertEqual(prozodi.uyak_semasi(["yol", "ev", "kol", "sev"]), "abab")
        self.assertEqual(prozodi.uyak_semasi(["geldim", "gördüm", "sevdim"]), "aba")


class Ayristirma(unittest.TestCase):
    def test_bolumler(self):
        s = ayristir(SARKI)
        self.assertEqual(s.baslik, "Deneme")
        self.assertEqual([b.tur for b in s.bolumler], ["kita", "nakarat", "kita", "nakarat"])
        self.assertTrue(s.bolumler[3].tekrar)
        self.assertEqual(len(s.dizeler(tekrarlar=True)), 12)
        self.assertEqual(len(s.benzersiz_dizeler()), 10)

    def test_etiketsiz_nakarat(self):
        s = ayristir("a b c\nd e\n\nnakarat bu\ntekrar\n\nf g\nh i\n\nnakarat bu\ntekrar\n")
        self.assertEqual([b.tur for b in s.bolumler], ["kita", "nakarat", "kita", "nakarat"])


class Prozodi(unittest.TestCase):
    def test_ihlaller(self):
        r = prozodi.analiz(SARKI, PROFIL)
        turler = {(x["satir"], x["tur"]) for x in r["ihlaller"] if x["onem"] == "ihlal"}
        self.assertIn((14, "uzun"), turler)
        self.assertIn((14, "paralel"), turler)
        self.assertIn((15, "paralel"), turler)
        self.assertNotIn((16, "paralel"), turler)

    def test_uzun_ikinci_kita(self):
        # İkinci kıta ilkinden uzunsa fazladan dizeler kıyaslanmaz, çökmez.
        r = prozodi.analiz("[Kıta 1]\nbir iki\n\n[Kıta 2]\nbir iki\nüç dört\nbeş altı\n", PROFIL)
        self.assertIn("kita-uzunlugu", {x["tur"] for x in r["ihlaller"]})


class Klise(unittest.TestCase):
    def test_yakalar(self):
        r = klise.tara("Yalnızlığın sesi yankılanıyor\nKalbim yine paramparça\nVe sen gittin\nVe ben kaldım\n", PROFIL)
        esl = {x["eslesen"] for x in r["isaretler"]}
        self.assertIn("yankılanıyor", esl)
        self.assertIn("yalnızlığın sesi", esl)
        self.assertTrue(any("paramparça" in e for e in esl))
        self.assertTrue(any("Ve" in g for g in r["genel"]))

    def test_ucleme(self):
        r = klise.tara("Ekmek, tuz, su\nTepsi önde, sen arkada, açtım\nKapı, pencere ve perde\n", PROFIL)
        satirlar = {x["satir"] for x in r["isaretler"] if x["kategori"] == "yapi"}
        self.assertEqual(satirlar, {1, 3})

    def test_temiz(self):
        r = klise.tara("Pazarcı sordu kaç kişisiniz\nBir kişi dedim, bir de kedi\n"
                       "Sabahlığın önünü iğneledim\n", PROFIL)
        self.assertEqual([x for x in r["isaretler"] if x["onem"] == "yuksek"], [])


class Duzenleme(unittest.TestCase):
    def test_uygula(self):
        metin = "bir\niki\nüç\n"
        yeni, notlar = uygula(metin, {"degisiklikler": [{"satir": 2, "eski": "iki", "yeni": "İKİ"},
                                                        {"satir": 3, "eski": "yanlış", "yeni": "x"}]})
        self.assertEqual(yeni, "bir\nİKİ\nüç\n")
        self.assertTrue(any("reddedildi" in n for n in notlar))
        yeni, _ = uygula(metin, {"degisiklikler": [{"satir": 1, "yeni": ""}]})
        self.assertEqual(yeni, "iki\nüç\n")

    def test_kesme(self):
        o = kesme_olc("bir iki üç dört beş\naltı yedi sekiz dokuz on\n", "bir iki üç dört\naltı yedi sekiz dokuz\n")
        self.assertEqual(o["kesilen_yuzde"], 20.0)

    def test_json_bul(self):
        self.assertEqual(json_bul('Açıklama\n```json\n{"a": 1}\n```'), {"a": 1})
        self.assertEqual(json_bul('önce [1, 2] sonra'), [1, 2])

    def test_sarki_bul(self):
        self.assertEqual(sarki_bul("gerekçe\n```sarki\n# B\n\nx\n```\n"), "# B\n\nx\n")


class StilVeOrnek(unittest.TestCase):
    KORPUS = [
        {"yol": "a", "baslik": "Vapur", "etiketler": ["deniz"], "metin": "İskelede bekledim vapuru\nMartılar simit kaptı elimden"},
        {"yol": "b", "baslik": "Mutfak", "etiketler": ["ev"], "metin": "Tencere kaynadı ocakta\nSofrayı iki kişilik kurdum yine"},
        {"yol": "c", "baslik": "Pazar", "etiketler": ["şehir"], "metin": "Pazarda domates seçtim\nManav sordu kaç kişisiniz"},
    ]

    def test_ornekle(self):
        sonuc = ornekle(self.KORPUS, "pazarcı kaç kişi diye sordu", 2)
        self.assertEqual(sonuc[0]["baslik"], "Pazar")

    def test_profil_ve_kiyas(self):
        p = stil.profil_cikar(self.KORPUS, "Deneme")
        self.assertEqual(p["olcumler"]["sarki"], 3)
        self.assertIn("fısıl*", p["yasak_sozcukler"])
        self.assertEqual(stil.olc(["Götür helvanı abla\nKapı açıldı"])["hitap_dize_orani"], 0.5)
        k = stil.karsilastir(PROFIL, SARKI)
        self.assertTrue(any(s["olcu"].startswith("dize başına hece") for s in k["satirlar"]))

    def test_ozgunluk(self):
        r = ozgunluk.denetle("Sofrayı iki kişilik kurdum ben\nKüçüğüm gel\n", self.KORPUS)
        self.assertEqual({b["tur"] for b in r["bulgular"]}, {"korpus", "imza"})


class BoruHatti(unittest.TestCase):
    def test_secim(self):
        veri = {"konseptler": [{"no": 1, "olasilik": 0.3, "somutluk": 5},
                               {"no": 2, "olasilik": 0.02, "somutluk": 2},
                               {"no": 3, "olasilik": 0.06, "somutluk": 4}]}
        self.assertEqual(konsept_sec(veri)["no"], 3)

    def test_kuru(self):
        with tempfile.TemporaryDirectory() as d:
            dizin = calistir("deneme tema", d, str(KOK / "profiller" / "sezen-aksu.json"),
                             str(Path(d) / "yok"), kuru=True)
            self.assertTrue((dizin / "son.txt").exists())
            self.assertTrue(any((dizin / "istemler").iterdir()))


if __name__ == "__main__":
    unittest.main()
