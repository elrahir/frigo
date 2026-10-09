# bombay

Claude Code için bir mod: sarı gözlü kara Bombay kedisi mesaj kutusunun
üstünde, sağda yaşar. Sanal evcil hayvan gibi açlığı, enerjisi ve keyfi
zamanla değişir ve ne yapacağını bunlar seçer. Vaktinin çoğu uykuda geçer:

- kıvrılıp uyur (z Z): nefes alır, kulağı seğirir, kuyruk ucu kıpırdar; arada
  başını kaldırıp bakar, yine dalar; uyanınca esner ve gerinir;
- oturur, göz kırpar, kuyruğunu sallar, yalanır, somun gibi yatar, gezinir;
- seyrek olarak: yumağını bulur (pusu, popo sallama, atlayış, pati), acıkınca
  mama kabına gider, ya da bandın bir ucundan öbürüne koşturur (zoomies);
- Claude çalışırken turuncu yıldızı iki kez kovalar, sonra yanında kestirir;
- tur bitince ♪ ile keyiflenir, bir araç hata verince sırtını kamburlaştırıp
  "!" ile irkilir.

Komutlar: `/bombay` gösterir ya da gizler (`show`, `hide`; tercih oturumlar
arası kalır), `/bombay feed` mama verir, `/bombay play` yumak atar,
`/bombay pet` sever (mırlar). Terminalde tıklamak da sevmektir; masaüstünde
üstüne gelince durur ve ♥ der.

## Küçük ekranlar

Kedinin yeri dört boydan biridir; `/bombay big|mini|line|auto` seçer, tercih
oturumlar arası kalır:

| Boy | Ne olur |
|---|---|
| `big` | Tam bant: masaüstünde 72 px, terminalde 6 satır. |
| `mini` | Yarım boy bant: masaüstünde 36 px (kedi yarı boyda, bandın sağ yarısında koşar), terminalde 5 satır (üstteki boş satır atılır, sıçrayış alçalır). |
| `line` | Bant yok: kedi istemin altındaki mod etiketlerinin sonuna iner ve yazıyla yaşar (`=^-ω-^= z`). Çoğunlukla uyur, arada gözünü açar, Claude çalışırken yıldızın iki yanına sıçrar, olaylara ♪ ! ♥ ile tepki verir. O satır zaten var; kedi hiç yer kaplamaz. |
| `auto` | Varsayılan. Ekranın ölçüsüne bakar: büyük ekranda `big`, orta boyda `mini`, küçükte `line`. |

`auto`'nun sınırları (`hooks/size.ts`): terminalde 36 satır ve 100 sütundan
itibaren `big`, 20 satırın ya da 60 sütunun altında `line`; masaüstünde 50
satır ve 100 sütundan itibaren `big`, 24 satırın ya da 50 sütunun altında
`line` (satır ve sütun, uygulamanın kod yazı tipinin hücreleri). Yalnız
yüksekliğin değişmesi yeniden çizim tetiklemez; boy bir sonraki çizimde
(genişlik değişince, tur başlayıp bitince) güncellenir.

- Terminal: yarım blok (▀▄) piksel çizimi, 10 kare/sn, 6 satırlık bant
  (`mini`'de 5).
- Masaüstü (Code sekmesi): kendi kendine oynayan vektör SVG (piksel yok),
  4-5 dakikalık gündem döngüsü; uykuyla açılır, zamanın ~%70'i uykudur,
  oyun, mama ve koşu birer kez gelir. Kedi kareler arasında kayarak yürür;
  uykudaki nefes, kulak ve kuyruk kendi SMIL döngülerinde oynar. Mama ve oyun
  komutları döngüden önce bir kez oynar.

Masaüstü uygulaması bandı mesaj kutusu genişliğinde, kenarlıklı bir
çerçevede çizer; o çerçeve uygulamanındır, eklenti API'si (2.1.289)
kaldırmaya izin vermez. Kedinin kendi zemini şeffaftır. Çerçeveden tümden
kurtulmanın yolu `line` boyudur: bant, `hide`'daki gibi boş kalır.

Bant yalnız terminal ve masaüstü uygulamasının yerel oturumlarında çizilir;
bulut oturumlarında modlar hiçbir şey çizmez. Masaüstünde Claude Code
2.1.286 ya da üstü gerekir. Bandı başka bir mod da çiziyorsa biri gizlenir
(ör. `/bombay hide`).

## Kurulum

Repo kökündeki `.claude-plugin/marketplace.json` bu repoyu bir marketplace
yapar. Terminalden (Windows'ta PowerShell):

```
claude plugin marketplace add elrahir/frigo
claude plugin install bombay@frigo
```

Marketplace daha önce eklendiyse ilk satır gerekmez; güncellemek için
`claude plugin marketplace update frigo && claude plugin update bombay@frigo`.
Kurulduktan sonra yeni bir oturum aç.

## Geliştirme

```
claude plugin validate plugins/bombay
claude plugin test plugins/bombay
```

Terminal çizimleri `hooks/art.ts`'te (22×8 piksel pozlar), masaüstü
çizimleri `hooks/vector.ts`'te (aynı 22×8 birimlik kutuda vektör pozlar),
davranış `hooks/cat.ts`'te (ihtiyaçlar, etkinlik planları, adımlar), ızgara
ve yarım bloklar `hooks/paint.ts`'te, terminal `hooks/cat-term.tsx`,
masaüstü SVG derleyicisi `hooks/svg.ts`, boy seçimi ve alt satırdaki yazı
kedi `hooks/size.ts`, kancalar `hooks/register.tsx`.
Yeni bir poz iki yere çizilir: `art.ts` (piksel) ve `vector.ts` (vektör).
