export type SupportFaqLink = {
  label: string;
  href: string;
};

export type SupportFaqItem = {
  id: string;
  question: string;
  answer: string;
  links?: SupportFaqLink[];
};

export const SUPPORT_FAQ: SupportFaqItem[] = [
  {
    id: "shared-wall",
    question: "공동 벽은 어떻게 만드나요?",
    answer:
      "로그인 후 벽꾸미기에서 공동 벽을 만들 수 있어요. 만든 뒤 초대를 보내면 친구와 함께 꾸밀 수 있습니다. 기본 플랜은 공동 벽 1개, 플러스는 더 많이 만들 수 있어요.",
    links: [{ label: "벽꾸미기로 이동", href: "/walls" }],
  },
  {
    id: "storage",
    question: "사진·저장 공간이 부족해요",
    answer:
      "기본 플랜은 계정 저장 공간 500MB, 사진 한 장 최대 약 12MB까지예요. 공간이 꽉 차면 벽을 정리하거나 플러스로 올리면 한도가 늘어납니다.",
    links: [{ label: "플러스 안내", href: "/upgrade" }],
  },
  {
    id: "plus",
    question: "플러스는 어떻게 신청하나요?",
    answer:
      "결제 연동 전에는 신청 후 관리자가 플러스를 부여해요. 요금제 페이지에서 플러스 신청하기를 누르면 됩니다.",
    links: [{ label: "플러스 신청", href: "/upgrade" }],
  },
  {
    id: "sync",
    question: "다른 기기에서 벽이 덮어써지거나 저장이 안 돼요",
    answer:
      "같은 계정으로 여러 기기에서 동시에 편집하면 나중에 저장된 내용이 우선될 수 있어요. 한 기기에서만 편집하고, 저장이 끝난 뒤 다른 기기에서 새로고침해 주세요. 다른 기기에서 편집 중이면 화면 안내를 따라 ‘여기서 다시 편집’을 선택할 수 있어요.",
  },
  {
    id: "stickers",
    question: "스티커는 어디서 쓰나요?",
    answer:
      "스티커 스토어에서 팩을 설치한 뒤, 벽 편집 화면의 스티커 메뉴에서 붙여 넣을 수 있어요.",
    links: [{ label: "스티커 스토어", href: "/stickers" }],
  },
  {
    id: "account-delete",
    question: "계정·데이터 삭제는 어디서 하나요?",
    answer:
      "설정 → 계정에서 탈퇴를 진행할 수 있어요. 탈퇴하면 벽·사진 등 계정 데이터가 삭제됩니다.",
    links: [{ label: "설정으로 이동", href: "/settings" }],
  },
  {
    id: "report",
    question: "벽 신고는 어떻게 하나요?",
    answer:
      "다른 사람의 벽을 볼 때 신고하기를 누르면 운영팀에 전달돼요. 계정·서비스 관련 문의는 고객센터 문의하기 탭을 이용해 주세요.",
  },
];
