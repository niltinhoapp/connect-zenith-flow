import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { guard } from "@/core/application/guard";
import { InfrastructureError, NotFoundError } from "@/core/errors";
import type { CustomerApplicationService } from "@/features/clientes";
import type { CrmBoardService, DealApplicationService } from "@/features/crm";
import type { CommerceAnalysis } from "../domain";

export interface RegisterCommerceInput {
  conversationId: string;
  analysis: CommerceAnalysis;
}
export interface RegisterCommerceResult {
  customer: { id: string; name: string; created: boolean };
  deal: { id: string; title: string; created: boolean; amount: number; stage: string };
}

const digits = (value: string) => value.replace(/\D/g, "");
const payment = { pix: "Pix", card: "Cartão", cash: "Dinheiro" } as const;

export class CommerceCrmApplicationService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly customers: Pick<
      CustomerApplicationService,
      "get" | "list" | "create" | "update"
    >,
    private readonly deals: Pick<
      DealApplicationService,
      "list" | "create" | "update" | "moveStage"
    >,
    private readonly board: Pick<CrmBoardService, "getBoard">,
    private readonly organizationId: string,
  ) {}

  register(input: RegisterCommerceInput): Promise<RegisterCommerceResult> {
    return guard(
      async () => {
        const { data: conversation, error } = await this.db
          .from("conversations")
          .select("id, organization_id, contact_wa_id, contact_name, customer_id")
          .eq("id", input.conversationId)
          .eq("organization_id", this.organizationId)
          .is("deleted_at", null)
          .maybeSingle();
        if (error) throw new InfrastructureError(error.message, { cause: error });
        if (!conversation) throw new NotFoundError("Conversa não encontrada");

        let customer = conversation.customer_id
          ? await this.customers.get(conversation.customer_id)
          : null;
        let customerCreated = false;
        if (!customer) {
          const found = await this.customers.list({
            search: digits(conversation.contact_wa_id),
            limit: 20,
          });
          customer =
            found.items.find((item) => {
              const data = item.toJSON();
              return [data.phone, data.mobile].some(
                (phone) => phone && digits(phone) === digits(conversation.contact_wa_id),
              );
            }) ?? null;
        }
        if (!customer) {
          customer = await this.customers.create({
            firstName:
              conversation.contact_name?.trim() ||
              `Cliente ${conversation.contact_wa_id.slice(-4)}`,
            mobile: conversation.contact_wa_id,
            status: "prospect",
            source: "whatsapp_commerce",
            originChannel: "whatsapp",
            tags: ["atendente-comercial"],
          });
          customerCreated = true;
        }
        const customerData = customer.toJSON();
        if (!customerCreated && !customerData.phone && !customerData.mobile) {
          customer = await this.customers.update(customer.id, {
            mobile: conversation.contact_wa_id,
          });
        }
        if (conversation.customer_id !== customer.id) {
          const { error: linkError } = await this.db
            .from("conversations")
            .update({ customer_id: customer.id })
            .eq("id", conversation.id);
          if (linkError) throw new InfrastructureError(linkError.message, { cause: linkError });
        }

        const board = await this.board.getBoard();
        if (!board.pipelineId || board.stages.length === 0)
          throw new Error(
            "Configure um pipeline e ao menos uma etapa no CRM antes de registrar o pedido.",
          );
        const desiredType =
          input.analysis.confirmed || input.analysis.stage === "confirmed" ? "won" : "open";
        const stage =
          board.stages.find((item) => item.type === desiredType) ??
          board.stages.find((item) => item.type === "open") ??
          board.stages[0];
        const items = input.analysis.items.map(
          (item) => `${item.quantity ?? "?"}x ${item.description}`,
        );
        const notes = [
          `Pedido via WhatsApp (${conversation.id})`,
          `Itens: ${items.length ? items.join(", ") : "não informados"}`,
          `Atendimento: ${input.analysis.fulfillment === "delivery" ? "entrega" : input.analysis.fulfillment === "pickup" ? "retirada" : "não definido"}`,
          input.analysis.address ? `Endereço: ${input.analysis.address}` : null,
          `Pagamento: ${input.analysis.paymentMethod ? payment[input.analysis.paymentMethod] : "não informado"}`,
          input.analysis.changeCents !== null
            ? `Troco: R$ ${(input.analysis.changeCents / 100).toFixed(2)}`
            : null,
          input.analysis.warnings.length
            ? `Observações: ${input.analysis.warnings.join("; ")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n");
        const customFields = {
          commerceConversationId: conversation.id,
          commerceItems: input.analysis.items,
          fulfillment: input.analysis.fulfillment,
          address: input.analysis.address,
          paymentMethod: input.analysis.paymentMethod,
          commerceStage: input.analysis.stage,
        };
        const existing = (
          await this.deals.list({ customerId: customer.id, limit: 100 })
        ).items.find(
          (item) => item.toJSON().customFields.commerceConversationId === conversation.id,
        );
        const title = `Pedido WhatsApp — ${customer.displayName}`;
        let deal;
        let dealCreated = false;
        if (existing) {
          deal = await this.deals.update(existing.id, {
            customerId: customer.id,
            title,
            amount: input.analysis.orderTotalCents ?? 0,
            notes,
            tags: ["whatsapp", "atendente-comercial"],
            customFields,
          });
          if (deal.stageId !== stage.id)
            deal = await this.deals.moveStage(
              deal.id,
              stage.id,
              stage.type,
              "Pedido confirmado no atendimento comercial",
            );
        } else {
          deal = await this.deals.create({
            customerId: customer.id,
            pipelineId: board.pipelineId,
            stageId: stage.id,
            title,
            amount: input.analysis.orderTotalCents ?? 0,
            source: "whatsapp_commerce",
            notes,
            tags: ["whatsapp", "atendente-comercial"],
            customFields,
          });
          dealCreated = true;
          if (stage.type !== "open")
            deal = await this.deals.moveStage(
              deal.id,
              stage.id,
              stage.type,
              "Pedido confirmado no atendimento comercial",
            );
        }
        return {
          customer: { id: customer.id, name: customer.displayName, created: customerCreated },
          deal: {
            id: deal.id,
            title,
            created: dealCreated,
            amount: deal.amount,
            stage: stage.name,
          },
        };
      },
      { service: "whatsapp.commerce.registerCrm", id: input.conversationId },
    );
  }
}
