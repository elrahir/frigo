# soz

Türkçe şarkı sözü yazan, eğitim gerektirmeyen bir ajan sistemi. Bir yazarın
sesine öykünür; varsayılan profil Sezen Aksu'dur. **Deney amaçlıdır, ticari
kullanım için değildir.** Kaynak yazarın sözleri repoda yoktur (telif); kendi
korpusunuzu yerelde `korpus/` altına koyarsınız.

İlk şarkı ve bütün ara çıktıları: [`ornekler/001`](ornekler/001).

## Mimari

Dokuz adım. Ölçülebilen her şeyi kod ölçer, LLM yalnız yazar ve yalnız
kodun gösterdiği dizeyi düzeltir.

| # | Adım | Kim | Ne yapar |
|---|---|---|---|
| 1 | Ölçülmüş stil profili | kod (`analiz`) | Korpustan sayılar: dize başına hece, kıta boyları, tekrar oranı, zamir oranları (binde), hitap/soru/ünlem dizesi oranı, imge alanları, kip dağılımı, uyaklı dize oranı, imza sözcükler (referans korpusla log-oran), hiç kullanılmayan sözcükler. "Melankolik ve şiirsel" yerine sayı. |
| 2 | Dinamik örnekleme | kod (`ornekle`) | Her şarkı için tema ve duyguya en yakın 5–8 gerçek şarkı (F5 kökleme + TF-IDF + imge alanı örtüşmesi). |
| 3 | Fikir | `soz:fikir` | Verbalized Sampling: olasılıklarıyla 10 konsept; somutluğu 4+ olanlardan olasılığı en düşük olan seçilir (kuralı kod/orkestratör uygular, beğeni değil). |
| 4 | Detay bankası | `soz:detay` | Yazmadan önce sahneye ait 15–20 somut ayrıntı ve kaçınılacak klişe ayrıntılar. |
| 5 | Çoklu taslak | `soz:taslak` ×4 | Farklı modeller (Opus, Fable, Sonnet) ve yaklaşımlar (sade, cesur, anlatı, ezgisel). İsteğe bağlı base model ham sesi. |
| 6 | Baş editör | `soz:bas-editor` | Ölçüm raporlarıyla taslakları okur, gövde seçer, en çok beş dize aşılar. |
| 7 | Prozodi | kod + `soz:prozodi` | Hece sayımı, ünlü kaynaşması, paralel kıta eşleşmesi, kafiye/redif ayrımı, uyak şeması, dize sonu vurgusu. LLM yalnız ihlal eden satırı yeniden yazar. |
| 8 | Klişe avcısı | kod + `soz:klise` | Kara liste (`veri/klise.tsv`) + yapısal YZ izleri (soyut tamlama, "Ve" ile açılan dize, benzetme yoğunluğu, evrenselleştiren "her"). Yalnız işaretli satır düzelir. |
| 9 | "Hangisi gerçek?" hakemi | kod + `soz:hakem` | Gerçek bir şarkı ile taslak kör A/B verilir; hakem sahteyi bulur ve nedenini dize dize söyler. Bu bir kalite puanı değil, iz yakalayıcıdır; izler revizyon notu olur. Korpus yoksa tek metinli adli mod. |
| 10 | Kesme turu | `soz:kesici` + kod | Sözcüklerin %15–20'si atılır; oranı kod ölçer. |

Ek olarak özgünlük denetimi (`ozgun`): taslak korpustaki bir dizeyle 4
sözcükten uzun örtüşüyor mu, kaynağın imza başlıklarından birini kullanıyor
mu (`veri/kacinilacak.txt`).

"LLM yalnız gösterilen dizeyi değiştirir" kuralı kodla zorlanır: onarım
ajanları satır düzenlemesi döndürür (`{"satir", "eski", "yeni"}`), `uygula`
komutu yalnız o satırları değiştirir ve `eski` alanı satırla tutmayan
öneriyi reddeder.

## Kullanım

### Claude Code içinde

```
claude plugin marketplace add elrahir/frigo
claude plugin install soz@frigo
```

