# Asaas na ConnectWeb

A integração começa em **sandbox** e, nesta etapa, cobra apenas os pacotes
adicionais de IA. O plano mensal será ligado ao mesmo adaptador depois da
homologação do fluxo avulso.

## Garantias do fluxo

- preço e quantidade de créditos vêm de `billing_products`, nunca do navegador;
- CPF/CNPJ é validado e guardado no perfil de cobrança da empresa;
- a chave do Asaas existe somente nas Edge Functions;
- o webhook exige `asaas-access-token` e cada evento é processado uma vez;
- antes de liberar créditos, a função consulta a cobrança diretamente no Asaas
  e compara identificador, referência externa e valor;
- eventos que falham podem ser tentados novamente com o mesmo ID.

## Secrets

Configurar nas Edge Functions, sem prefixo `VITE_`:

```text
ASAAS_ENV=sandbox
ASAAS_API_KEY=$aact_hmlg_...
ASAAS_WEBHOOK_TOKEN=<segredo forte de 32 a 255 caracteres>
```

O código recusa uma chave de produção quando `ASAAS_ENV=sandbox` e vice-versa.

## Publicação em sandbox

1. Aplicar `0072_asaas_billing_provider.sql`.
2. Configurar os três secrets acima.
3. Publicar `asaas-checkout` e `asaas-webhook`.
4. No painel sandbox do Asaas, criar um webhook apontando para:
   `https://<project-ref>.supabase.co/functions/v1/asaas-webhook`.
5. Usar no webhook exatamente o mesmo valor de `ASAAS_WEBHOOK_TOKEN`.
6. Assinar pelo menos os eventos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED` e
   `PAYMENT_DELETED`.

Não mudar para produção antes de validar: criação da cobrança, pagamento de
teste, entrega única dos créditos, repetição do webhook e cancelamento.
