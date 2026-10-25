import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MECHANICS = `Sen "Piksel Qal'a" retro RPG o'yinining jang murabbiyisan. Faqat o'zbek tilida, qisqa (3-5 punkt, jami 90 so'zdan kam), aniq va amaliy maslahat ber. Faqat quyidagi mexanikaga tayan, mavjud bo'lmagan narsalarni (inventar, sehr, qalqon, daraja) o'ylab topma.

O'YINCHI (ritsar): 6 yurak. Tezlik 90. WASD/strelkalar — yurish, Space/J — qilich zarbasi (oldinga qisqa yoy, 0.24s), cooldown 0.4s. Space'ni 0.6s bosib turib qo'yib yuborsa — atrofga aylana zarba (2x zarar, 3s cooldown, HUD'da sariq chiziq). Shift/K — dash: 0.16s tez sirpanish, shu paytda daxlsiz, 0.8s cooldown. Zarba yegandan so'ng 0.8s daxlsizlik (miltillaydi). Zarba tekkan dushman ozgina itariladi. Escape — pauza.
TUZILISH: 5 to'lqin, 5-to'lqinda Boss. Har to'lqin tozalangach 3 ta kuchdan 1 tasini tanlaysan: +1 yurak, qilich zarari +1, uzunroq tig', tezroq zarba, tezlik/dash, har necha o'ldirishda +1 yurak, to'liq davolanish, tikanli zirh (zarba yesang yaqin dushmanga 1 zarar), ikki karra dash (ketma-ket 2 ta dash). Dushmandan ba'zan yurak tushadi. Ketma-ket o'ldirish kombo ochkosini oshiradi, zarba yesang kombo yo'qoladi. Zarar olmasdan tozalangan to'lqin +100 bonus.
DUSHMANLAR (paydo bo'layotganda binafsha doira ko'rinadi, zarar bermaydi):
- Slime (yashil shilimshiq): sakrab-sakrab quvadi; sakrashlar orasida to'xtaydi — shu paytda urish qulay. Tegsa 1 zarar.
- Ko'rshapalak: to'lqinsimon (sinus) uchib yaqinlashadi, yo'nalishi bashorat qilish qiyin; yonga qadam tashlab kutib, yaqin kelganda urish kerak. Tegsa 1 zarar.
- Skelet jangchi: to'xtab nishon oladi (boshida qizil "!" chiqadi), so'ng to'g'ri chiziqda tez yuguradi. "!" ko'rinsa chetga chiqish yoki dash, dashdan keyin to'xtaganida urish kerak. Tegsa 1 zarar.
- Kamonchi skelet (3- va 4-to'lqinda): masofani saqlaydi, har 1.5s da o'q otadi (otishdan oldin to'xtab kamon tortadi). O'qni qilich bilan urib yo'q qilish yoki dash bilan ichidan o'tish mumkin. Unga tez yaqinlashib urish kerak, qochganda burchakka qisish qulay. Tegsa 1 zarar.
BOSS (iblis): 30 jon, katta, tegsa zarar. Hujumi: 0.7s tayyorgarlik (qizil doira), so'ng radius 42 zarba — 2 yurak zarar va qattiq itarish. Joni yarmidan kamayganda (G'AZAB) tezlashadi va har zarbadan keyin atrofga 8 ta olov shari sochadi (chorakdan kamayganda 12 ta). Olov sharini qilich bilan urib yo'q qilish yoki dash bilan ichidan o'tish mumkin. Strategiya: qizil doirada darhol chiqish yoki dash, zarbadan keyin 1-2 marta urish va uzoqlashish. Avval kichik dushmanlarni tozalash foydali.
O'lsang — urinish soni oshadi va hammasi 1-to'lqindan qayta boshlanadi.
CHEKSIZ REJIM (Boss yengilgandan keyin): to'lqinlar cheksiz, har to'lqinda dushmanlar ko'payadi va tezlashadi, har 5-to'lqinda Boss ko'proq jon bilan qaytadi. Rekord alohida.`;

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