Yeni oturumda: `/soz:sarki-yaz <tema>`. Skill orkestra şefidir; ajanları
alt ajan olarak çağırır, ölçümleri `arac.py` ile yapar, her adımı
`sarkilar/<tarih>-<ad>/` altına yazar. API anahtarı gerekmez.

### Claude API ile, Claude Code olmadan

```
pip install anthropic
export ANTHROPIC_API_KEY=...
python3 arac.py yaz --tema "pazarda tek kişilik alışveriş" --cikti sarkilar
python3 arac.py yaz --tema "..." --kuru   # API çağırmadan istemleri yaz
```

Aynı ajan istemlerini (`agents/*.md`) kullanır. Güncel Claude modelleri
`temperature` almaz; çeşitlilik model ve yaklaşım farkıyla gelir
(`--taslak-modelleri opus:sade,fable:cesur,sonnet:anlati,opus:ezgisel`).

### Base model ham sesi

Instruct değil ön eğitimli bir modelde hizalamanın getirdiği tekdüzelik
yoktur. OpenAI uyumlu bir `/v1/completions` ucu (vLLM, llama.cpp sunucusu,
TGI) verirseniz korpustan seçilen şarkılar art arda verilip yenisinin
devamı yazdırılır; ham taslaklar baş editörün havuzuna girer. Ham ses
base modelden, disiplin büyük modelden.

```
export SOZ_BASE_URL=http://localhost:8000 SOZ_BASE_MODEL=<türkçe base model>
python3 arac.py ham --baslik "Çalışma başlığı" --sorgu "konsept" -n 2 -o taslaklar/
```

### Ölçüm araçları tek tek

```
python3 arac.py analiz korpus -o profiller/sezen-aksu.json --ad "Sezen Aksu"
python3 arac.py olc taslak.txt            # dördü birden
python3 arac.py prozodi taslak.txt
python3 arac.py klise taslak.txt
python3 arac.py stil taslak.txt
python3 arac.py ozgun taslak.txt
python3 arac.py uygula taslak.txt degisiklik.json
python3 arac.py kes-olc once.txt sonra.txt
python3 arac.py hakem-cifti taslak.txt -o cift.txt --anahtar anahtar.json
```

Şarkı biçimi düz metindir: `# Başlık`, köşeli parantezli bölüm etiketleri
(`[Kıta 1]`, `[Nakarat]`, `[Köprü]`), boş satırla ayrılan bölümler. İçi boş
bir `[Nakarat]` etiketi önceki nakaratın tekrarıdır.

## Profil

`profiller/sezen-aksu.json` şu an **tohum** profildir: sayılar korpustan
ölçülmedi, tahmindir; zanaat notları ve kaçındıkları elle yazıldı. 30–100
şarkılık korpusla `analiz` çalıştırınca sayılar ölçülmüş değerlerle değişir
(zanaat notları korunur). Ölçülmüş profil ve gerçek örnekler sistemin en
güçlü iki ayağıdır; korpussuz çalışma, hakemi de çift modundan adli moda
düşürür.

Başka bir yazar için: kendi korpusu, `analiz --ad "..."` ile yeni bir profil
dosyası ve isteğe bağlı elle zanaat notları; sonra `--profil` ile seçilir.

## Sınırlar

- Tavan: cömert kurulmuş prompt koşulunda bile uzman okur insan yazısını
  büyük oranda ayırt edebiliyor; sıradan okur ayırt edemiyor. Sistem geniş
  kitleyi hedefler, uzman kulağı garanti etmez.
- Vurgu çözümlemesi yaklaşıktır (özel adlar, vurgusuz ekler); yalnız uyarı
  üretir. Hece sayımı ve heceleme kurala dayanır ve güvenilirdir.
- Kip ve hitap ölçümleri ek kalıplarına bakar; mutlak değil göreli kıyas
  içindir (aynı ölçüt profile ve taslağa uygulanır).
- Adli modda (korpus yokken) hakem metnin üretildiğini bilerek okur ve her
  turda bir iz bulur; bu yüzden tur sayısı sınırlıdır. Çift modunda hakemin
  yanılması doğal durma ölçütüdür.

## Geliştirme

```
python3 -m unittest discover -s tests
claude plugin validate plugins/soz
```

Yalnız standart kütüphane; `anthropic` paketi yalnız `yaz` komutu için.
