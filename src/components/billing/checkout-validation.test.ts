import { describe, expect, it } from "vitest";
import { billingCustomerSchema } from "./checkout-validation";

describe("dados do checkout", () => {
  it("normaliza CPF e telefone antes do envio", () => {
    expect(
      billingCustomerSchema.parse({
        legalName: "Loja Exemplo",
        email: "financeiro@loja.com.br",
        taxId: "123.456.789-01",
        phone: "(11) 99999-0000",
      }),
    ).toEqual({
      legalName: "Loja Exemplo",
      email: "financeiro@loja.com.br",
      taxId: "12345678901",
      phone: "11999990000",
    });
  });

  it("rejeita documento com quantidade de dígitos inválida", () => {
    expect(
      billingCustomerSchema.safeParse({
        legalName: "Loja Exemplo",
        email: "financeiro@loja.com.br",
        taxId: "123",
        phone: "",
      }).success,
    ).toBe(false);
  });
});
