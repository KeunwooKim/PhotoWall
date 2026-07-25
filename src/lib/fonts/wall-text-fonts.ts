import {
  Black_Han_Sans,
  Do_Hyeon,
  Gaegu,
  Gasoek_One,
  Gowun_Dodum,
  Jua,
  Nanum_Pen_Script,
  Noto_Sans_KR,
  Noto_Serif_KR,
  Song_Myung,
} from "next/font/google";

const notoSans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-wall-noto-sans",
  display: "swap",
});

const notoSerif = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-wall-noto-serif",
  display: "swap",
});

const blackHan = Black_Han_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-wall-black-han",
  display: "swap",
});

const doHyeon = Do_Hyeon({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-wall-do-hyeon",
  display: "swap",
});

const jua = Jua({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-wall-jua",
  display: "swap",
});

const gaegu = Gaegu({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-wall-gaegu",
  display: "swap",
});

const nanumPen = Nanum_Pen_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-wall-nanum-pen",
  display: "swap",
});

const songMyung = Song_Myung({
  weight: "400",
  variable: "--font-wall-song-myung",
  display: "swap",
});

const gowun = Gowun_Dodum({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-wall-gowun",
  display: "swap",
});

const gasoek = Gasoek_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-wall-gasoek",
  display: "swap",
});

/** Apply on editor root so Konva/DOM text can resolve these families. */
export const wallTextFontVariables = [
  notoSans.variable,
  notoSerif.variable,
  blackHan.variable,
  doHyeon.variable,
  jua.variable,
  gaegu.variable,
  nanumPen.variable,
  songMyung.variable,
  gowun.variable,
  gasoek.variable,
].join(" ");

export const TEXT_FONT_FAMILIES = [
  { id: "noto-sans", label: "고딕", value: notoSans.style.fontFamily },
  { id: "noto-serif", label: "명조", value: notoSerif.style.fontFamily },
  { id: "gowun", label: "고운돋움", value: gowun.style.fontFamily },
  { id: "song-myung", label: "송명", value: songMyung.style.fontFamily },
  { id: "do-hyeon", label: "도현", value: doHyeon.style.fontFamily },
  { id: "jua", label: "주아", value: jua.style.fontFamily },
  { id: "black-han", label: "검은고딕", value: blackHan.style.fontFamily },
  { id: "gasoek", label: "가석", value: gasoek.style.fontFamily },
  { id: "gaegu", label: "개구리", value: gaegu.style.fontFamily },
  { id: "nanum-pen", label: "나눔손글씨", value: nanumPen.style.fontFamily },
] as const;

export type TextFontId = (typeof TEXT_FONT_FAMILIES)[number]["id"];
