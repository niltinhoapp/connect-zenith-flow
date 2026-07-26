import { eventBus } from "@/core/events";
import { invariant } from "@/core/domain";
import { Cliente, type CreateClienteInput } from "../entities/cliente";
import type { ClienteFilter, ClienteRepository } from "../repositories/cliente-repository";

export interface UpdateClienteInput {
  name?: string;
  status?: string;
  email?: string | null;
  phone?: string | null;
}

/**
 * Serviço de domínio de Clientes: orquestra regras (entidade), persistência
 * (repository) e comunicação entre módulos (Event Bus). Não conhece React,
 * rotas nem Supabase — recebe o repositório por injeção (testável com fake).
 */
export class ClienteService {
  constructor(private readonly repo: ClienteRepository) {}

  list(filter?: ClienteFilter): Promise<Cliente[]> {
    return this.repo.findMany(filter);
  }

  get(id: string): Promise<Cliente | null> {
    return this.repo.findById(id);
  }

  async create(input: CreateClienteInput): Promise<Cliente> {
    const cliente = Cliente.create(input); // invariantes no domínio
    const saved = await this.repo.create(cliente); // persistência via repository
    await eventBus.publish("customer.created", {
      organizationId: saved.organizationId,
      customerId: saved.id,
    });
    return saved;
  }

  async update(id: string, changes: UpdateClienteInput): Promise<Cliente> {
    const cliente = await this.repo.findById(id);
    invariant(cliente, "Cliente não encontrado");
    if (changes.name !== undefined) cliente.rename(changes.name);
    if (changes.status !== undefined) cliente.changeStatus(changes.status);
    if (changes.email !== undefined || changes.phone !== undefined) {
      cliente.updateContact({ email: changes.email, phone: changes.phone });
    }
    const saved = await this.repo.update(cliente);
    await eventBus.publish("customer.updated", {
      organizationId: saved.organizationId,
      customerId: saved.id,
    });
    return saved;
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
