/** Clientes · Domain — barrel (entidades, VOs, contrato de repositório). */
export { Customer, type CustomerProps, type CreateCustomerInput, type CustomerType } from "./entities/customer";
export { Email } from "./value-objects/email";
export { Phone } from "./value-objects/phone";
export { CustomerStatus, CUSTOMER_STATUSES, type CustomerStatusValue } from "./value-objects/customer-status";
export type { CustomerRepository, CustomerFilter, Paginated } from "./repositories/customer-repository";
