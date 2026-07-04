import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect(session.role === "admin" ? "/admin" : "/chofer");

  return (
    <main className="landing">
      <section className="landing-story">
        <header className="landing-header">
          <div className="brand">
            <Image className="brand-logo landing-logo" src="/minis-logo.png" alt="Minis by Mónica" width={112} height={72} priority />
            <span className="brand-context">Operaciones</span>
          </div>
          <span className="secure-pill">Acceso seguro</span>
        </header>
        <div className="story-copy">
          <p className="eyebrow">Inventario en movimiento, bajo control</p>
          <h1>Un solo lugar para coordinar cada entrega.</h1>
          <p className="lede">
            Administración organiza el despacho. Cada chofer ve únicamente su ruta y registra
            el inventario de las tiendas que le corresponden.
          </p>
          <div className="feature-row">
            <div><strong>28</strong><span>tiendas conectadas</span></div>
            <div><strong>4</strong><span>rutas coordinadas</span></div>
            <div><strong>13</strong><span>productos contados</span></div>
          </div>
        </div>
        <div className="route-preview" aria-hidden>
          <div className="route-line"><span className="route-dot done" /><span className="route-stem" /><span className="route-dot current" /><span className="route-stem" /><span className="route-dot" /></div>
          <div className="route-labels"><span>Despacho listo</span><span>Ruta en curso</span><span>Inventario actualizado</span></div>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <p className="eyebrow">Bienvenido de vuelta</p>
          <h2>Ingresa a tu portal</h2>
          <p className="muted">Usaremos tu cuenta para mostrarte solo la información que necesitas.</p>
          <LoginForm />
        </div>
        <p className="support-copy">¿Problemas para entrar? Contacta a administración.</p>
      </section>
    </main>
  );
}
