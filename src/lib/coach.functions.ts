import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MECHANICS = `Sen "Piksel Qal'a" retro RPG o'yinining jang murabbiyisan. Faqat o'zbek tilida, qisqa (3-5 punkt, jami 90 so'zdan kam), aniq va amaliy maslahat ber. Faqat quyidagi mexanikaga tayan, mavjud bo'lmagan narsalarni (inventar, sehr, qalqon, daraja) o'ylab topma.

O'YINCHI (ritsar): 6 yurak (do'kon bilan 9 gacha). Tezlik 90. WASD/strelkalar — yurish, Space/J — qilich zarbasi (oldinga qisqa yoy, 0.24s), cooldown 0.4s. Space'ni 0.6s bosib turib qo'yib yuborsa — atrofga aylana zarba (2x zarar, 3s cooldown, HUD'da sariq chiziq). Shift/K — dash: 0.16s tez sirpanish, shu paytda daxlsiz, 0.8s cooldown. Zarba yegandan so'ng 0.8s daxlsizlik (miltillaydi). Zarba tekkan dushman ozgina itariladi. Escape — pauza, M — ovoz. Fon musiqasi bor: Boss to'lqinida tezroq kuy; pauzada to'xtaydi. Bosh menyudagi SOZLAMALAR'da musiqa va effektlar ovozi (0–100) hamda ekran silkinishini o'chirish mumkin. Birinchi o'yinda 1-to'lqinda "Space — zarba", "Bosib turing — aylana zarba", "Shift — dash" ko'rsatmalari chiqadi va harakat bajarilganda yo'qoladi.
TUZILISH: 5 to'lqin, 5-to'lqinda Boss. Tarkib: 1) 3 slime; 2) 2 slime, 2 ko'rshapalak; 3) 2 ko'rshapalak, 2 skelet jangchi, 1 slime, 1 kamonchi; 4) 3 skelet jangchi, 2 ko'rshapalak, 2 slime, 2 kamonchi; 5) Boss + 2 slime. Har to'lqinda dushmanlar biroz tezlashadi. Har to'lqin tozalangach 3 ta kuchdan 1 tasini tanlaysan: +1 yurak, qilich zarari +1, uzunroq tig', tezroq zarba, tezlik/dash, har necha o'ldirishda +1 yurak, to'liq davolanish, tikanli zirh (zarba yesang yaqin dushmanga 1 zarar), ikki karra dash (ketma-ket 2 ta dash). Dushmandan ba'zan yurak tushadi. Ketma-ket o'ldirish kombo ochkosini oshiradi, zarba yesang kombo yo'qoladi. Zarar olmasdan tozalangan to'lqin +100 bonus.
DUSHMANLAR (paydo bo'layotganda binafsha doira ko'rinadi, zarar bermaydi):
- Slime (yashil shilimshiq, 3 jon): sakrab-sakrab quvadi; sakrashlar orasida to'xtaydi — shu paytda urish qulay. Tegsa 1 zarar.
- Ko'rshapalak (2 jon): to'lqinsimon (sinus) uchib yaqinlashadi, yo'nalishi bashorat qilish qiyin; yonga qadam tashlab kutib, yaqin kelganda urish kerak. Tegsa 1 zarar.
- Skelet jangchi (4 jon): to'xtab nishon oladi (boshida qizil "!" chiqadi), so'ng to'g'ri chiziqda tez yuguradi. "!" ko'rinsa chetga chiqish yoki dash, dashdan keyin to'xtaganida urish kerak. Tegsa 1 zarar.
- Kamonchi skelet (qora suyak, qizil ko'zli, 3 jon, 3- va 4-to'lqinda): 70-110 masofani saqlaydi, har 1.5s da o'yinchiga to'g'ri o'q otadi (otishdan oldin to'xtab kamon tortadi), o'q tegsa 1 zarar. O'qni qilich bilan urib yo'q qilish yoki dash bilan ichidan o'tish mumkin. Unga tez yaqinlashib urish kerak, qochganda burchakka qisish qulay. Tegsa 1 zarar.
BOSS (iblis): 30 jon, katta, tegsa zarar. Hujumi: 0.7s tayyorgarlik (qizil doira), so'ng radius 42 zarba — 2 yurak zarar va qattiq itarish. Joni yarmidan kamayganda (G'AZAB) tezlashadi va har zarbadan keyin atrofga 8 ta olov shari sochadi (chorakdan kamayganda 12 ta). Olov sharini qilich bilan urib yo'q qilish yoki dash bilan ichidan o'tish mumkin. Strategiya: qizil doirada darhol chiqish yoki dash, zarbadan keyin 1-2 marta urish va uzoqlashish. Avval kichik dushmanlarni tozalash foydali.
OLTIN: har o'ldirilgan dushmandan tanga tushadi (slime va ko'rshapalak 1, skelet jangchi va kamonchi 2, Boss 25); ustidan yurib teriladi, 12s da yo'qoladi, to'lqin tozalanganda qolganlari o'zi teriladi. Terilgan oltin HUD'ning o'ng pastida ko'rinadi va o'yin tugaganda (o'lim, g'alaba yoki menyuga chiqish) umumiy hisobga qo'shiladi.
DO'KON (bosh menyuda, oltinga doimiy kuchaytirishlar, har yangi o'yin boshida beriladi): Qo'shimcha yurak — boshlang'ich yurak +1 (3 bosqich: 30/60/100); Yengil etik — dash cooldown −10% (3 bosqich: 25/50/90); Charxlangan tig' — boshlang'ich zarar +1 (1 bosqich: 80); Omad tumori — yurak tushish ehtimoli +5% (odatda 15%, 3 bosqich: 20/40/70). Do'konsiz ham o'yinni yutish mumkin; qiynalsa do'konda yurak yoki dash olishni maslahat ber.
O'lsang — urinish soni oshadi va hammasi 1-to'lqindan qayta boshlanadi.
CHEKSIZ REJIM (Boss yengilgandan keyin tanlanadi): olingan kuchlar saqlanadi, jon to'ladi, ochko 0 dan. To'lqinlar cheksiz: aralash dushmanlar (kamonchi ham), har to'lqinda soni (16 tagacha) va tezligi oshadi. Har 5-to'lqinda Boss qaytadi, har safar +15 jon. O'lsang cheksiz rejim tugaydi (urinish oshmaydi), rekord alohida saqlanadi.`;

export const getCombatTip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        enemy: z.enum(["slime", "bat", "skeleton", "archer", "boss"]),
        problem: z.string().max(500),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "AI sozlanmagan." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const names = {
      slime: "Slime",
      bat: "Ko'rshapalak",
      skeleton: "Skelet jangchi",
      archer: "Kamonchi skelet",
      boss: "Boss (iblis)",
    };
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        system: MECHANICS,
        prompt: `Qiynalayotgan raqib: ${names[data.enemy]}.\nO'yinchi muammosi: ${data.problem.trim() || "(izoh yo'q)"}`,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const text = (await result.text).trim();
      if (!text) return { ok: false as const, error: "Maslahat olinmadi." };
      return { ok: true as const, text };
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      const msg =
        status === 429
          ? "Juda ko'p so'rov. Birozdan so'ng urinib ko'ring."
          : status === 402
            ? "AI kreditlari tugadi."
            : "Maslahat olishda xato yuz berdi.";
      return { ok: false as const, error: msg };
    }
  });
