/** Clientes · Domain — barrel. */
export { Cliente, type ClienteProps, type CreateClienteInput } from "./entities/cliente";
export { Email } from "./value-objects/email";
export { Phone } from "./value-objects/phone";
export {
  ClienteStatus,
  CLIENTE_STATUSES,
  type ClienteStatusValue,
} from "./value-objects/cliente-status";
export {
  ClienteService,
  type UpdateClienteInput,
} from "./services/cliente-service";
export type {
  ClienteRepository,
  ClienteFilter,
} from "./repositories/cliente-repository";
export * from "./events";
