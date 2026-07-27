import { describe, it, expect } from "vitest";
import type { Database } from "@/types/database";
import { rowToCustomer } from "./customer-supabase-repository";

const row: Database["public"]["Tables"]["customers"]["Row"] = {
  id: "c1",
  organization_id: "o",
  code: "CUST-00001",
  type: "person",
  first_name: "Ana",
  last_name: "Lima",
  company_name: null,
  document: null,
  email: "a@x.com",
  phone: null,
  mobile: null,
  website: null,
  status: "active",
  owner_id: null,
  source: null,
  notes: null,
  tags: [],
  custom_fields: {},
  last_contact_at: null,
  next_followup_at: null,
  score: null,
  lifetime_value: 0,
  origin_channel: null,
  created_at: "t",
  updated_at: "t",
  deleted_at: null,
};

describe("customer mapper (repository)", () => {
  it("mapeia row → Customer preservando dados", () => {
    const customer = rowToCustomer(row);
    expect(customer.id).toBe("c1");
    expect(customer.displayName).toBe("Ana Lima");
    expect(customer.status).toBe("active");
    expect(customer.toJSON().email).toBe("a@x.com");
  });
});
