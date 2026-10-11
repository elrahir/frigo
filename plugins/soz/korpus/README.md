# korpus

Kaynak yazarın şarkı sözleri buraya, şarkı başına bir `.txt` (ya da `.md`)
dosyası olarak konur. Bu dizin `.gitignore`'dadır: sözler telifli olduğu
için repoya girmez, yalnız sizin makinenizde durur.

Biçim:

```
# Şarkının adı
etiketler: ayrılık, şehir, ironi

[Kıta 1]
...

[Nakarat]
...
```

Başlık ve etiket satırı isteğe bağlıdır; etiketler dinamik örneklemede
eşleşmeye küçük bir ek puan verir. 30–100 şarkı yeterlidir. Sonra:

```
python3 arac.py analiz korpus -o profiller/sezen-aksu.json --ad "Sezen Aksu"
```

Bu komut tohum profildeki tahmini sayıları ölçülmüş değerlerle değiştirir;
zanaat notlarını ve kaçınılacak başlıkları korur.
