import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { routeStores } from "@/lib/demo-data";
import { getSession } from "@/lib/session";

export default async function DriverPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "chofer") redirect("/admin");

  return (
    <AppShell section="chofer" session={session}>
      <header className="portal-header driver-header">
        <div><p className="eyebrow">Ruta 1 · Distrito Nacional</p><h1>Tu ruta de hoy</h1><p>Completa el conteo antes de reponer cada exhibidor.</p></div>
        <div className="route-progress"><strong>2 de 7</strong><span>tiendas visitadas</span></div>
      </header>

      <section className="driver-summary">
        <div><span className="summary-icon">↗</span><span><small>Siguiente parada</small><strong>Bravo 27 de Febrero</strong></span></div>
        <button className="primary-button compact">Continuar visita</button>
      </section>

      <section className="panel-card driver-list">
        <div className="panel-heading"><div><p className="eyebrow">Paradas asignadas</p><h2>Tiendas de tu ruta</h2></div><span className="privacy-badge">Solo ves tu ruta</span></div>
        {routeStores.map((store, index) => (
          <article className="store-row" key={store.id}>
            <span className={`stop-number ${store.status === "Completada" ? "complete" : store.status === "En curso" ? "current" : ""}`}>
              {store.status === "Completada" ? "✓" : index + 1}
            </span>
            <span className="store-name"><strong>{store.name}</strong><small>{store.time}</small></span>
            <span className={`status ${store.status === "Completada" ? "success" : store.status === "En curso" ? "active" : "pending"}`}>{store.status}</span>
            <button className="secondary-button compact">{store.status === "En curso" ? "Continuar" : store.status === "Completada" ? "Ver" : "Iniciar"}</button>
          </article>
        ))}
      </section>
      <p className="driver-note">Los choferes no pueden ver precios, ventas, configuración ni información de otras rutas.</p>
    </AppShell>
  );
}
