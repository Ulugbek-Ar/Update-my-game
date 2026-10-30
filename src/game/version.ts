/** O'yin versiyasi — bitta manba. Versiyani faqat shu yerda o'zgartiring. */
/** Shu versiyaning "Yangiliklar" oynasi ko'rsatilganmi (localStorage) */
export const SEEN_VERSION_KEY = "pixel-rpg-seen-version";
export const GAME_VERSION = "2.8.0";

export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2.8.0",
    date: "2026-10-30",
    notes:
      "Piksel Qal'a endi kompyuterda! Windows uchun o'rnatishsiz ishlaydigan dastur. Har qanday kompyuterda internetsiz ochiladigan portativ versiya. Kompyuteringiz uchun 3 ta fon rasmi.",
  },
  {
    version: "2.7.0",
    date: "2026-10-30",
    notes:
      "Abadiyat olami endi onlayn! Internet bo'lsa olamga kirganingizda boshqa o'yinchilarni ko'rasiz. Do'stni chaqirish: xona kodi yoki havolani yuboring va birga o'ynang. Internet bo'lmasa o'yin avvalgidek oflayn ishlaydi.",
  },
  {
    version: "2.6.0",
    date: "2026-10-30",
    notes:
      "Yangi: progressni ko'chirish kodi. Sayt, Telegram va Android ilova o'rtasida oltin, qahramonlar va yutuqlaringizni ko'chiring. Sozlamalar → Umumiy → Progressni ko'chirish. Kunlik sovg'a: har kuni kirib oltin oling, 7-kuni katta sovg'a. Yangi yutuq: Sodiq o'yinchi.",
  },
  {
    version: "2.5.0",
    date: "2026-10-30",
    notes:
      "Yangi: boshqaruv sozlamalari. Telefonda joystik va tugmalar o'lchamini, shaffofligini va joyini o'zingizga moslang. Suzuvchi joystik — barmoq qayerga tegsa o'sha yerda paydo bo'ladi. Chapaqaylar uchun rejim va tebranish. Kompyuterda tugmalarni qayta belgilash mumkin. Sozlamalarni o'yin ichida pauzadan ham ochsa bo'ladi. Tugma yozuvlari endi tugmaga sig'adi.",
  },
  {
    version: "2.4.0",
    date: "2026-10-30",
    notes:
      "Yangi qahramon: Mergan — chaqmoqtoshli to'pponchali o'qchi. Barabanda 6 o'q, bosib tursang barcha o'qlarni yelpig'ich qilib otadi. Sirpanish o'qni to'ldiradi, tutun bombasi dushmanlardan yashiradi. Do'konda yangi QAHRAMONLAR bo'limi: 4-qahramondan boshlab qahramonlar oltinga sotiladi. Merganning 11 ta o'z kuch kartasi, jumladan Katta baraban va Rikoshet. Olam qishlog'ida yangi NPC: Qari Mergan.",
  },
  {
    version: "2.3.0",
    date: "2026-10-29",
    notes:
      "Piksel Qal'a Android ilovasiga tayyorlandi. Ilovada o'yin to'liq ekranda va faqat gorizontal holatda ochiladi. Telefonning Orqaga tugmasi o'yinni pauza qiladi. Ilova oflayn ishlaydi.",
  },
  {
    version: "2.2.2",
    date: "2026-10-29",
    notes: "Xaroba Sardori endi yerda yuradi: qadam tashlaydi va har qadamda chang ko'tariladi.",
  },
  {
    version: "2.2.1",
    date: "2026-10-29",
    notes:
      "Abadiyat olamiga kirish uchun avval Iblisni yeng — darvoza ochiladi. Asosiy bosslar olamdagi yangi hududlar kalitini beradi. Yangi topshiriq: Iblisning shoxi. Bosslar zarba berishdan oldin yerda ogohlantirish belgisi chiqadi. Kechasi yorug'lik yumshoqroq. Telefonda menyu va olam ekrani tartibga keltirildi.",
  },
  {
    version: "2.2.0",
    date: "2026-10-29",
    notes:
      "Abadiyat olami — kelajakdagi ko'p o'yinchili olamning birinchi sinov versiyasi. Ochiq xarita, Boshlang'ich vodiy hududi, NPC'lar va topshiriqlar. Olamda yashirin sirlar bor — ularni o'zingiz toping. Kecha va kunduz almashadi. Dash, teleport va sakrash endi mob ustidan xavfsiz o'tkazadi.",
  },
  {
    version: "2.1.0",
    date: "2026-10-29",
    notes:
      "Har qahramonning qobiliyatlari o'z rangida: Ritsar ko'k, Sehrgar qizil, Ovchi yashil. Telefon tugmalari tanlangan qahramon rangida. Telefonda o'yin gorizontal holatda o'ynaladi, vertikal holatda telefonni aylantirish haqida ko'rsatma chiqadi. Telegram ichida o'yin to'liq ekranga ochiladi. Yutuq xabari endi kuch tanlash ekranini yopmaydi.",
  },
  {
    version: "2.0.0",
    date: "2026-10-28",
    notes:
      "Piksel Qal'a 2.0: Sarguzasht xaritasi. Yangi 3-dunyo: Zulmat o'rmoni — o'z moblari va O'rmon Shohi bossi bilan. Yangi moblar: O'rmon o'rgimchagi, Zaharli qo'ziqorin, Daraxt odam va Tungi boyo'g'li. Yangi qahramon: Ovchi — o'q, teshuvchi o'q va tuzoq. Yangi bosh menyu sahnasi.",
  },
  {
    version: "1.9.0",
    date: "2026-10-28",
    notes:
      "Har dunyoning o'z dushmanlari: 1-dunyoda faqat zindon moblari, 2-dunyoda faqat muz moblari. Muz golemi endi Qor odam: o'lganda 2 ta Muz slime'ga bo'linadi. Yangi mob: Muz slime — tegsa sekinlashtiradi. Yangi mob: Qor bo'risi — juft yuradi va sakrab tashlanadi. Qalqonli skelet 2-dunyoga ko'chdi va muz qiyofasini oldi. Bosh menyudan 2-dunyoni tanlash mumkin.",
  },
  {
    version: "1.8.0",
    date: "2026-10-28",
    notes:
      "Yangi 2-bob: Muz sardobasi — Iblisdan keyin 5 ta yangi to'lqin. Yangi xona: muz plitalar, qor va sovuq kristallar. Yangi dushmanlar: Muz ruhi — sovuq nafas bilan sekinlashtiradi, Muz golemi — o'lganda bo'laklarga bo'linadi. Yangi Boss: Qor Malikasi — muz nayzalari, bo'ron va ruh chaqirish. 3 ta yangi yutuq.",
  },
  {
    version: "1.7.2",
    date: "2026-10-28",
    notes:
      "O'yin oxirida statistika: to'lqinlar, o'ldirilgan dushmanlar, eng uzun kombo, oltin, sandiqlar va vaqt.",
  },
  {
    version: "1.7.1",
    date: "2026-10-28",
    notes: "Sehrgar kuch kartalari va ikonkalari yangi qizil-qora uslubga moslashdi.",
  },
  {
    version: "1.7.0",
    date: "2026-10-28",
    notes:
      "Sehrgar yangi qiyofada: qora-qizil to'n va uzun kumushrang soqol. Sehrgarning shari, halqasi va teleporti qizil-qora rangda. Yangi dushman: Qalqonli skelet — oldidan urilgan zarbani to'sadi, uni yonidan yoki orqasidan uring. Xazina sandig'i: ba'zi to'lqinlarda chiqadi, ichidan oltin, yurak yoki kuch kartasi tushadi. Yangi yutuq: Xazinachi.",
  },
  {
    version: "1.6.1",
    date: "2026-10-27",
    notes: "Menyu tugmalari sichqoncha ustiga borganda ham aniq o'qiladi.",
  },
  {
    version: "1.6.0",
    date: "2026-10-27",
    notes:
      "Yutuqlar: 10 ta yutuq, masalan Benuqson to'lqin, Iblisni yeng, 50 kombo va Sehrgar bilan yut. Yutuq ochilganda o'yin ichida xabar chiqadi, bosh menyuda YUTUQLAR ro'yxati bor. Kunlik sinov: har kuni hamma uchun bir xil to'lqinlar va kuch kartalari. Kunlik sinovga kuniga bitta urinish beriladi va natijasi menyuda ko'rinadi. Yangi versiyaga birinchi kirishda Yangiliklar oynasi chiqadi.",
  },
  {
    version: "1.5.1",
    date: "2026-10-27",
    notes:
      "Sehrgar uchun alohida kuchlar va ikonkalar, ochko xatosi tuzatildi. Sehrgar kartalarida o'z nomlari, ranglari va kod bilan chizilgan ikonkalari bor: sehrli yurak, olovli shar, keng halqa, afsun kitobi, qanotli yulduz, ruh alangasi, muz kristali, portal va iksir. Yangi Sehrgar kuchlari: Uch shar va Teshuvchi shar. Muz qalqoni: jon yo'qotsang, atrofdagi dushmanlar 1.5 soniya sekinlashadi. Sehrgarda teleport chizig'i, sensor tugmalari va AI maslahatchi matni shar, halqa va teleportga moslashdi.",
  },
  {
    version: "1.5.0",
    date: "2026-10-27",
    notes:
      "Bosh menyuda qahramon tanlash: Ritsar yoki yangi Sehrgar, tanlov saqlanadi. Sehrgar: 5 yurak va biroz tezroq yuradi. Sehrgar zarbasi — qarab turgan tomonga uchadigan sehrli shar. Hujumni bosib tursa — atrofga 2x zararli sehrli halqa. Dash o'rniga qisqa teleport. Sehrgar uchun binafsha-ko'k to'n, uchli qalpoq va tayoqli yangi sprite. Kuch kartalari ikkala qahramonga mos: Uzun tig' Sehrgarda sharni tezlashtiradi. Rekordlar har qahramon uchun alohida saqlanadi.",
  },
  {
    version: "1.4.0",
    date: "2026-10-27",
    notes:
      "Dushmanlardan oltin tanga tushadi: slime va ko'rshapalak 1, skelet jangchi va kamonchi 2, Boss 25. Terilgan oltin HUD'ning o'ng pastki burchagida ko'rinadi. To'lqin tozalanganda yerda qolgan tangalar o'zi teriladi. O'yin tugaganda oltin umumiy hisobga qo'shiladi. Bosh menyuda DO'KON: boshlang'ich yurak +1, dash tezroq qaytishi, boshlang'ich zarar +1 va yurak tushish ehtimoli +5% kabi doimiy kuchaytirishlar. Kuchaytirishlar 3 bosqichli, narxi har bosqichda oshadi. Do'konsiz ham o'yin avvalgidek yutiladi, do'kon faqat yengillashtiradi.",
  },
  {
    version: "1.3.0",
    date: "2026-10-27",
    notes:
      "Fon musiqasi: oddiy to'lqinlarda sarguzasht kuyi, Boss to'lqinida tezroq va qo'rqinchliroq kuy, pauzada to'xtaydi. Bosh menyuda SOZLAMALAR: musiqa va effektlar ovozi, ekran silkinishini o'chirish. Birinchi o'yinda 1-to'lqinda qisqa ko'rsatmalar",
  },
  {
    version: "1.2.1",
    date: "2026-10-26",
    notes: "Kamonchi skelet: kamon va tortib otish animatsiyasi, qora suyak ko'rinishi",
  },
  {
    version: "1.2.0",
    date: "2026-10-26",
    notes:
      "Yangi dushman: Kamonchi skelet. Boss g'alabasidan keyin CHEKSIZ REJIM (alohida rekord). Kuchli aylana zarba (Space'ni bosib turish). Yangi kuchlar: Tikanli zirh, Ikki karra dash. Har to'lqinda xona bezagi o'zgaradi. Kuch kartalarida piksel ikonkalar. Pauzada \"Bosh menyuga qaytish\" tugmasi. Telefonda pauza ekranida sensor ko'rsatmasi",
  },
  {
    version: "1.1.0",
    date: "2026-10-25",
    notes:
      "5 to'lqin va oxirida Boss. Har to'lqindan so'ng 3 tadan 1 kuch tanlash. Dash (Shift) qo'shildi. Boss 2-fazada olov sochadi. Ochko, kombo va rekord. Yurak tushumlari, zarrachalar, ekran silkinishi. Telefon uchun sensorli boshqaruv",
  },
  { version: "1.0.3", date: "2026-10-11", notes: "Pauza tugmasi qo'shildi" },
  { version: "1.0.2", date: "2026-10-11", notes: "Ovoz effektlari qo'shildi" },
  {
    version: "1.0.1",
    date: "2026-10-08",
    notes: "O'yin oynasi ekranga to'liq moslashtirildi. O'lim bug'i tuzatildi",
  },
  { version: "1.0.0", date: "2026-10-08", notes: "Birinchi to'liq versiya" },
];
