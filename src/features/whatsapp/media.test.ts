import { describe, it, expect } from "vitest";
import { mimeToMediaType } from "./application/messaging-application-service";
import { validateMediaFile, detectKind, MAX_MEDIA_BYTES } from "./components/media/media-utils";

describe("WhatsApp · mídia · mimeToMediaType", () => {
  it("mapeia MIME → tipo da Cloud API", () => {
    expect(mimeToMediaType("image/png")).toBe("image");
    expect(mimeToMediaType("image/jpeg")).toBe("image");
    expect(mimeToMediaType("audio/ogg")).toBe("audio");
    expect(mimeToMediaType("application/pdf")).toBe("document");
    expect(mimeToMediaType("text/plain")).toBeNull();
    expect(mimeToMediaType("video/mp4")).toBeNull();
  });
});

describe("WhatsApp · mídia · validação (UI)", () => {
  it("detectKind coerente com mimeToMediaType", () => {
    expect(detectKind("image/webp")).toBe("image");
    expect(detectKind("audio/mpeg")).toBe("audio");
    expect(detectKind("application/pdf")).toBe("document");
    expect(detectKind("application/zip")).toBeNull();
  });

  it("rejeita formato não suportado e acima do limite", () => {
    const bad = new File([new Uint8Array(4)], "a.zip", { type: "application/zip" });
    expect(validateMediaFile(bad).ok).toBe(false);
    const big = new File([new Uint8Array(MAX_MEDIA_BYTES + 1)], "b.png", { type: "image/png" });
    expect(validateMediaFile(big).ok).toBe(false);
    const okFile = new File([new Uint8Array(10)], "c.png", { type: "image/png" });
    expect(validateMediaFile(okFile).ok).toBe(true);
  });
});
