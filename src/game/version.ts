/** O'yin versiyasi — bitta manba. Versiyani faqat shu yerda o'zgartiring. */
/** Shu versiyaning "Yangiliklar" oynasi ko'rsatilganmi (localStorage) */
export const SEEN_VERSION_KEY = "pixel-rpg-seen-version";
export const GAME_VERSION = "1.7.0";

export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string;
}

export const CHANGELOG: ChangelogEntry[] = [
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
