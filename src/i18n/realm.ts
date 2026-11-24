/**
 * Abadiyat olami ma'lumotlari (src/realm/data/*.json) uchun tarjima: o'zbekcha matn → [rus, ingliz].
 * JSON o'zbekcha qoladi (server va o'yin mantig'i shu bilan ishlaydi); klient olamni yuklaganda
 * translateRealmData() matnlarni joriy tilga almashtiradi. Yangi matn qo'shilsa — shu yerga ham (test tekshiradi).
 */
export const REALM_TR: Record<string, readonly [ru: string, en: string]> = {
  "TO'NG'IZ BALOSI": ["КАБАНЬЯ НАПАСТЬ", "BOAR TROUBLE"],
  "Oqsoqol dalalarni payhon qilayotgan yovvoyi to'ng'izlarni haydashni so'radi.": [
    "Старейшина просил прогнать диких кабанов, что топчут поля.",
    "The elder asked you to drive off the wild boars trampling the fields.",
  ],
  "To'ng'izlarni yeng": ["Победи кабанов", "Defeat the boars"],
  "XAROBA SIRI": ["ТАЙНА РУИН", "SECRET OF THE RUINS"],
  "Xarobalardagi tosh askarlar uyg'ondi. Oqsoqol sababini bilmoqchi.": [
    "В руинах пробудились каменные солдаты. Старейшина хочет знать почему.",
    "Stone soldiers have awoken in the ruins. The elder wants to know why.",
  ],
  "Savdogar bilan gaplash": ["Поговори с торговцем", "Talk to the merchant"],
  "Qadimiy xarobalarni top": ["Найди древние руины", "Find the ancient ruins"],
  "Tosh yurakni oqsoqolga olib bor": [
    "Отнеси каменное сердце старейшине",
    "Bring the stone heart to the elder",
  ],
  "IBLISNING SHOXI": ["РОГ ДЬЯВОЛА", "THE DEVIL'S HORN"],
  "Oqsoqol Iblis rostdan Abadiyat olamidan kelganini bilmoqchi. Qal'adagi (1-dunyo) Iblisni yeng — uning shoxi olamga keladi.":
    [
      "Старейшина хочет знать, правда ли Дьявол пришёл из Мира Вечности. Победи Дьявола в крепости (мир 1) — его рог попадёт в этот мир.",
      "The elder wants to know if the Devil truly came from the Realm of Eternity. Defeat the Devil in the castle (world 1) — his horn will appear in the realm.",
    ],
  "Iblisni yeng va shoxini oqsoqolga olib kel": [
    "Победи Дьявола и принеси его рог старейшине",
    "Defeat the Devil and bring his horn to the elder",
  ],
  "HO'L POROX": ["МОКРЫЙ ПОРОХ", "WET POWDER"],
  "Botqoq kalamushlari Qari Merganning porox xaltasini kemirib ketdi. Botqoqlikdagi 3 ta kalamushni ovla.":
    [
      "Болотные крысы прогрызли пороховой мешок Старого Стрелка. Выследи 3 крыс на болоте.",
      "Swamp rats chewed through Old Gunslinger's powder bag. Hunt down 3 rats in the swamp.",
    ],
  "Qari Merganga qayt": ["Вернись к Старому Стрелку", "Return to Old Gunslinger"],
  "Botqoq kalamushlarini ovla": ["Выследи болотных крыс", "Hunt the swamp rats"],
  "KUL ITLARI": ["ПЕПЕЛЬНЫЕ ПСЫ", "ASH HOUNDS"],
  "Kul itlari to'dasi rohib qo'nog'ini o'rab olgan. Dala bo'ylab 6 tasini yeng.": [
    "Стая пепельных псов окружила стоянку монаха. Победи 6 из них в поле.",
    "A pack of ash hounds has surrounded the monk's camp. Defeat 6 of them in the field.",
  ],
  "Rohibga qayt": ["Вернись к монаху", "Return to the monk"],
  "Kul itlarini yeng": ["Победи пепельных псов", "Defeat the ash hounds"],
  "OBSIDIAN QO'RIQCHILAR": ["ОБСИДИАНОВЫЕ СТРАЖИ", "OBSIDIAN GUARDIANS"],
  "Rohib ibodatxona qo'riqchilari nega uyg'onganini bilmoqchi. Obsidian xarobalarni top va 3 ta obsidian parchasi olib kel.":
    [
      "Монах хочет знать, почему пробудились стражи храма. Найди обсидиановые руины и принеси 3 осколка обсидиана.",
      "The monk wants to know why the temple guardians woke up. Find the obsidian ruins and bring back 3 obsidian shards.",
    ],
  "Obsidian xarobalarni top": ["Найди обсидиановые руины", "Find the obsidian ruins"],
  "Obsidian parchalarini rohibga olib bor": [
    "Отнеси осколки обсидиана монаху",
    "Bring the obsidian shards to the monk",
  ],
  "IBODATXONA ESHIGI": ["ВРАТА ХРАМА", "THE TEMPLE GATE"],
  "Iblis ibodatxonasida Kul qiroli uyg'onmoqda. Ibodatxonani top va yo'ldagi lava qurtlarini haydab kel.":
    [
      "В храме Дьявола пробуждается Пепельный король. Найди храм и прогони лавовых червей на пути.",
      "The Ash King is stirring in the Devil's temple. Find the temple and drive off the lava worms on the way.",
    ],
  "Iblis ibodatxonasini top": ["Найди храм Дьявола", "Find the Devil's temple"],
  "Lava qurtlarini yeng": ["Победи лавовых червей", "Defeat the lava worms"],
  NON: ["ХЛЕБ", "BREAD"],
  "1 yurak tiklaydi.": ["Восстанавливает 1 сердце.", "Restores 1 heart."],
  "SHIFO DAMLAMASI": ["ЦЕЛЕБНЫЙ ОТВАР", "HEALING BREW"],
  "3 yurak tiklaydi.": ["Восстанавливает 3 сердца.", "Restores 3 hearts."],
  "TO'NG'IZ GO'SHTI": ["КАБАНЬЕ МЯСО", "BOAR MEAT"],
  "2 yurak tiklaydi.": ["Восстанавливает 2 сердца.", "Restores 2 hearts."],
  "TO'NG'IZ QOZIG'I": ["КАБАНИЙ КЛЫК", "BOAR TUSK"],
  "Savdogar yaxshi narx beradi.": ["Торговец хорошо заплатит.", "The merchant pays well for it."],
  "KALAMUSH DUMI": ["КРЫСИНЫЙ ХВОСТ", "RAT TAIL"],
  "Botqoq hidi kelib turibdi.": ["Пахнет болотом.", "Smells of swamp."],
  "TOSH YURAK": ["КАМЕННОЕ СЕРДЦЕ", "STONE HEART"],
  "Tosh askarning hali iliq yuragi.": [
    "Ещё тёплое сердце каменного солдата.",
    "A stone soldier's still-warm heart.",
  ],
  "RUH UCHQUNI": ["ИСКРА ДУШИ", "SOUL SPARK"],
  "Qo'lda sekin miltillaydi.": ["Тихо мерцает в руке.", "Flickers softly in your hand."],
  "YULDUZ PARCHASI": ["ОСКОЛОК ЗВЕЗДЫ", "STAR SHARD"],
  "Tunda osmondan tushgan.": ["Упал с неба ночью.", "Fell from the sky at night."],
  "QADIMIY TANGA": ["ДРЕВНЯЯ МОНЕТА", "ANCIENT COIN"],
  "Qal'a zarbxonasining tangasi.": [
    "Монета крепостного монетного двора.",
    "A coin from the castle mint.",
  ],
  "OQSOQOL TUMORI": ["АМУЛЕТ СТАРЕЙШИНЫ", "ELDER'S AMULET"],
  "Inventarda: +1 yurak.": ["В инвентаре: +1 сердце.", "In inventory: +1 heart."],
  "TUNGI UZUK": ["НОЧНОЕ КОЛЬЦО", "NIGHT RING"],
  "Inventarda: tez yurish, tunda keng yorug'lik.": [
    "В инвентаре: быстрый шаг, ночью шире свет.",
    "In inventory: faster movement, wider light at night.",
  ],
  "SARDOR QILICHI": ["МЕЧ КОМАНДИРА", "CAPTAIN'S SWORD"],
  "Inventarda: +1 zarar.": ["В инвентаре: +1 урон.", "In inventory: +1 damage."],
  "IBLIS SHOXI": ["РОГ ДЬЯВОЛА", "DEVIL'S HORN"],
  "Qal'adagi Iblisdan qolgan. Hali ham issiq.": [
    "Остался от Дьявола из крепости. Всё ещё горячий.",
    "Left by the Devil from the castle. Still hot.",
  ],
  "IBLIS O'TI TUMORI": ["АМУЛЕТ ДЬЯВОЛЬСКОГО ПЛАМЕНИ", "DEVILFIRE AMULET"],
  "Inventarda: +1 yurak, tunda keng yorug'lik.": [
    "В инвентаре: +1 сердце, ночью шире свет.",
    "In inventory: +1 heart, wider light at night.",
  ],
  "MIS GILZA": ["МЕДНАЯ ГИЛЬЗА", "BRASS CASING"],
  "Qari Merganning omad tumori. Inventarda: tez yurish.": [
    "Талисман удачи Старого Стрелка. В инвентаре: быстрый шаг.",
    "Old Gunslinger's lucky charm. In inventory: faster movement.",
  ],
  "KUL ITI TISHI": ["ЗУБ ПЕПЕЛЬНОГО ПСА", "ASH HOUND FANG"],
  "Hali ham issiq. Savdogar yaxshi narx beradi.": [
    "Ещё горячий. Торговец хорошо заплатит.",
    "Still hot. The merchant pays well for it.",
  ],
  "MAGMA TOSHI": ["МАГМОВЫЙ КАМЕНЬ", "MAGMA STONE"],
  "Qo'lda sekin qizarib turadi.": ["Медленно накаляется в руке.", "Slowly glows red in your hand."],
  "OBSIDIAN PARCHASI": ["ОСКОЛОК ОБСИДИАНА", "OBSIDIAN SHARD"],
  "Qora oyna kabi yaltiraydi.": ["Блестит, как чёрное стекло.", "Gleams like black glass."],
  "ROHIB TASBEHI": ["ЧЁТКИ МОНАХА", "MONK'S PRAYER BEADS"],
  "Inventarda: tunda keng yorug'lik.": [
    "В инвентаре: ночью шире свет.",
    "In inventory: wider light at night.",
  ],
  "CHO'G' YURAK": ["УГОЛЬНОЕ СЕРДЦЕ", "EMBER HEART"],
  "KUL PLASHI": ["ПЕПЕЛЬНЫЙ ПЛАЩ", "ASH CLOAK"],
  "Inventarda: lava ikki baravar sekin kuydiradi.": [
    "В инвентаре: лава жжёт вдвое медленнее.",
    "In inventory: lava burns half as fast.",
  ],
  "OBSIDIAN XANJAR": ["ОБСИДИАНОВЫЙ КИНЖАЛ", "OBSIDIAN DAGGER"],
  "QAQNUS PATI": ["ПЕРО ФЕНИКСА", "PHOENIX FEATHER"],
  "Lava qa'ridan. Inventarda: +1 yurak va tez yurish.": [
    "Из глубин лавы. В инвентаре: +1 сердце и быстрый шаг.",
    "From the depths of the lava. In inventory: +1 heart and faster movement.",
  ],
  "EGIZAK JON TUMORI": ["АМУЛЕТ ДВУХ ДУШ", "TWIN SOUL AMULET"],
  "Ikki do'st birga topgan. Inventarda: +1 yurak, +1 zarar.": [
    "Двое друзей нашли его вместе. В инвентаре: +1 сердце, +1 урон.",
    "Two friends found it together. In inventory: +1 heart, +1 damage.",
  ],
  "KUL TOJI": ["ПЕПЕЛЬНАЯ КОРОНА", "ASH CROWN"],
  "Kul qirolining alangali toji. Inventarda: +2 yurak.": [
    "Пылающая корона Пепельного короля. В инвентаре: +2 сердца.",
    "The Ash King's blazing crown. In inventory: +2 hearts.",
  ],
  "QIROL TIG'I": ["КОРОЛЕВСКИЙ КЛИНОК", "KING'S BLADE"],
  "Kul qirolining olovli tig'i. Inventarda: +1 zarar, lava sekinroq kuydiradi.": [
    "Огненный клинок Пепельного короля. В инвентаре: +1 урон, лава жжёт медленнее.",
    "The Ash King's fiery blade. In inventory: +1 damage, lava burns slower.",
  ],
  "BOSHLANG'ICH VODIY": ["НАЧАЛЬНАЯ ДОЛИНА", "STARTING VALLEY"],
  QISHLOQ: ["ДЕРЕВНЯ", "VILLAGE"],
  "O'RMON CHETI": ["ОПУШКА ЛЕСА", "FOREST EDGE"],
  "ESKI KO'PRIK": ["СТАРЫЙ МОСТ", "OLD BRIDGE"],
  "TO'NG'IZ O'TLOG'I": ["КАБАНИЙ ЛУГ", "BOAR MEADOW"],
  BOTQOQLIK: ["БОЛОТО", "SWAMP"],
  "QADIMIY XAROBALAR": ["ДРЕВНИЕ РУИНЫ", "ANCIENT RUINS"],
  "SARDOR ZALI": ["ЗАЛ КОМАНДИРА", "CAPTAIN'S HALL"],
  "G'OR KIRISHI": ["ВХОД В ПЕЩЕРУ", "CAVE ENTRANCE"],
  "UCH DARVOZA": ["ТРОЕ ВРАТ", "THREE GATES"],
  OQSOQOL: ["СТАРЕЙШИНА", "ELDER"],
  SAVDOGAR: ["ТОРГОВЕЦ", "MERCHANT"],
  "QARI MERGAN": ["СТАРЫЙ СТРЕЛОК", "OLD GUNSLINGER"],
  "Sharq — Eski ko'prik va xarobalar.": [
    "Восток — Старый мост и руины.",
    "East — the Old Bridge and the ruins.",
  ],
  "Shimol — o'rmon. Janub — botqoqlik.": [
    "Север — лес. Юг — болото.",
    "North — the forest. South — the swamp.",
  ],
  "Uch olov, uch belgi.": ["Три огня, три знака.", "Three fires, three signs."],
  "Avval tun uyg'onar, so'ng tong otar,": [
    "Сперва проснётся ночь, затем взойдёт заря,",
    "First the night awakens, then the dawn breaks,",
  ],
  "oxirida yo'lchi yulduzi yonar.": [
    "а в конце зажжётся путеводная звезда.",
    "and at last the traveler's star alights.",
  ],
  "IBLIS DARVOZASI": ["ВРАТА ДЬЯВОЛА", "DEVIL GATE"],
  "MUZ DARVOZASI": ["ЛЕДЯНЫЕ ВРАТА", "ICE GATE"],
  "O'RMON DARVOZASI": ["ЛЕСНЫЕ ВРАТА", "FOREST GATE"],
  "QADIMIY TOSH YOZUV": ["ДРЕВНЯЯ КАМЕННАЯ НАДПИСЬ", "ANCIENT STONE INSCRIPTION"],
  "Abadiyat olamining olovli tubida bir jin tug'ildi — qo'riqchilar uni Iblis deb atadi.": [
    "В огненных недрах Мира Вечности родился демон — стражи назвали его Дьяволом.",
    "In the fiery depths of the Realm of Eternity a demon was born — the guardians named him the Devil.",
  ],
  "U olam qal'asini yondirmoqchi bo'ldi. Qo'riqchilar uni g'arbdagi uch darvozaning biriga haydab, ortidan qulfladilar.":
    [
      "Он хотел сжечь крепость мира. Стражи загнали его в одни из трёх врат на западе и заперли за ним.",
      "He sought to burn the realm's castle. The guardians drove him into one of the three gates in the west and locked it behind him.",
    ],
  "Darvoza ortida u boshqa dunyoda yangi qal'a topdi. Muz va o'rmon hukmdorlari ham uning izidan ketdi.":
    [
      "За вратами он нашёл новую крепость в другом мире. Владыки льда и леса последовали за ним.",
      "Beyond the gate he found a new castle in another world. The lords of ice and forest followed in his wake.",
    ],
  "Qo'riqchilar qasam ichdi: darvozalar qayta ochilguncha uxlamaymiz. Ular toshga aylandi, ammo hanuz kutishadi...":
    [
      "Стражи поклялись: не уснём, пока врата не откроются вновь. Они обратились в камень, но всё ещё ждут...",
      "The guardians swore: we will not sleep until the gates open again. They turned to stone, yet still they wait...",
    ],
  "KUL TOG'I": ["ПЕПЕЛЬНАЯ ГОРА", "ASH MOUNTAIN"],
  "KUL DARVOZASI": ["ПЕПЕЛЬНЫЕ ВРАТА", "ASH GATE"],
  "ROHIB QO'NOG'I": ["СТОЯНКА МОНАХА", "MONK'S CAMP"],
  "KUL DALASI": ["ПЕПЕЛЬНОЕ ПОЛЕ", "ASH FIELD"],
  "LAVA KO'LI": ["ЛАВОВОЕ ОЗЕРО", "LAVA LAKE"],
  "QORA KO'PRIK": ["ЧЁРНЫЙ МОСТ", "BLACK BRIDGE"],
  "OBSIDIAN XAROBALAR": ["ОБСИДИАНОВЫЕ РУИНЫ", "OBSIDIAN RUINS"],
  "IBLIS IBODATXONASI": ["ХРАМ ДЬЯВОЛА", "DEVIL'S TEMPLE"],
  "KUL QIROLI ZALI": ["ЗАЛ ПЕПЕЛЬНОГО КОРОЛЯ", "ASH KING'S HALL"],
  "SURGUN QILINGAN ROHIB": ["ИЗГНАННЫЙ МОНАХ", "EXILED MONK"],
  "VODIY DARVOZASI": ["ВРАТА В ДОЛИНУ", "VALLEY GATE"],
  "KUL TOG'I.": ["ПЕПЕЛЬНАЯ ГОРА.", "ASH MOUNTAIN."],
  "Qizil daryo — lava: ustidan yursang kuyasan.": [
    "Красная река — лава: пройдёшь по ней — сгоришь.",
    "The red river is lava: walk on it and you'll burn.",
  ],
  "Rohib qo'nog'i shu yaqinda, yo'l bo'yida.": [
    "Стоянка монаха рядом, у дороги.",
    "The monk's camp is close by, along the road.",
  ],
  "Ikki plita — ikki jon.": ["Две плиты — две души.", "Two plates — two souls."],
  "Yolg'iz yo'lchiga qurbongoh ochilmas.": [
    "Одинокому путнику алтарь не откроется.",
    "The altar won't open for a lone traveler.",
  ],
  "Uch mangal, uch belgi.": ["Три жаровни, три знака.", "Three braziers, three signs."],
  "Avval qirolning toji yondi,": [
    "Сперва вспыхнула корона короля,",
    "First the king's crown caught fire,",
  ],
  "so'ng bosh suyaklar sochildi,": ["затем рассыпались черепа,", "then the skulls were scattered,"],
  "oxirida olov abadiy qoldi.": [
    "и наконец огонь остался навеки.",
    "and at last the fire remained forever.",
  ],
  "KUL BITIKLARI": ["ПЕПЕЛЬНЫЕ ПИСЬМЕНА", "ASH SCRIPTURES"],
  "Olovli tub — Kul tog'ining qa'ri. U yerda Kul qiroli hukm surardi: lava va olovdan yasalgan ulkan jangchi.":
    [
      "Огненные недра — сердце Пепельной горы. Там правил Пепельный король: исполинский воин из лавы и пламени.",
      "The fiery depths are the heart of Ash Mountain. There ruled the Ash King: a giant warrior of lava and flame.",
    ],
  "Qirol yolg'iz edi. U o'z kulidan o'g'il yasab, unga olov yuragini berdi. Bu o'g'il — Iblis edi.":
    [
      "Король был одинок. Он слепил сына из собственного пепла и отдал ему огненное сердце. Этим сыном был Дьявол.",
      "The king was alone. He shaped a son from his own ashes and gave him a heart of fire. That son was the Devil.",
    ],
  "Iblis otasidan ham ochko'z chiqdi va olam qal'asini yondirmoqchi bo'ldi. Qirol uni to'xtatmadi: \"Olov hammasini tozalaydi\", dedi.":
    [
      "Дьявол оказался жаднее отца и захотел сжечь крепость мира. Король не остановил его: «Огонь очищает всё», — сказал он.",
      'The Devil proved greedier than his father and sought to burn the realm\'s castle. The king did not stop him: "Fire cleanses all," he said.',
    ],
  "Quyosh ritsarlari qirolni ibodatxonaning ichki zaliga zanjirband qildi. Zanjirlar Iblis o'tiga bog'langan: Iblis yengilgan kuni ular bo'shaydi...":
    [
      "Рыцари Солнца приковали короля цепями во внутреннем зале храма. Цепи связаны с огнём Дьявола: в день, когда Дьявол падёт, они ослабнут...",
      "The Knights of the Sun chained the king in the temple's inner hall. The chains are bound to the Devil's fire: on the day the Devil falls, they will loosen...",
    ],
  "GILDIYA ZALI": ["ЗАЛ ГИЛЬДИИ", "GUILD HALL"],
  "Xush kelibsan, yo'lchi. Bu — Abadiyat olamidagi Boshlang'ich vodiy.": [
    "Добро пожаловать, путник. Это — Начальная долина в Мире Вечности.",
    "Welcome, traveler. This is the Starting Valley in the Realm of Eternity.",
  ],
  "Qal'angga hujum qilgan Iblis ham shu olamdan chiqqan. Sen uni yengding — shuning uchun darvoza senga ochildi.":
    [
      "Дьявол, напавший на твою крепость, тоже вышел из этого мира. Ты победил его — потому врата и открылись тебе.",
      "The Devil who attacked your castle came from this realm too. You defeated him — that's why the gate opened for you.",
    ],
  "Senga qanday yordam bera olaman?": ["Чем я могу помочь?", "How can I help you?"],
  "To'ng'izlarni haydab yubordim.": ["Я прогнал кабанов.", "I drove off the boars."],
  "To'ng'izlar haqida...": ["Насчёт кабанов...", "About the boars..."],
  "Yana ish bormi?": ["Есть ещё работа?", "Any more work?"],
  "Tosh yuraklarni olib keldim.": ["Я принёс каменные сердца.", "I brought the stone hearts."],
  "Xarobalar haqida...": ["Насчёт руин...", "About the ruins..."],
  "Iblisning shoxini olib keldim.": ["Я принёс рог Дьявола.", "I brought the Devil's horn."],
  "Iblisning shoxi haqida...": ["Насчёт рога Дьявола...", "About the Devil's horn..."],
  "Darvozalar haqida gapirib ber.": ["Расскажи о вратах.", "Tell me about the gates."],
  "Vodiy haqida gapirib ber.": ["Расскажи о долине.", "Tell me about the valley."],
  "Xayr.": ["Прощай.", "Farewell."],
  "Yovvoyi to'ng'izlar dalalarimizni payhon qilmoqda.": [
    "Дикие кабаны топчут наши поля.",
    "Wild boars are trampling our fields.",
  ],
  "Daryo ortidagi o'tloqqa borib, 4 tasini yeng. Ehtiyot bo'l: tuyog'ini yerga ursa — hozir tashlanadi!":
    [
      "Ступай на луг за рекой и победи четверых. Осторожно: если бьёт копытом о землю — сейчас бросится!",
      "Go to the meadow across the river and defeat four of them. Careful: when one paws the ground, it's about to charge!",
    ],
  "Mayli, qilaman.": ["Ладно, сделаю.", "All right, I'll do it."],
  "Keyinroq.": ["Позже.", "Later."],
  "To'ng'izlar eski ko'prikdan sharqdagi o'tloqda.": [
    "Кабаны на лугу к востоку от старого моста.",
    "The boars are in the meadow east of the old bridge.",
  ],
  "Tashlanganda chetga o't — daraxtga urilsa, boshi aylanib qoladi.": [
    "Когда бросится — отойди в сторону: врежется в дерево — и закружится голова.",
    "When it charges, step aside — if it hits a tree, it'll get dizzy.",
  ],
  "Tushundim.": ["Понял.", "Got it."],
  "Rahmat, yo'lchi! Ol, yo'lda asqotadi.": [
    "Спасибо, путник! Держи, пригодится в дороге.",
    "Thank you, traveler! Take this — it'll come in handy on the road.",
  ],
  "Rahmat.": ["Спасибо.", "Thank you."],
  "Sharqdagi xarobalarda tosh askarlar qimirlay boshladi.": [
    "В руинах на востоке зашевелились каменные солдаты.",
    "The stone soldiers in the eastern ruins have started to stir.",
  ],
  "Savdogar u yerda bo'lgan — avval u bilan gaplash. Keyin xarobani top va menga 2 ta Tosh yurak olib kel.":
    [
      "Торговец там бывал — сперва поговори с ним. Потом найди руины и принеси мне 2 каменных сердца.",
      "The merchant has been there — talk to him first. Then find the ruins and bring me 2 stone hearts.",
    ],
  "Boraman.": ["Пойду.", "I'll go."],
  "Hozir emas.": ["Не сейчас.", "Not now."],
  "Tosh askarlar haykal bo'lib turadi — yaqinlashsang uyg'onadi.": [
    "Каменные солдаты стоят как статуи — подойдёшь, и они проснутся.",
    "The stone soldiers stand like statues — come close and they wake up.",
  ],
  "Qo'llarini ko'tarsa, yerga urishidan oldin uzoqlash.": [
    "Поднимают руки — отходи, пока не ударили о землю.",
    "When they raise their arms, back off before they slam the ground.",
  ],
  "Yaxshi.": ["Хорошо.", "Okay."],
  "Bu yuraklar hali iliq... Demak, Sardor uyg'ongan.": [
    "Эти сердца ещё тёплые... Значит, Командир проснулся.",
    "These hearts are still warm... So the Captain has awoken.",
  ],
  "Mana bu tumor ota-bobolarimdan qolgan. Senga ko'proq kerak.": [
    "Этот амулет достался мне от предков. Тебе он нужнее.",
    "This amulet was passed down from my ancestors. You need it more.",
  ],
  "Rahmat, oqsoqol.": ["Спасибо, старейшина.", "Thank you, elder."],
  "Vodiy qadimiy yo'llar chorrahasida turibdi.": [
    "Долина стоит на перекрёстке древних дорог.",
    "The valley stands at a crossroads of ancient roads.",
  ],
  "Aytishlaricha, tunda xarobalarda oy nuri boshqacha tushar ekan...": [
    "Говорят, ночью лунный свет в руинах падает по-особенному...",
    "They say the moonlight falls differently in the ruins at night...",
  ],
  "Baliqchilar esa daryoda pufakchalar chiqadigan bir joy borligini aytishadi.": [
    "А рыбаки рассказывают, что на реке есть место, где поднимаются пузыри.",
    "And fishermen say there's a spot on the river where bubbles rise.",
  ],
  "Qiziq.": ["Любопытно.", "Interesting."],
  "Qal'angdagi Iblis, Qor Malikasi va O'rmon Shohi — hammasi Abadiyat olamidan kelgan.": [
    "Дьявол, Снежная Королева и Лесной Король из твоей крепости — все пришли из Мира Вечности.",
    "The Devil, the Snow Queen and the Forest King of your castle — all came from the Realm of Eternity.",
  ],
  "Ishonmasam, Iblisning shoxini ko'rsat. Qal'aga qaytib, Iblisni yana bir bor yeng — shoxi o'zi shu olamga keladi.":
    [
      "Не веришь — покажи рог Дьявола. Вернись в крепость и победи Дьявола ещё раз — его рог сам попадёт в этот мир.",
      "Don't believe me? Show me the Devil's horn. Return to the castle and defeat the Devil once more — his horn will come to this realm on its own.",
    ],
  "Shoxni olib kelaman.": ["Принесу рог.", "I'll bring the horn."],
  "Iblisni qal'ada (1-dunyoda) yeng. Topshiriq faol bo'lsa, uning shoxi inventaringga tushadi.": [
    "Победи Дьявола в крепости (в мире 1). Если задание активно, его рог попадёт в твой инвентарь.",
    "Defeat the Devil in the castle (world 1). If the quest is active, his horn will drop into your inventory.",
  ],
  "Keyin men bilan gaplash.": ["Потом поговори со мной.", "Then talk to me."],
  "Bu shox... olam olovi bilan yonib turibdi. Demak, rost ekan.": [
    "Этот рог... пылает огнём мира. Значит, это правда.",
    "This horn... it burns with the realm's fire. So it's true.",
  ],
  "Ol, bu tumor Iblis o'tidan yasalgan — tunda yo'lingni yoritadi.": [
    "Держи, этот амулет выкован из огня Дьявола — ночью он осветит тебе путь.",
    "Take this amulet, forged from the Devil's fire — it will light your way at night.",
  ],
  "Vodiyning g'arbiy chetida uchta qadimiy darvoza bor.": [
    "На западном краю долины стоят трое древних врат.",
    "At the western edge of the valley stand three ancient gates.",
  ],
  "Iblis, Qor Malikasi va O'rmon Shohi o'sha darvozalardan chiqib, sening uch dunyongga borgan.": [
    "Дьявол, Снежная Королева и Лесной Король вышли из этих врат и пришли в твои три мира.",
    "The Devil, the Snow Queen and the Forest King came out of those gates and into your three worlds.",
  ],
  "Har birini yengsang, uning darvozasi kaliti senda qoladi.": [
    "Победишь каждого — ключ от его врат останется у тебя.",
    "Defeat each one and the key to their gate stays with you.",
  ],
  "Keling, keling! Mollarim arzon, sifati — a'lo!": [
    "Заходите, заходите! Товар дешёвый, качество — отличное!",
    "Come in, come in! Cheap goods, top quality!",
  ],
  "Nimalar bor?": ["Что у тебя есть?", "What do you have?"],
  "Xarobalarda bo'lganmisan?": ["Ты бывал в руинах?", "Have you been to the ruins?"],
  "Iblis haqida eshitganmisan?": ["Слышал о Дьяволе?", "Have you heard of the Devil?"],
  "Bo'ldim, xudo saqlasin! Ko'prikdan o'tib, yo'l bo'ylab sharqqa yuring.": [
    "Бывал, упаси бог! Перейдите мост и идите по дороге на восток.",
    "I have, heaven help me! Cross the bridge and follow the road east.",
  ],
  "Ichkarida zirhli ulkan tosh jangchi bor — Xaroba Sardori. Unga yolg'iz bormang, shifo damlamasi oling.":
    [
      "Внутри огромный каменный воин в доспехах — Командир Руин. Не ходите к нему в одиночку, возьмите целебный отвар.",
      "Inside is a huge armored stone warrior — the Ruins Captain. Don't face him alone, take a healing brew.",
    ],
  "Damlama sotib olaman.": ["Куплю отвар.", "I'll buy a brew."],
  "Eshitmay bo'ladimi! Iblis bir paytlar shu vodiyda yurgan.": [
    "Как не слышать! Дьявол когда-то бродил по этой долине.",
    "Who hasn't! The Devil once roamed this very valley.",
  ],
  "Keyin g'arbdagi darvozadan chiqib, boshqa dunyoga ketgan. Qor Malikasi va O'rmon Shohi ham shunday.":
    [
      "Потом ушёл через западные врата в другой мир. Снежная Королева и Лесной Король — тоже.",
      "Then he left through the western gate into another world. So did the Snow Queen and the Forest King.",
    ],
  "Xarobalardagi tosh yozuv bo'laklarini topsang, ko'proq bilasan.": [
    "Найдёшь обломки каменной надписи в руинах — узнаешь больше.",
    "Find the pieces of the stone inscription in the ruins and you'll learn more.",
  ],
  "Ha, yo'lchi... Meni Qari Mergan deyishadi. Yoshligimda bu vodiyda nishonni mendan yaxshi uradigan topilmasdi.":
    [
      "Да, путник... Меня зовут Старым Стрелком. В молодости никто в долине не стрелял метче меня.",
      "Yes, traveler... They call me Old Gunslinger. In my youth no one in the valley shot straighter than me.",
    ],
  "Endi ko'zim xira, qo'lim titraydi. Lekin shogirdim bor — Mergan. U hozir sening qal'angda xizmat qiladi.":
    [
      "Теперь глаза слабы, руки дрожат. Но у меня есть ученик — Стрелок. Он сейчас служит в твоей крепости.",
      "Now my eyes are dim and my hands shake. But I have an apprentice — the Gunslinger. He serves in your castle now.",
    ],
  "Yordam kerakmi?": ["Нужна помощь?", "Need help?"],
  "Kalamushlarni ovladim.": ["Я выследил крыс.", "I hunted down the rats."],
  "Kalamushlar haqida...": ["Насчёт крыс...", "About the rats..."],
  "Mergan haqida gapirib ber.": ["Расскажи о Стрелке.", "Tell me about the Gunslinger."],
  "O, shogirdim! Qal'adan omon qaytibsan-ku. Barabaning toza, poroxing quruqmi?": [
    "О, мой ученик! Вернулся из крепости живым. Барабан чист, порох сух?",
    "Oh, my apprentice! Back from the castle alive. Is your cylinder clean, your powder dry?",
  ],
  "Esingda bo'lsin: oltita o'q — oltita imkon. Birortasini ham bekorga otma.": [
    "Помни: шесть пуль — шесть шансов. Ни одной не трать впустую.",
    "Remember: six bullets — six chances. Don't waste a single one.",
  ],
  "Ustoz, sizga qanday yordam beray?": ["Учитель, чем вам помочь?", "Master, how can I help you?"],
  "Kalamushlarni ovladim, ustoz.": ["Я выследил крыс, учитель.", "I hunted down the rats, master."],
  "Ustoz, maslahat bering.": ["Учитель, дайте совет.", "Master, give me advice."],
  "Xayr, ustoz.": ["Прощайте, учитель.", "Farewell, master."],
  "Janubdagi botqoq kalamushlari porox xaltamni kemirib ketdi. Endi yarmi ho'l...": [
    "Болотные крысы с юга прогрызли мой пороховой мешок. Теперь половина промокла...",
    "Swamp rats from the south chewed through my powder bag. Now half of it is wet...",
  ],
  "Botqoqlikdagi 3 ta kalamushni ovla. Ular tez qochadi — uzoqdan ur.": [
    "Выследи 3 крыс на болоте. Они быстро убегают — бей издалека.",
    "Hunt down 3 rats in the swamp. They flee fast — strike from range.",
  ],
  "Ovlab kelaman.": ["Выслежу.", "I'll hunt them."],
  "Kalamushlar janubdagi botqoqlikda, qamishlar orasida yashaydi.": [
    "Крысы живут на болоте к югу, среди камышей.",
    "The rats live in the swamp to the south, among the reeds.",
  ],
  "Urilgan kalamush qochadi — ketidan quvma, yo'lini to'sib ur.": [
    "Раненая крыса убегает — не гонись, перекрой ей путь и бей.",
    "A hit rat runs off — don't chase it, cut off its path and strike.",
  ],
  "Barakalla! Endi qolgan poroxim omon.": [
    "Молодец! Теперь остаток пороха цел.",
    "Well done! Now the rest of my powder is safe.",
  ],
  "Ol, bu mis gilza — birinchi o'qimdan qolgan. Yo'lda omad keltiradi.": [
    "Держи, эта медная гильза — от моего первого выстрела. Принесёт удачу в пути.",
    "Take this brass casing — from my very first shot. It'll bring you luck on the road.",
  ],
  "Mergan — men o'rgatgan eng chaqqon o'qchi. Sirpanib o'tib, barabanga ikki o'q solishni ham mendan o'rgangan.":
    [
      "Стрелок — самый ловкий стрелок, которого я обучил. Заряжать два патрона в подкате он тоже научился у меня.",
      "The Gunslinger is the nimblest shooter I ever trained. Loading two rounds mid-slide — he learned that from me too.",
    ],
  "Uni qal'angdagi do'kondan topasan. Oltinni ayama — u bunga arziydi.": [
    "Найдёшь его в магазине своей крепости. Не жалей золота — он того стоит.",
    "You'll find him in your castle's shop. Don't spare the gold — he's worth it.",
  ],
  "Baraban bo'shab qolsa — sirpan, ikki o'q o'zi tushadi.": [
    "Опустел барабан — сделай подкат, и два патрона встанут сами.",
    "Cylinder empty? Slide, and two rounds load themselves.",
  ],
  "Tutun ichida dushman seni ko'rmaydi, sen turgan joyga uradi. Lekin unga tegib ketsang — topadi.":
    [
      "В дыму враг тебя не видит и бьёт туда, где ты стоял. Но если заденешь его — найдёт.",
      "In the smoke the enemy can't see you and strikes where you stood. But if you brush against it, it'll find you.",
    ],
  "Dushmanlar to'planib kelsa — barabanni bir zumda bo'shat.": [
    "Если враги наваливаются толпой — опустоши барабан в один миг.",
    "If enemies swarm you, empty the cylinder in an instant.",
  ],
  "Rahmat, ustoz.": ["Спасибо, учитель.", "Thank you, master."],
  "Yo'lchi... Bu tog'ga tirik odam kelmaganiga ko'p yil bo'ldi.": [
    "Путник... Много лет на эту гору не поднимался живой человек.",
    "Traveler... It's been many years since a living soul climbed this mountain.",
  ],
  "Men — surgun qilingan rohibman. Kul tog'idagi ibodatxona menga ishonib topshirilgan edi.": [
    "Я — изгнанный монах. Мне был доверен храм на Пепельной горе.",
    "I am an exiled monk. The temple on Ash Mountain was entrusted to me.",
  ],
  "Kul itlarini yengdim.": ["Я победил пепельных псов.", "I defeated the ash hounds."],
  "Kul itlari haqida...": ["Насчёт пепельных псов...", "About the ash hounds..."],
  "Obsidian parchalarini olib keldim.": [
    "Я принёс осколки обсидиана.",
    "I brought the obsidian shards.",
  ],
  "Qo'riqchilar haqida...": ["Насчёт стражей...", "About the guardians..."],
  "Ibodatxonani ko'rdim.": ["Я видел храм.", "I saw the temple."],
  "Ibodatxona haqida...": ["Насчёт храма...", "About the temple..."],
  "Nega seni surgun qilishdi?": ["За что тебя изгнали?", "Why were you exiled?"],
  "Iblis qayerdan kelgan?": ["Откуда пришёл Дьявол?", "Where did the Devil come from?"],
  "Non va damlama bormi?": ["Есть хлеб и отвар?", "Got bread and brew?"],
  "Bu nur... Zirhing oltindek porlaydi. Sen Quyosh qasamini ichgan ritsarlardansan!": [
    "Этот свет... Твои доспехи сияют, как золото. Ты из рыцарей, давших Солнечную клятву!",
    "This light... Your armor shines like gold. You're one of the knights who swore the Sun Oath!",
  ],
  "Ko'p yillar oldin sizning ordeningiz Kul qirolini ibodatxonaga zanjirband qilgan edi. Endi zanjirlar bo'shamoqda.":
    [
      "Много лет назад ваш орден приковал Пепельного короля в храме. Теперь цепи слабеют.",
      "Many years ago your order chained the Ash King in the temple. Now the chains are weakening.",
    ],
  "Quyosh qasami haqida gapir.": ["Расскажи о Солнечной клятве.", "Tell me about the Sun Oath."],
  "Kul itlari to'da bo'lib yuradi: biri seni ko'rsa — hammasi yuguradi.": [
    "Пепельные псы ходят стаей: заметит один — бегут все.",
    "Ash hounds roam in packs: if one spots you, they all come running.",
  ],
  "Dalada 6 tasini yeng. Tashlanishidan oldin yerga cho'kadi — shu payt chetga o't.": [
    "Победи 6 из них в поле. Перед броском пёс припадает к земле — в этот миг отойди в сторону.",
    "Defeat 6 of them in the field. Before lunging, a hound crouches low — that's when you step aside.",
  ],
  "Itlar g'arbdagi kul dalasida. O'rab olishlariga yo'l qo'yma — orqangni devorga ber.": [
    "Псы на пепельном поле к западу. Не дай им окружить себя — прижмись спиной к стене.",
    "The hounds are in the ash field to the west. Don't let them surround you — keep your back to a wall.",
  ],
  "Rahmat, yo'lchi. Bu tasbeh ustozimdan qolgan — tunda yo'lingni yoritadi.": [
    "Спасибо, путник. Эти чётки остались от моего учителя — ночью они осветят тебе путь.",
    "Thank you, traveler. These beads were my teacher's — they'll light your way at night.",
  ],
  "Sharqdagi obsidian xarobalarda tosh qo'riqchilar uyg'ondi. Ularni rohiblar ibodatxonani qo'riqlash uchun yasagan.":
    [
      "В обсидиановых руинах на востоке пробудились каменные стражи. Их создали монахи, чтобы охранять храм.",
      "Stone guardians have woken in the obsidian ruins to the east. The monks made them to guard the temple.",
    ],
  "Xarobani top va menga 3 ta obsidian parchasi olib kel. Qalqoni oldidan zarbani to'sadi, bolg'asi esa ikki yurak oladi.":
    [
      "Найди руины и принеси мне 3 осколка обсидиана. Щит стража блокирует удары спереди, а молот отнимает два сердца.",
      "Find the ruins and bring me 3 obsidian shards. A guardian's shield blocks hits from the front, and its hammer takes two hearts.",
    ],
  "Qo'riqchi sekin buriladi — orqasiga o't. Bolg'asini ko'targanda doiradan chiq, urgandan keyin qalqoni tushadi.":
    [
      "Страж поворачивается медленно — заходи со спины. Поднял молот — выйди из круга, после удара щит опустится.",
      "The guardian turns slowly — get behind it. When it raises its hammer, leave the circle; after the slam its shield drops.",
    ],
  "Parchalar iliq... Demak, ularni qirolning olovi uyg'otgan.": [
    "Осколки тёплые... Значит, их пробудил огонь короля.",
    "The shards are warm... So the king's fire woke them.",
  ],
  "Ol, bu cho'g' yurak senga kuch beradi.": [
    "Держи, это угольное сердце придаст тебе сил.",
    "Take this ember heart — it will give you strength.",
  ],
  "Endi bilaman: Kul qiroli uyg'onmoqda. Iblis yengilgan kuni uning zanjirlari bo'shadi.": [
    "Теперь я знаю: Пепельный король пробуждается. В день, когда пал Дьявол, его цепи ослабли.",
    "Now I know: the Ash King is awakening. On the day the Devil fell, his chains loosened.",
  ],
  "Janubdagi Iblis ibodatxonasini top va yo'ldagi lava qurtlarini haydab kel. Qirolga yolg'iz borma — do'stlaring bilan bor.":
    [
      "Найди храм Дьявола на юге и прогони лавовых червей на пути. К королю не ходи один — иди с друзьями.",
      "Find the Devil's temple to the south and drive off the lava worms on the way. Don't face the king alone — go with friends.",
    ],
  "Quyosh ritsari! Sening ordening Kul qirolini bir bor yenggan.": [
    "Рыцарь Солнца! Твой орден однажды уже победил Пепельного короля.",
    "Knight of the Sun! Your order has defeated the Ash King once before.",
  ],
  "Qirol eng xavfli dushmanni quvadi. Sen QASAM bilan uni o'zingga tortasan — do'stlaring esa orqasidan uradi.":
    [
      "Король гонится за самым опасным врагом. Ты КЛЯТВОЙ притягиваешь его к себе — а друзья бьют со спины.",
      "The king chases the most dangerous foe. With your OATH you pull him onto yourself — while your friends strike from behind.",
    ],
  "Ibodatxonani top va lava qurtlarini haydab kel. Qirolni sen ushlab turasan.": [
    "Найди храм и прогони лавовых червей. Короля держать будешь ты.",
    "Find the temple and drive off the lava worms. You'll be the one holding the king.",
  ],
  "Qasamim — qalqonim. Boraman.": [
    "Моя клятва — мой щит. Иду.",
    "My oath is my shield. I'm going.",
  ],
  "Ibodatxona janubda, olovli daryodan o'tgach. Qurtlar yer ostidan chiqadi — yer yorilsa, darhol qoch.":
    [
      "Храм на юге, за огненной рекой. Черви вылезают из-под земли — треснула земля, сразу беги.",
      "The temple is to the south, past the river of fire. The worms burst from underground — if the ground cracks, run at once.",
    ],
  "Ichki zalga yo'l ochiq. Kul qiroli o'sha yerda.": [
    "Путь во внутренний зал открыт. Пепельный король там.",
    "The way to the inner hall is open. The Ash King is there.",
  ],
  "Mana damlamalar — ular senga kerak bo'ladi. Do'stlaringni olib bor.": [
    "Вот отвары — они тебе понадобятся. Возьми с собой друзей.",
    "Here are some brews — you'll need them. Bring your friends.",
  ],
  "Quyosh nuri seni asrasin, ritsar. Qirol seni ko'rsa, o'g'lining qotilini taniydi.": [
    "Да хранит тебя солнечный свет, рыцарь. Увидев тебя, король узнает убийцу своего сына.",
    "May the sunlight keep you, knight. When the king sees you, he'll recognize his son's killer.",
  ],
  "Do'stlaringni yig' va zalga kir. Damlamalarni ol — tankka jon ko'p kerak.": [
    "Собери друзей и войди в зал. Возьми отвары — танку нужно много жизни.",
    "Gather your friends and enter the hall. Take the brews — a tank needs plenty of health.",
  ],
  "Qasamim mustahkam.": ["Моя клятва нерушима.", "My oath is unbreakable."],
  "Qirolni bog'lagan zanjirlar uchun men javobgar edim.": [
    "Я отвечал за цепи, что сковывали короля.",
    "I was responsible for the chains that bound the king.",
  ],
  "Iblis qochib, olam qal'asini yondirmoqchi bo'lganda, rohiblar meni aybladi va tog' etagiga haydadi.":
    [
      "Когда Дьявол сбежал и захотел сжечь крепость мира, монахи обвинили меня и прогнали к подножию горы.",
      "When the Devil escaped and sought to burn the realm's castle, the monks blamed me and drove me to the foot of the mountain.",
    ],
  "Achinarli.": ["Печально.", "How sad."],
  "Iblis shu tog'da tug'ilgan. Kul qiroli uni o'z kulidan yasab, olov yuragini bergan.": [
    "Дьявол родился на этой горе. Пепельный король слепил его из своего пепла и дал ему огненное сердце.",
    "The Devil was born on this mountain. The Ash King shaped him from his own ashes and gave him a heart of fire.",
  ],
  "Ibodatxona atrofida qadimiy bitiklar bo'laklari sochilgan. Ularni topsang — hammasini bilasan.":
    [
      "Вокруг храма разбросаны обломки древних письмен. Найдёшь их — узнаешь всё.",
      "Fragments of ancient scriptures are scattered around the temple. Find them and you'll learn everything.",
    ],
  "Quyosh qasami: \"Zaiflarni o'zimga tortaman, zarbani o'zim ko'taraman.\"": [
    "Солнечная клятва: «Слабых принимаю на себя, удар принимаю сам».",
    'The Sun Oath: "I draw the weak behind me; I take the blow myself."',
  ],
  "Ordeningiz qasam ichib, qirolni zanjirlagan. Endi navbat senda, ritsar.": [
    "Ваш орден принёс клятву и заковал короля. Теперь твой черёд, рыцарь.",
    "Your order swore the oath and chained the king. Now it's your turn, knight.",
  ],
  "Men tayyorman.": ["Я готов.", "I'm ready."],
};

/** Foydalanuvchiga ko'rinadigan maydonlar (xarita qatorlari, id lar — tegilmaydi) */
export const REALM_TEXT_FIELDS: ReadonlySet<string> = new Set([
  "text",
  "name",
  "desc",
  "lore",
  "back",
]);
