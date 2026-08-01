import { describe, it, expect } from "vitest";
import { mimeToMediaType } from "./application/messaging-application-service";
import { validateMediaFile, detectKind, MAX_MEDIA_BYTES } from "./components/media/media-utils";
import { pickInboundMedia } from "./domain/inbound-media";

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

describe("WhatsApp · mídia inbound · pickInboundMedia", () => {
  it("extrai id/mime/filename de mídia", () => {
    expect(pickInboundMedia({ image: { id: "M1", mime_type: "image/jpeg" } }, "image")).toEqual({
      id: "M1",
      mime: "image/jpeg",
      filename: null,
    });
    expect(
      pickInboundMedia(
        { document: { id: "D1", mime_type: "application/pdf", filename: "a.pdf" } },
        "document",
      ),
    ).toEqual({ id: "D1", mime: "application/pdf", filename: "a.pdf" });
    expect(pickInboundMedia({ audio: { id: "A1", mime_type: "audio/ogg" } }, "audio")?.id).toBe(
      "A1",
    );
  });

  it("ignora texto e mídia sem id", () => {
    expect(pickInboundMedia({ text: { body: "oi" } }, "text")).toBeNull();
    expect(pickInboundMedia({ image: { mime_type: "image/png" } }, "image")).toBeNull();
  });
});
