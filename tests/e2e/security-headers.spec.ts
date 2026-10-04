import { expect, test } from "@playwright/test";

// Field-readiness: basic security headers on every page (next.config.ts).

test("pages are sent with basic security headers", async ({ request }) => {
  for (const path of ["/login", "/farms"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"], path).toBe("camera=(self), geolocation=(self), microphone=()");
  }
});
