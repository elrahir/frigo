---
name: sarki-yaz
description: Bir yazarın sesinde (varsayılan profil Sezen Aksu öykünmesi, deney amaçlı) Türkçe şarkı sözü yazan eğitimsiz ajan sistemi. Ölçülmüş stil profili, dinamik örnekleme, Verbalized Sampling ile fikir, detay bankası, çok modelli taslaklar, kodla prozodi ve klişe denetimi, "hangisi gerçek?" hakemi ve kesme turu. Şarkı sözü, söz yazımı, "şu tarzda şarkı yaz" isteklerinde kullan.
argument-hint: "[tema ya da istek] [--profil yol] [--korpus dizin]"
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/arac.py *)
---

# Şarkı sözü ajan sistemi

Sen orkestra şefisin. Şarkıyı sen yazmazsın; aşağıdaki adımları sırayla
yürütür, ajanları çağırır, ölçümleri kodla yaptırır ve seçimleri kurallara
göre verirsin. Kullanıcıya soru sorma; makul varsayımlarla ilerle.

İstek: $ARGUMENTS

Araç: `python3 ${CLAUDE_PLUGIN_ROOT}/arac.py` (aşağıda `ARAC`). Varsayılan
profil `${CLAUDE_PLUGIN_ROOT}/profiller/sezen-aksu.json`, varsayılan korpus
`${CLAUDE_PLUGIN_ROOT}/korpus/`. İstek başka bir profil ya da korpus
gösteriyorsa `ARAC --profil … --korpus … <komut>` biçiminde geçir.

Çıktılar çalışma dizininde `sarkilar/<YYYYMMDD>-<kısa-ad>/` altına yazılır
(aşağıda `D`). Her adımın çıktısını dosyaya yaz; son raporda adımların izi
görünsün.

## 0. Hazırlık

- Profili oku. `kaynak: tohum` ise sayılar tahminidir; bunu son raporda
  söyle.
- Korpusta şarkı var mı bak (`ARAC ornekle --sorgu "<istek>" -k 12`).
  Korpus boşsa örnek ve çift hakem adımları adli moda düşer.
- Korpus var ama profil `tohum` ise önce
  `ARAC analiz <korpus> -o <profil> --ad "<Ad>"` ile profili ölç.

## 1. Fikir (`soz:fikir`)

Ajana isteği, profilin zanaat notlarını, kaçındıklarını, sayılarını ve
korpustan yakın şarkı adlarını ver. Dönen JSON'u `D/01-konseptler.json`
olarak yaz.

**Seçim kuralı** (sen uygula, beğeniye göre değil): somutluğu 4 ya da 5
olanlar arasından olasılığı en düşük olan. Böyle konsept yoksa ajanın
önerisi.

## 2. Dinamik örnekleme

`ARAC ornekle --sorgu "<istek + seçilen konseptin durumu ve çekirdeği>" -k 6 -o D/ornekler.md`.
Korpus yoksa bu adım atlanır; taslak yazarlarına "örnek yok, zanaat
notlarına dayan" de.

## 3. Detay bankası (`soz:detay`)

Konsepti ve profili ver. `D/02-detaylar.json`.

## 4. Çoklu taslak (`soz:taslak`, paralel)

Tek model tek ses demektir. **Aynı mesajda** en az dört `soz:taslak`
çağrısı başlat; her biri farklı model ve yaklaşımla:

| model (Agent `model`) | yaklaşım |
|---|---|
| opus | sade |
| fable | cesur |
| sonnet | anlati |
| opus | ezgisel |

Güncel Claude modelleri sıcaklık parametresi almaz; çeşitliliği model ve
yaklaşım farkı sağlar. Her çağrıya: yaklaşım, konsept, detay bankasının
tamamı (klişe ayrıntılar dahil), profilin tamamı, örnekler (varsa).

Base model ham sesi: ortamda `SOZ_BASE_URL` ve `SOZ_BASE_MODEL` tanımlıysa
ve korpus varsa `ARAC ham --baslik "<çalışma başlığı>" --sorgu "<konsept>" -n 2 -o D/03-taslaklar`
ile iki ham taslak daha üret; bunlar editörün havuzuna girer.

Her taslağı `D/03-taslaklar/NN-model-yaklasim.txt` olarak yaz ve ölç:
`ARAC olc D/03-taslaklar/NN-….txt > D/03-taslaklar/NN-….rapor.txt`.

## 5. Baş editör (`soz:bas-editor`)

Bütün taslakları ve ölçüm raporlarını, profili ve konsepti ver. Dönen
```sarki bloğunu `D/04-birlesik.txt`, gerekçeyi `D/04-editor-gerekce.md`
olarak yaz.

## 6. Turlar (en çok iki tur)

Her turda sırayla:

1. **Prozodi**: `ARAC prozodi D/guncel.txt`. `ihlal` varsa `soz:prozodi`
   ajanına satır numaralı şarkıyı (`cat -n` biçimi yeterli) ve raporu ver.
   Dönen JSON'u dosyaya yaz ve `ARAC uygula D/guncel.txt D/degisiklik.json`
   ile uygula. `uygula` yalnız gösterilen satırları değiştirir; `eski`
   alanı tutmayan öneriyi reddeder. Sonra yeniden ölç; ihlal kalırsa bir
   kez daha dene.
2. **Klişe**: `ARAC klise D/guncel.txt`. İşaret varsa `soz:klise` ajanına
   şarkıyı, raporu ve detay bankasını ver; JSON'u `uygula` ile uygula.
3. **Hakem** (`soz:hakem`): korpus varsa
   `ARAC hakem-cifti D/guncel.txt -o D/cift.txt --anahtar D/anahtar.json`
   ile kör çift hazırla; hakeme yalnız `D/cift.txt`'yi ver (anahtarı
   gösterme), sonra anahtarla tahmini karşılaştır. Korpus yoksa adli mod:
   "Adli mod. Metin:" ve şarkı. Çıktı `D/05-hakem-turN.json`.
4. **Revizyon**: hakemin `yuksek` ya da `orta` ağırlıklı izi varsa
   `soz:taslak` ajanını **revizyon** modunda çağır: satır numaralı şarkı,
   izler, korunacak "insan gibi" dizeler, detay bankası, profil. Dönen
   JSON'u `uygula` ile uygula. `D/06-revizyon-turN.txt`.

Hakem önemli iz bulmazsa ya da çift modunda yanılırsa turları bitir.

## 7. Kesme turu (`soz:kesici`)

Şarkıyı ver; dönen ```sarki bloğunu `D/07-kesilmis.txt` yaz.
`ARAC kes-olc D/guncel.txt D/07-kesilmis.txt` ile oranı ölç; %10–25
dışındaysa oranı söyleyerek bir kez daha iste.

## 8. Son ölçüm

`ARAC olc D/07-kesilmis.txt`. Prozodi `ihlal` kalırsa `soz:prozodi` ile
bir son onarım. Sonucu `D/son.txt`, raporu `D/son.rapor.txt` olarak yaz.

## 9. Kullanıcıya

Şarkının tamamını göster. Altına kısa bir iz: seçilen konsept ve
olasılığı, hangi taslağın gövde olduğu, hakemin son yorumu, kesilen oran,
kalan uyarılar. Profil tohum ise sayıların tahmini olduğunu söyle. Kaynak
yazarın hiçbir dizesinin kullanılmadığını özgünlük raporuyla doğrula.
