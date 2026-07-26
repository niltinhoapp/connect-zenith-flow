/**
 * Core · Domain — Entity base.
 *
 * Uma Entity tem identidade (`id`) e encapsula invariantes de negócio. Regras de
 * negócio vivem AQUI (e em Value Objects / Services) — nunca em componentes
 * React nem em rotas. Ver docs/ARCHITECTURE.md · Domain Layer.
 */
export abstract class Entity<Props extends { id: string }> {
  protected readonly props: Props;

  protected constructor(props: Props) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }

  equals(other?: Entity<Props> | null): boolean {
    return other != null && other.id === this.id;
  }

  /** Snapshot serializável dos dados (para repositories/DTOs). */
  toJSON(): Props {
    return { ...this.props };
  }
}
