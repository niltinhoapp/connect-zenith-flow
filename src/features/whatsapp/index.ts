/**
 * Feature: WhatsApp
 * Module key: "whatsapp" (see src/config/modules.ts)
 *
 * Public surface of the WhatsApp feature. Domain logic (api, hooks, schema,
 * components) is added here from F3 onward; UI screens currently live in
 * src/routes and are migrated to consume this module without visual changes.
 */
export const MODULE_KEY = "whatsapp" as const;
