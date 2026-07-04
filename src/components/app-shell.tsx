import Link from "next/link";
import { logout } from "@/app/actions";
import type { Session } from "@/lib/session";

type AppShellProps = {
  children: React.ReactNode;
  section: "admin" | "chofer";
  session: Session;
};

export function AppShell({ children, section, session }: AppShellProps) {
  const admin = section === "admin";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand brand-sidebar" href={admin ? "/admin" : "/chofer"}>
          <span className="brand-mark" aria-hidden>m</span>
          <span><strong>Minis by Mónica</strong><small>{admin ? "Administración" : "Portal del chofer"}</small></span>
        </Link>
        <nav className="side-nav" aria-label="Navegación principal">
          {admin ? (
            <>
              <Link className="active" href="/admin">Resumen</Link>
              <span>Despacho</span>
              <span>Inventario</span>
              <span>Tiendas y rutas</span>
              <span>Configuración</span>
            </>
          ) : (
            <>
              <Link className="active" href="/chofer">Mi ruta de hoy</Link>
              <span>Visitas completadas</span>
              <span>Ayuda</span>
            </>
          )}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{session.name.slice(0, 1).toUpperCase()}</span>
          <span><strong>{session.name}</strong><small>{session.email}</small></span>
        </div>
        <form action={logout}><button className="ghost-button" type="submit">Cerrar sesión</button></form>
      </aside>
      <main className="portal-main">{children}</main>
    </div>
  );
}
