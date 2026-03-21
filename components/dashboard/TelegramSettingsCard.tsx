"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TelegramSettingsCardProps = {
  initialHasBillingAccess?: boolean | null;
};

export default function TelegramSettingsCard({ initialHasBillingAccess = null }: TelegramSettingsCardProps) {
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramActionLoading, setTelegramActionLoading] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramSuccess, setTelegramSuccess] = useState<string | null>(null);
  const [hasBillingAccess, setHasBillingAccess] = useState<boolean | null>(initialHasBillingAccess);
  const [connectStartToken, setConnectStartToken] = useState<string | null>(null);

  const loadTelegramStatus = useCallback(async (options?: { quiet?: boolean }) => {
    const quiet = options?.quiet ?? false;
    if (!quiet) {
      setTelegramLoading(true);
      setTelegramError(null);
      setTelegramSuccess(null);
    }

    try {
      const [response, billingResponse] = await Promise.all([
        fetch("/api/telegram/status", { cache: "no-store" }),
        fetch("/api/billing/status", { cache: "no-store" }),
      ]);
      const data = (await response.json()) as {
        ok?: boolean;
        connected?: boolean;
        error?: string;
        chatId?: string | null;
      };
      const billingData = (await billingResponse.json()) as {
        ok?: boolean;
        hasAccess?: boolean;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "failed_to_load_status");
      }

      setTelegramConnected(Boolean(data.connected));
      setHasBillingAccess(Boolean(billingData.ok && billingData.hasAccess));
    } catch (error) {
      setHasBillingAccess(false);
      if (!quiet) {
        setTelegramError(error instanceof Error ? error.message : "failed_to_load_status");
      }
    } finally {
      if (!quiet) {
        setTelegramLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadTelegramStatus();
  }, [loadTelegramStatus]);

  useEffect(() => {
    if (!telegramSuccess) {
      return;
    }

    const timer = window.setTimeout(() => {
      setTelegramSuccess(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [telegramSuccess]);

  useEffect(() => {
    const onFocus = () => {
      void loadTelegramStatus({ quiet: true });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadTelegramStatus({ quiet: true });
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadTelegramStatus]);

  async function handleTelegramConnect() {
    setTelegramActionLoading(true);
    setTelegramError(null);
    setTelegramSuccess(null);
    setConnectStartToken(null);

    try {
      const response = await fetch("/api/telegram/connect", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        connectUrl?: string | null;
        startToken?: string;
        error?: string;
        message?: string;
        requiresBotUsername?: boolean;
      };

      if (!response.ok || !data.ok) {
        if (response.status === 402 || data.error === "subscription_required") {
          setHasBillingAccess(false);
        }
        throw new Error(data.message ?? data.error ?? "failed_to_create_connect_link");
      }

      if (!data.connectUrl) {
        if (data.requiresBotUsername) {
          throw new Error("missing TELEGRAM_BOT_USERNAME");
        }
        throw new Error("missing_connect_url");
      }

      setConnectStartToken(data.startToken ?? null);
      window.open(data.connectUrl, "_blank", "noopener,noreferrer");
      setTelegramSuccess("Esperando confirmacion de Telegram...");

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 1500);
        });

        const statusResponse = await fetch("/api/telegram/status", { cache: "no-store" });
        const statusData = (await statusResponse.json()) as {
          ok?: boolean;
          connected?: boolean;
          error?: string;
        };

        if (!statusResponse.ok || !statusData.ok) {
          continue;
        }

        if (statusData.connected) {
          setTelegramConnected(true);
          setTelegramSuccess("Telegram conectado.");
          setConnectStartToken(null);
          return;
        }
      }

      setTelegramSuccess("Aun esperando Telegram. Pulsa Actualizar despues de presionar Start en el chat del bot.");
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "failed_to_connect");
    } finally {
      setTelegramActionLoading(false);
    }
  }

  async function handleTelegramDisconnect() {
    setTelegramActionLoading(true);
    setTelegramError(null);
    setTelegramSuccess(null);

    try {
      const response = await fetch("/api/telegram/disconnect", {
        method: "POST",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "failed_to_disconnect");
      }

      await loadTelegramStatus();
      setTelegramSuccess("Telegram desconectado.");
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "failed_to_disconnect");
    } finally {
      setTelegramActionLoading(false);
    }
  }

  async function handleSendTestPing() {
    setTelegramActionLoading(true);
    setTelegramError(null);
    setTelegramSuccess(null);

    try {
      const response = await fetch("/api/telegram/test", {
        method: "POST",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; message?: string };

      if (!response.ok || !data.ok) {
        if (response.status === 402 || data.error === "subscription_required") {
          setHasBillingAccess(false);
        }
        throw new Error(data.message ?? data.error ?? "failed_to_send_test_ping");
      }

      setTelegramSuccess("Prueba enviada.");
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "failed_to_send_test_ping");
    } finally {
      setTelegramActionLoading(false);
    }
  }
  const controlsDisabled = telegramLoading || telegramActionLoading || hasBillingAccess !== true;

  return (
    <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Telegram</p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">Canal de entrega</h3>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        Conecta tu chat de Telegram, verifica la entrega y controla notificaciones de prueba.
      </p>

      <div className="relative mt-5">
        <div
          className={`transition-opacity ${hasBillingAccess === true ? "opacity-100" : "pointer-events-none opacity-80"}`}
          aria-hidden={hasBillingAccess !== true}
        >
          <div className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Estado de conexion</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2 w-2 ${telegramConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
              <p className={`font-semibold ${telegramConnected ? "text-emerald-300" : "text-amber-300"}`}>
                {telegramLoading ? "Verificando..." : telegramConnected ? "Conectado" : "No conectado"}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-4 overflow-hidden border border-[var(--border-1)]">
              <button
                type="button"
                disabled={telegramConnected || controlsDisabled}
                onClick={handleTelegramConnect}
                className="inline-flex h-10 cursor-pointer items-center justify-center border-r border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)]"
              >
                Conectar
              </button>
              <button
                type="button"
                disabled={!telegramConnected || controlsDisabled}
                onClick={handleSendTestPing}
                className="inline-flex h-10 cursor-pointer items-center justify-center border-r border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-2)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)]"
              >
                Probar
              </button>
              <button
                type="button"
                disabled={!telegramConnected || controlsDisabled}
                onClick={handleTelegramDisconnect}
                className="inline-flex h-10 cursor-pointer items-center justify-center border-r border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-2)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)]"
              >
                Desconectar
              </button>
              <button
                type="button"
                disabled={controlsDisabled}
                onClick={() => void loadTelegramStatus()}
                className="inline-flex h-10 cursor-pointer items-center justify-center bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-2)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)]"
              >
                Actualizar
              </button>
            </div>

            {telegramError ? <p className="mt-3 text-xs text-rose-300">Error de Telegram: {telegramError}</p> : null}
            {telegramSuccess ? <p className="mt-3 text-xs text-emerald-300">{telegramSuccess}</p> : null}
            {!telegramConnected && connectStartToken ? (
              <p className="mt-2 text-xs text-[var(--text-3)]">
                Si hace falta, envia esto en Telegram: <span className="font-mono text-[var(--text-2)]">/start {connectStartToken}</span>
              </p>
            ) : null}
          </div>
        </div>

        {hasBillingAccess === false ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 p-4">
            <div className="max-w-md border border-yellow-300/80 bg-yellow-300/20 p-4 text-center shadow-lg">
              <p className="text-sm font-semibold text-[var(--text-1)]">
                Inicia tu prueba gratis para ver y gestionar ajustes de entrega de Telegram.
              </p>
              <Link
                href="/billing?intent=trial"
                className="mt-3 inline-flex h-10 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--bg-0)] hover:text-[var(--text-1)]"
              >
                Iniciar prueba gratis
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
