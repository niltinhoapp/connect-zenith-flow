import type { EnqueueInput, QueueProvider } from "@/core/jobs/types";

/**
 * JobDispatcher — porta de entrada para enfileirar jobs a partir dos
 * Application Services (nunca insere direto na tabela).
 */
export class JobDispatcher {
  constructor(private readonly provider: QueueProvider) {}

  enqueue(input: EnqueueInput): Promise<string> {
    return this.provider.enqueue(input);
  }
}
