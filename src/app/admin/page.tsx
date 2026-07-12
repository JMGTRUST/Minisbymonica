import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { recentRoutes } from "@/lib/demo-data";
import { getSession } from "@/lib/session";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/chofer");

  return (
    <AppShell section="admin" session={session}>
      <header className="portal-header">
        <div><p className="eyebrow">Sábado, 4 de julio</p><h1>Buenos días, administración</h1><p>Así avanza la operación de hoy.</p></div>
        <button className="primary-button compact">Preparar despacho</button>
      </header>

      <section className="metric-grid">
        <article className="metric-card accent"><span>Mercancía en tiendas</span><strong>RD$ 53,865</strong><small>14 de 28 tiendas con conteo</small></article>
        <article className="metric-card"><span>Visitas completadas</span><strong>15 / 28</strong><small>53% de la jornada</small></article>
        <article className="metric-card"><span>Unidades vendidas</span><strong>184</strong><small>Reportadas hoy</small></article>
        <article className="metric-card"><span>Alertas de inventario</span><strong>6</strong><small>Debajo de la mitad del par</small></article>
      </section>

      <section className="content-grid">
        <article className="panel-card">
          <div className="panel-heading"><div><p className="eyebrow">Seguimiento</p><h2>Rutas de hoy</h2></div><button className="text-button">Ver todas</button></div>
          <div className="route-table">
            {recentRoutes.map((item) => (
              <div className="route-row" key={item.route}>
                <span className="route-icon">↗</span>
                <span><strong>{item.route}</strong><small>{item.driver}</small></span>
                <span className="progress-copy">{item.progress}</span>
                <span className={`status ${item.state === "Completada" ? "success" : ""}`}>{item.state}</span>
              </div>
            ))}
          </div>
        </article>
        <aside className="panel-card focus-card">
          <p className="eyebrow">Siguiente paso</p>
          <h2>13 tiendas esperan conteo</h2>
          <p>Las rutas 1 y 2 concentran la mayor parte de las visitas pendientes.</p>
          <div className="ring"><span>53%</span></div>
          <button className="secondary-button">Revisar pendientes</button>
        </aside>
      </section>
    </AppShell>
  );
}
