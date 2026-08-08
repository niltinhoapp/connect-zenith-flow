import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  redirect,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { fetchSession, SessionProvider, type AuthSession } from "@/core/auth";

const PUBLIC_PATHS = ["/login", "/cadastro", "/recuperar-senha"];
const MFA_PATH = "/verificar-2fa";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Error 404
        </p>
        <h1 className="mt-4 text-6xl font-bold tracking-tight text-foreground">
          Página não encontrada
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          O recurso que você procura foi movido ou não existe mais.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Algo deu errado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente novamente ou volte para a tela inicial.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Middleware de sessão + guard: carrega a sessão real (SSR via cookies) e
  // protege as rotas. Rotas públicas de auth ficam livres; usuário logado é
  // afastado delas. Resiliente à ausência de config Supabase (trata como null).
  beforeLoad: async ({ location }) => {
    let session: AuthSession | null = null;
    try {
      session = await fetchSession();
    } catch {
      session = null;
    }
    const isPublic = PUBLIC_PATHS.includes(location.pathname);
    if (!session && !isPublic) {
      throw redirect({ to: "/login" });
    }
    if (session?.mfaRequired && location.pathname !== MFA_PATH) {
      throw redirect({ to: MFA_PATH });
    }
    if (session && !session.mfaRequired && location.pathname === MFA_PATH) {
      throw redirect({ to: "/" });
    }
    if (session && isPublic) {
      throw redirect({ to: "/" });
    }
    return { session };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ConnectWeb Automations — Plataforma de automação empresarial" },
      {
        name: "description",
        content:
          "ConnectWeb Automations: CRM, WhatsApp, automações e IA em uma única plataforma premium para times de alta performance.",
      },
      { property: "og:title", content: "ConnectWeb Automations" },
      {
        property: "og:description",
        content: "Automação empresarial premium — CRM, WhatsApp, IA e mais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient, session } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>
        <Outlet />
        <Toaster />
      </SessionProvider>
    </QueryClientProvider>
  );
}
