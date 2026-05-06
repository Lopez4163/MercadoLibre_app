import Image from "next/image";
import Link from "next/link";
import Navbar from "../../components/layout/Navbar";
import { isDemoMode } from "../../lib/demo-mode";

const workflowSteps = [
  {
    number: "1",
    title: "Conecta Mercado Libre",
    body: "Vincula tu cuenta oficial mediante OAuth seguro y deja que MercadoLibs lea la actividad operativa clave.",
  },
  {
    number: "2",
    title: "Conecta Telegram",
    body: "Activa el bot para recibir notificaciones de ventas, stock y entregas en tu canal operativo.",
  },
  {
    number: "3",
    title: "Recibe alertas",
    body: "Monitorea ventas y riesgo de quiebre sin revisar Mercado Libre manualmente todo el dia.",
  },
];

const inventoryRows = [
  { product: "Monitor Gamer 24 144Hz", stock: "2", sales: "14", status: "Critico", tone: "danger" },
  { product: "Silla Ergonomica Pro", stock: "5", sales: "8", status: "Alerta", tone: "warning" },
  { product: "Hub USB-C 7 en 1", stock: "18", sales: "6", status: "Saludable", tone: "good" },
];

const recentOrders = [
  { id: "ORD-5521", product: "Cable HDMI 2.1", status: "Entregado", tone: "good" },
  { id: "ORD-5520", product: "Mouse Pad XL", status: "En camino", tone: "info" },
  { id: "ORD-5519", product: "Hub USB-C 7 en 1", status: "Revisar", tone: "danger" },
  { id: "ORD-5518", product: "Lampara Escritorio", status: "Entregado", tone: "good" },
];

const benefits = [
  {
    icon: "01",
    title: "Alertas de venta",
    body: "Las notificaciones llegan a Telegram cuando se paga un pedido, sin tener que refrescar Mercado Libre.",
  },
  {
    icon: "02",
    title: "Riesgo de inventario",
    body: "Detecta publicaciones bajas, criticas o agotadas antes de perder ventas o afectar reputacion.",
  },
  {
    icon: "03",
    title: "Etiquetas de envio",
    body: "Revisa que pedidos pagados tienen etiqueta lista y descarga las disponibles desde la vista de pedidos.",
  },
  {
    icon: "04",
    title: "Panel operativo",
    body: "Consulta pedidos, inventario, estado de entrega y reglas de notificacion desde un solo espacio de trabajo.",
  },
];

