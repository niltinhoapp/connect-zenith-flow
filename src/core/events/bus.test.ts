import { describe, it, expect, vi } from "vitest";
import { eventBus } from "@/core/events";

describe("Core · EventBus", () => {
  it("entrega o evento ao assinante e deriva organizationId do payload", async () => {
    const handler = vi.fn();
    const off = eventBus.subscribe("customer.created", handler);

    await eventBus.publish("customer.created", { organizationId: "org-1", customerId: "c-1" });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0];
    expect(event.name).toBe("customer.created");
    expect(event.organizationId).toBe("org-1");
    expect(event.payload.customerId).toBe("c-1");
    expect(typeof event.id).toBe("string");
    expect(typeof event.occurredAt).toBe("string");
    off();
  });

  it("não entrega após unsubscribe", async () => {
    const handler = vi.fn();
    const off = eventBus.subscribe("deal.created", handler);
    off();
    await eventBus.publish("deal.created", { organizationId: "o", dealId: "d" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("subscribeAll recebe qualquer evento publicado", async () => {
    const all = vi.fn();
    const off = eventBus.subscribeAll(all);
    await eventBus.publish("deal.won", { organizationId: "o", dealId: "d", amount: 100 });
    expect(all).toHaveBeenCalledTimes(1);
    expect(all.mock.calls[0][0].name).toBe("deal.won");
    off();
  });
});
