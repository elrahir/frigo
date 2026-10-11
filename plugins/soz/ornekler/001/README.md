# 001 · Ölen Yok, Giden Var

Sistemin ilk şarkısı. Deney amaçlı bir Sezen Aksu öykünmesi: kaynağın hiçbir
dizesi, başlığı ya da nakarat kancası kullanılmadı. Tema serbest bırakıldı;
konsepti fikir ajanı buldu, seçimi kural yaptı.

```
[Kıta 1]
Sen de iki kere çaldın,
o hep iki çalardı.
Bir dakika! Sabahlığım
açık kaldı.

[Nakarat]
Al helvanı abla,
götür çocuklar yesin.
Ölen yok, giden var,
kombiyi kıs dedi, çıktı.

[Kıta 2]
"Başın sağ olsun" mu, Gülten?
Neyse. Duymadım sayalım.
Kapı kolunda dünkü ekmek,
dursun bakalım.

[Nakarat]

[Köprü]
Tepsiyi tanıdım.
"güle güle oturun" demiştin.
Tuzu azdı.
Otomatiğe basayım.

[Nakarat]
```

Sahne: Üsküdar'da asansörsüz bir apartman, kasım sonu, cumartesi sabahı.
Kocası yirmi yıl sonra evi terk etmiş; ertesi sabah komşu Gülten abla ölü
evine gelir gibi kapıya irmik helvasıyla gelmiş. "Otomatik" merdiven
ışığının düğmesi; konuşma ortasında söner.

## İz

| Adım | Ne oldu | Dosya |
|---|---|---|
| Profil | Tohum profil (sayılar tahmini, korpus yok) | [profil-ozeti.md](profil-ozeti.md) |
| Örnekleme | Korpus boş; atlandı, taslaklar zanaat notlarına dayandı | — |
| Fikir | 10 konsept, olasılıkları 0,02–0,18. Kural: somutluk ≥ 4 içinde en düşük olasılık → #9 "Ölmedi ki gitti" (0,02, somutluk 5) | [01-konseptler.json](01-konseptler.json), [konsept.md](konsept.md) |
| Detay bankası | 20 ayrıntı + 14 klişe ayrıntı (kullanılmayacak) | [02-detaylar.json](02-detaylar.json) |
| Taslaklar | Opus/sade, Fable/cesur, Sonnet/anlatı, Opus/ezgisel; her biri kodla ölçüldü | [03-taslaklar/](03-taslaklar) |
| Baş editör | Gövde Opus/sade; son nakarata Opus/ezgisel'den tek aşı | [04-editor-gerekce.md](04-editor-gerekce.md), [04-birlesik.txt](04-birlesik.txt) |
| Prozodi / klişe | Birleşik metinde 0 ihlal, 0 işaret; onarım gerekmedi | [04-birlesik.rapor.txt](04-birlesik.rapor.txt) |
| Hakem tur 1 | Adli mod; 9 iz (3 yüksek). Ana teşhis: her bölüm bir deyimi ters çeviren espriyle bitiyor, formül gibi; kapanış "yas"ı adıyla anıp yayı kapatıyor | [05-hakem-tur1.json](05-hakem-tur1.json) |
| Revizyon tur 1 | Fable, 12 satır düzenlemesi (`uygula` ile, başka satıra dokunulmadan) | [06-revizyon-tur1.json](06-revizyon-tur1.json) |
| Hakem tur 2 | 7 iz (1 yüksek): nakaratta kafiye dolgusu "varsa var", "iki" motifinin üçüncü kez dönmesi, sahnelenmiş "ne diyordum ben?" | [05-hakem-tur2.json](05-hakem-tur2.json) |
| Revizyon tur 2 | Opus, 5 satır: "kombiyi kıs dedi, çıktı", "dünkü ekmek", "Ispanaklıydı, tuzu azdı", "Otomatiğe ben basayım"; son nakarat ilkinin aynısı | [06-revizyon-tur2.json](06-revizyon-tur2.json) |
| Kesme | %14,8 (61 → 52 sözcük, kodla ölçüldü; kabul aralığı %10–25) | [07-kesici-notlari.md](07-kesici-notlari.md) |
| Son ölçüm | 0 prozodi ihlali, 0 klişe işareti, korpusla örtüşme yok (korpus boş) | [son.txt](son.txt), [son.rapor.txt](son.rapor.txt) |

Hakemin turlar boyunca "insan gibi" dediği ve korunan dizeler: "o hep iki
çalardı", "götür çocuklar yesin", "Tepsiyi tanıdım".

## Kalan sapmalar (son rapordan)

- Dize başına hece ortalaması 7,0; tohum profilin bandı 7,6–10. Kesme turu
  dizeleri kısalttı; "açık kaldı" ve "Tuzu azdı" 4 hece, alt sınırın altında.
  Bilerek bırakıldı: nakarattan önce kesik bir vuruş.
- Nakaratta uyak yok (şema abcd). İkinci hakem kafiye dolgusunu yüksek
  ağırlıkla işaretledi, revizyon kafiyeyi feda etti.
- "ben" zamiri hiç yok; konuşan kendini ekle taşıyor.

## Sistem hakkında bu koşudan öğrenilenler

- Adli modda hakem metnin makine işi olduğunu bilerek okur ve her turda iz
  bulur; bu yüzden tur sayısı sınırlıdır (2). Gerçek korpusla çift modunda
  hakemin yanılması doğal bir durma ölçütü olur.
- Kod ölçümleri ilk koşuda üç hata ve iki yanlış alarm yakaladı; düzeltildi
  ve test eklendi: "sabahlığın önünü" soyut tamlama sanıldı, üçleme
  dedektörü konuşma cümlelerini işaretledi, "abla" gibi seslenmeler hitap
  sayılmadı, "güle güle" doğa imgesi sayıldı, ikinci kıta ilkinden uzunsa
  prozodi aracı çöktü.
