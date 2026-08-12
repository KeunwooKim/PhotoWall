import { lookup } from "dns/promises";
import { isPrivateOrLocalHost } from "./allowed-domains";

/**
 * Resolve hostname and reject if any address is private/link-local (DNS rebinding).
 * Hostnames that already look private are rejected without DNS.
 */
export async function assertPublicHostname(hostname: string): Promise<void> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) throw new Error("blocked_host");
  if (isPrivateOrLocalHost(host)) throw new Error("blocked_host");

  // Literal IPs: no DNS needed; isPrivateOrLocalHost already covered private forms.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    if (isPrivateOrLocalHost(host)) throw new Error("blocked_host");
    return;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("dns_lookup_failed");
  }

  if (!addresses.length) throw new Error("dns_lookup_failed");

  for (const { address } of addresses) {
    if (isPrivateOrLocalHost(address)) throw new Error("blocked_resolved_ip");
  }
}
