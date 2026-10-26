/** O'yin versiyasi — bitta manba. Versiyani faqat shu yerda o'zgartiring. */
export const GAME_VERSION = "1.2.1";

export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.2.1",
    date: "2026-10-26",
    notes:
      "Kamonchi skeletga o'z spritei: qilich o'rniga yog'och kamon va orqasida o'qdon. Otishdan oldin o'qni qo'yadi, ipni o'q chiqqunga qadar tortib turadi va o'q aynan qo'yib yuborish kadrida kamondan chiqadi. Kamonchi doim o'yinchiga qarab turadi; o'lganda kamon yerga tushadi",
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
