/**
 * Menyu tugmalari uchun umumiy holatlar: aniq klaviatura fokusi va piksel "bosilish" — tugma 2px
 * pastga ikki qadamda tushadi (silliq emas — piksel uslubida). Rang filtri ishlatilmaydi.
 */
export const pixelFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export const pixelPress =
  "active:translate-y-[2px] transition-transform duration-75 [transition-timing-function:steps(2,end)] motion-reduce:transition-none";