function statusClasses(tone: string) {
  if (tone === "danger") {
    return "bg-[#3a1316] text-[#ffb4ab] ring-[#7a2a30]";
  }
  if (tone === "warning") {
    return "bg-[#3f3500] text-[#fde400] ring-[#756400]";
  }
  if (tone === "info") {
    return "bg-[#082f43] text-[#85cfff] ring-[#145876]";
  }
  return "bg-[#0d3426] text-[#72f0b2] ring-[#1f6b4c]";
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[260px] rounded-[2.15rem] border border-[#4b5563] bg-[#05070a] p-2 shadow-[0_26px_70px_rgba(0,0,0,0.56)] sm:w-[282px]">
      <div className="absolute left-1/2 top-3 z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-[#05070a]" />
      <div className="overflow-hidden rounded-[1.65rem] border border-[#273140] bg-[#17212b]">
        <div className="bg-[#223041] px-4 pb-3 pt-7">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#d7dde5]">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm border border-[#d7dde5]" />
              <span className="h-2 w-2 rounded-full bg-[#7db9ff]" />
            </div>
          </div>
        </div>
        <div className="border-b border-[#0f1a24] bg-[#17212b] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#05070a]">
              <Image
                src="/images/telegram/telegram_logo.png"
                alt="Logo del bot de MercadoLibs"
                width={88}
                height={88}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-white">mercadolibs_bot</p>
              <p className="text-xs text-[#8d9aa8]">bot</p>
            </div>
            <div className="flex items-center gap-3 text-[#62a8ea]">
              <span className="h-5 w-5 rounded-full border-2 border-current" />
              <span className="text-lg leading-none">...</span>
            </div>
          </div>
        </div>
        <div className="h-[430px] overflow-hidden bg-[#0f1b26] px-3 py-4">
          <div className="mx-auto mb-3 w-fit rounded-full bg-[#1f2f3e] px-3 py-1 text-[11px] font-semibold text-[#9fadb9]">
            24 March
          </div>
          <div className="relative mb-3 max-w-[94%] rounded-[1.15rem] rounded-bl-sm bg-[#233244] px-4 py-3 text-[#e7edf4] shadow-lg">
            <span className="absolute bottom-0 left-[-5px] h-3 w-3 bg-[#233244] [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded bg-[#42c767] text-[8px] font-black text-white">
                OK
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-4">ORDER SOLD</p>
                <p className="mt-1 text-[12px] leading-[1.35]">
                  Order: 2000015648068350<br />
                  Items: 1<br />
                  Total: COP 98,999<br />
                  Status: Paid
                </p>
                <p className="mt-2 text-[12px] leading-[1.35]">
                  Line items:<br />- 1 x Tiras Reactivas Accu-chek Instant 100 Uds
                </p>
              </div>
            </div>
            <p className="mt-1 text-right text-[11px] text-[#9fadb9]">1:43 PM</p>
          </div>
          <div className="mx-auto mb-3 w-fit rounded-full bg-[#1f2f3e] px-3 py-1 text-[11px] font-semibold text-[#9fadb9]">
            28 March
          </div>
          <div className="relative mb-3 max-w-[94%] rounded-[1.15rem] rounded-bl-sm bg-[#233244] px-4 py-3 text-[#e7edf4] shadow-lg">
            <span className="absolute bottom-0 left-[-5px] h-3 w-3 bg-[#233244] [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded bg-[#42c767] text-[8px] font-black text-white">
                OK
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-4">ORDER SOLD</p>
                <p className="mt-1 text-[12px] leading-[1.35]">
                  Order: 2000015726708150<br />
                  Items: 1<br />
                  Total: COP 72,826<br />
                  Status: Paid
                </p>
                <p className="mt-2 text-[12px] leading-[1.35]">
                  Line items:<br />- 1 x Tiras Reactivas Accu-chek Instant 50 Unidades
                </p>
              </div>
            </div>
            <p className="mt-1 text-right text-[11px] text-[#9fadb9]">9:18 PM</p>
          </div>
          <div className="relative max-w-[88%] rounded-[1.15rem] rounded-bl-sm bg-[#233244] px-4 py-3 text-[#e7edf4] shadow-lg">
            <span className="absolute bottom-0 left-[-5px] h-3 w-3 bg-[#233244] [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded bg-[#42c767] text-[8px] font-black text-white">
                OK
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-4">ORDER SOLD</p>
                <p className="mt-1 text-[12px] leading-[1.35]">
                  Order: 2000015745486126<br />
                  Total: COP 480,000<br />
                  Status: Paid
                </p>
                <p className="mt-2 text-[12px] leading-[1.35]">Line items:<br />- 1 x Silla De Ruedas Estandar</p>
              </div>
            </div>
            <p className="mt-1 text-right text-[11px] text-[#9fadb9]">10:05 PM</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-[#25313d] bg-[#17212b] px-4 py-3 text-[#9fadb9]">
          <span className="relative h-5 w-5 rounded-full border-2 border-[#9fadb9] after:absolute after:-bottom-1 after:-right-1 after:h-2 after:w-0.5 after:rotate-[-45deg] after:bg-[#9fadb9]" />
          <div className="flex-1 rounded-full bg-[#0f1b26] px-4 py-2 text-xs">Write a message...</div>
          <span className="h-5 w-5 rounded-full border border-[#9fadb9]" />
        </div>
      </div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="relative min-h-[640px] pt-2 sm:min-h-[600px] lg:min-h-[560px]">
      <div className="overflow-hidden rounded-lg border border-[#4b4731] bg-[#101116] shadow-[0_24px_80px_rgba(0,0,0,0.42)] lg:mr-24">
        <div className="flex items-center justify-between border-b border-[#2d2e35] bg-[#14151a] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#fde400]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#85cfff]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#5d6470]" />
          </div>
          <p className="font-mono text-xs text-[#cdc7aa]">MercadoLibs Command Center</p>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Ventas hoy", "18", "+12%"],
                ["Alertas", "4", "Criticas"],
                ["Telegram", "Activo", "< 1s"],
              ].map(([label, value, meta]) => (
                <div key={label} className="rounded border border-[#2d2e35] bg-[#1e1c10] p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#979177]">{label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{value}</p>
                  <p className="mt-1 font-mono text-xs text-[#85cfff]">{meta}</p>
                </div>
              ))}
            </div>
            <div className="rounded border border-[#2d2e35] bg-[#14151a]">
              <div className="flex items-center justify-between border-b border-[#2d2e35] px-4 py-3">
                <h3 className="text-sm font-semibold text-white">Riesgo de inventario</h3>
                <span className="font-mono text-xs text-[#ffb4ab]">4 alertas</span>
              </div>
              <div className="divide-y divide-[#2d2e35]">
                {inventoryRows.map((row) => (
                  <div key={row.product} className="grid grid-cols-[1fr_56px_72px_86px] items-center gap-3 px-4 py-3 text-sm">
                    <p className="truncate text-[#e8e2cf]">{row.product}</p>
                    <p className="text-right font-mono text-[#e8e2cf]">{row.stock}</p>
                    <p className="text-right font-mono text-[#cdc7aa]">{row.sales}</p>
                    <span className={`justify-self-start rounded px-2 py-1 text-[10px] font-bold uppercase ring-1 ${statusClasses(row.tone)}`}>
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4 pr-0 lg:pr-8">
            <div className="rounded border border-[#2d2e35] bg-[#14151a] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Telegram</h3>
                <span className="rounded bg-[#082f43] px-2 py-1 text-[10px] font-bold uppercase text-[#85cfff] ring-1 ring-[#145876]">
                  Conectado
                </span>
              </div>
              <div className="rounded-lg rounded-tl-sm bg-[#199ad5] p-3 text-[#002d42] shadow-lg">
                <p className="text-xs font-bold">MercadoLibs Bot</p>
                <p className="mt-2 text-sm font-semibold">Nueva venta detectada</p>
                <p className="mt-1 text-xs">Teclado mecanico RGB - Stock restante: 12 unidades.</p>
              </div>
            </div>
            <div className="rounded border border-[#2d2e35] bg-[#14151a] p-4">
              <h3 className="text-sm font-semibold text-white">Reglas activas</h3>
              <div className="mt-4 space-y-3">
                {["Venta confirmada", "Bajo stock", "Etiqueta lista"].map((rule) => (
                  <div key={rule} className="flex items-center justify-between rounded border border-[#2d2e35] bg-[#1e1c10] px-3 py-2">
                    <span className="text-sm text-[#e8e2cf]">{rule}</span>
                    <span className="h-2.5 w-2.5 rounded-full bg-[#fde400]" />
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden rounded border border-[#2d2e35] bg-[#1e1c10] p-4 lg:block">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#979177]">Estado de conexion</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="font-mono text-[#fde400]">OAuth</p>
                  <p className="text-xs text-[#cdc7aa]">Mercado Libre activo</p>
                </div>
                <div>
                  <p className="font-mono text-[#85cfff]">Bot</p>
                  <p className="text-xs text-[#cdc7aa]">Webhook operativo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-8 right-2 z-10 origin-bottom-right scale-[0.86] sm:right-8 sm:scale-[0.9] lg:-bottom-4 lg:-right-2 lg:scale-[0.86]">
        <PhoneMockup />
      </div>
    </div>
  );
}

export default function HomePage() {
  const demoMode = isDemoMode();
  const primaryHref = demoMode ? "/dashboard" : "/start-trial";
  const secondaryHref = demoMode ? "#panel" : "/dashboard";

  return (
    <main className="min-h-screen bg-[#0b0c10] text-[#e8e2cf]">
      <Navbar />
      {demoMode ? (
        <section className="border-b border-[#2d2e35] bg-[#14151a]">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <p className="text-sm text-[#cdc7aa]">
              <span className="font-semibold text-[#fde400]">Portfolio demo:</span> explora el producto con datos de
              muestra. Las integraciones reales estan desactivadas para vista publica.
            </p>
          </div>
        </section>
      ) : null}

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-16">
        <div>
          <h1 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl">
            Controla tus ventas, stock, etiquetas y alertas de <span className="text-[#fde400]">Mercado Libre</span>{" "}
            desde un solo panel
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#cdc7aa]">
            Recibe notificaciones de venta por Telegram, detecta riesgo de quiebre de stock, revisa etiquetas de envio
            y manten tu operacion al dia sin revisar Mercado Libre manualmente.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={primaryHref}
              className="inline-flex h-12 items-center rounded bg-[#fde400] px-6 text-sm font-bold text-[#373100] hover:brightness-110"
            >
              Ver demo en vivo
            </Link>
            <Link
              href={secondaryHref}
              className="inline-flex h-12 items-center rounded border border-[#4b4731] bg-[#14151a] px-6 text-sm font-bold text-white hover:border-[#85cfff]"
            >
              Ver pantallas
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["< 1s alertas", "Tiempo real"],
              ["Etiquetas", "Envios listos"],
              ["3 pasos", "Configuracion rapida"],
            ].map(([value, label]) => (
              <div key={value} className="rounded border border-[#2d2e35] bg-[#14151a] p-4">
                <p className="font-mono text-sm text-[#85cfff]">{value}</p>
                <p className="mt-1 text-xs text-[#979177]">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <DashboardMockup />
      </section>

      <section className="border-y border-[#2d2e35] bg-[#11120f] px-6 py-14">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white">Configuracion en minutos</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {workflowSteps.map((step) => (
              <div key={step.number} className="rounded border border-[#2d2e35] bg-[#14151a] p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#383527] font-mono text-lg font-bold text-[#fde400]">
                  {step.number}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#cdc7aa]">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="panel" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#85cfff]">Dentro del panel</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Visibilidad total de tu operacion
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#cdc7aa]">
            Superficies reales del producto para inventario, pedidos, reglas y alertas. Diseñado para revisar rapido y
            actuar antes de que el problema llegue al cliente.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="rounded-lg border border-[#2d2e35] bg-[#14151a] lg:col-span-8">
            <div className="flex items-center justify-between border-b border-[#2d2e35] px-5 py-4">
              <h3 className="text-lg font-semibold text-white">Riesgo de inventario</h3>
              <span className="font-mono text-xs uppercase text-[#ffb4ab]">4 alertas criticas</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-[#1e1c10] text-xs uppercase tracking-[0.1em] text-[#979177]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Producto</th>
                    <th className="px-5 py-3 text-right font-semibold">Stock</th>
                    <th className="px-5 py-3 text-right font-semibold">Ventas 7d</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2e35]">
                  {inventoryRows.map((row) => (
                    <tr key={row.product} className="hover:bg-[#1e1c10]">
                      <td className="px-5 py-4 text-[#e8e2cf]">{row.product}</td>
                      <td className="px-5 py-4 text-right font-mono text-white">{row.stock}</td>
                      <td className="px-5 py-4 text-right font-mono text-[#cdc7aa]">{row.sales}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ring-1 ${statusClasses(row.tone)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-[#2d2e35] bg-[#14151a] p-5 lg:col-span-4">
            <h3 className="text-lg font-semibold text-white">Notificaciones</h3>
            <div className="mt-5 rounded-lg border border-[#145876] bg-[#082f43] p-4">
              <p className="text-xs font-bold text-[#85cfff]">MercadoLibs Bot</p>
              <p className="mt-3 text-sm font-semibold text-white">Nueva venta</p>
              <p className="mt-2 text-sm leading-6 text-[#c7e7ff]">
                Producto: Teclado mecanico RGB. Precio: $45.990. Stock restante: 12 unidades.
              </p>
            </div>
            <p className="mt-5 text-sm leading-6 text-[#cdc7aa]">
              Recibe alertas directamente en Telegram personal o en tu canal operativo.
            </p>
          </div>

          <div className="rounded-lg border border-[#2d2e35] bg-[#14151a] p-5 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Pedidos recientes</h3>
              <Link href="/dashboard" className="text-xs font-bold text-[#85cfff] hover:text-white">
                Ver historial
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {recentOrders.map((order) => (
                <div key={order.id} className="rounded border border-[#2d2e35] bg-[#1e1c10] p-4">
                  <p className="font-mono text-xs text-[#979177]">{order.id}</p>
                  <p className="mt-2 font-semibold text-white">{order.product}</p>
                  <p className={`mt-2 text-xs font-bold uppercase ${order.tone === "danger" ? "text-[#ffb4ab]" : order.tone === "info" ? "text-[#85cfff]" : "text-[#72f0b2]"}`}>
                    {order.status}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#2d2e35] bg-[#14151a] lg:col-span-5">
            <div className="p-5">
              <h3 className="text-lg font-semibold text-white">Pantallas reales</h3>
              <p className="mt-2 text-sm leading-6 text-[#cdc7aa]">Resumen, pedidos y estadisticas con datos listos para actuar.</p>
            </div>
            <Image
              src="/images/dashboard-current.png"
              alt="Vista del dashboard de MercadoLibs"
              width={1200}
              height={760}
              className="h-auto w-full border-t border-[#2d2e35]"
            />
          </div>
        </div>
      </section>

      <section className="border-y border-[#2d2e35] bg-[#100e05] px-6 py-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#85cfff]">Flujo operativo</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Diseñado para la rutina diaria del vendedor
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#cdc7aa]">
              NotiVenta mantiene visibles las tareas criticas de Mercado Libre desde la venta hasta el envio.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="rounded border border-[#2d2e35] bg-[#14151a] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-[#383527] font-mono text-sm font-bold text-[#fde400]">
                {benefit.icon}
              </div>
              <h3 className="mt-5 font-semibold text-white">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#cdc7aa]">{benefit.body}</p>
            </div>
          ))}
          </div>
        </div>
      </section>

      <section id="precios" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#85cfff]">Precios</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Planes simples</h2>
          <p className="mt-3 text-[#cdc7aa]">Acceso temprano para vendedores profesionales.</p>
        </div>
        <div className="mx-auto mt-9 max-w-md rounded-lg border-2 border-[#fde400] bg-[#14151a] p-7">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#fde400]">Precio de acceso temprano</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">MercadoLibs Beta</h3>
            <p className="mt-4 text-5xl font-bold text-white">
              $5<span className="text-lg font-normal text-[#cdc7aa]">/mes</span>
            </p>
          </div>
          <ul className="mt-7 space-y-3 text-sm text-[#e8e2cf]">
            {["Alertas de ventas por Telegram", "Notificaciones de bajo stock", "Panel de inventario y pedidos", "Cobro seguro con Stripe"].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[#fde400]" />
                {item}
              </li>
            ))}
          </ul>
          <Link
            href={primaryHref}
            className="mt-8 inline-flex h-12 w-full items-center justify-center rounded bg-[#fde400] px-6 text-sm font-bold text-[#373100] hover:brightness-110"
          >
            {demoMode ? "Ver demo en vivo" : "Suscribirse ahora"}
          </Link>
        </div>
      </section>

      <section className="border-t border-[#2d2e35] bg-[#11120f] px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-white md:text-5xl">Listo para operar con mas visibilidad?</h2>
          <p className="mx-auto mt-4 max-w-xl text-[#cdc7aa]">
            Automatiza el monitoreo de ventas y stock para dedicar menos tiempo a revisar pantallas y mas tiempo a
            cumplir pedidos.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={primaryHref}
              className="inline-flex h-12 items-center rounded bg-[#fde400] px-7 text-sm font-bold text-[#373100] hover:brightness-110"
            >
              Ver demo en vivo
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center rounded border border-[#4b4731] bg-white/5 px-7 text-sm font-bold text-white hover:border-[#85cfff]"
            >
              Abrir panel
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#2d2e35] bg-[#0b0c10] px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="text-lg font-bold text-[#fde400]">MercadoLibs</p>
            <p className="mt-2 text-sm text-[#979177]">Operaciones de alta precision para Mercado Libre.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-[#cdc7aa]">
            <a href="#panel" className="hover:text-[#fde400]">Panel</a>
            <a href="#precios" className="hover:text-[#fde400]">Precios</a>
            <Link href="/dashboard" className="hover:text-[#fde400]">Demo</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
