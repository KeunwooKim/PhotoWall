export type InquiryCategory = "general" | "bug" | "feature" | "abuse" | "business";

export type InquiryStatus = "open" | "in_progress" | "resolved";

export type BusinessStage = "lead" | "meeting" | "contract" | "closed";

export interface Inquiry {
  id: string;
  userId: string | null;
  email: string | null;
  category: InquiryCategory;
  subject: string;
  body: string;
  relatedWallId: string | null;
  status: InquiryStatus;
  adminNote: string | null;
  adminReply: string | null;
  adminRepliedAt: string | null;
  businessStage: BusinessStage | null;
  createdAt: string;
  resolvedAt: string | null;
}

export const INQUIRY_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  general: "일반 문의",
  bug: "버그 제보",
  feature: "기능 제안",
  abuse: "신고",
  business: "제휴·비즈니스",
};

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  open: "미처리",
  in_progress: "처리중",
  resolved: "완료",
};

export const BUSINESS_STAGE_LABELS: Record<BusinessStage, string> = {
  lead: "리드",
  meeting: "미팅",
  contract: "계약",
  closed: "종료",
};
