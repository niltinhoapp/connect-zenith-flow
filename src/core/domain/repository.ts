/**
 * Core · Domain — contrato base de Repository.
 *
 * TODO acesso ao banco passa por um Repository (nunca queries soltas em rotas/
 * componentes). A camada de domínio depende desta INTERFACE; a implementação
 * concreta (Supabase) fica na camada de infraestrutura do módulo (F2+).
 *
 * Multi-tenant: as implementações operam sob o cliente autenticado, então a
 * RLS já escopa por `organization_id`. Métodos de escrita recebem/retornam
 * entidades de domínio.
 */
export interface Repository<TEntity, TId = string> {
  findById(id: TId): Promise<TEntity | null>;
  list(): Promise<TEntity[]>;
  create(entity: TEntity): Promise<TEntity>;
  update(entity: TEntity): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}

/** Resultado paginado (itens + total), para findMany com paginação no banco. */
export interface Paginated<T> {
  items: T[];
  total: number;
}
