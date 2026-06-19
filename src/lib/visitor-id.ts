const VISITOR_ID_KEY = "photowall-visitor-id";

export function getVisitorId(): string {
  if (typeof window === "undefined") return "server";

  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}
