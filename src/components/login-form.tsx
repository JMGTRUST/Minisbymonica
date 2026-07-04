"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="login-form">
      <label>
        Correo electrónico
        <input name="email" type="email" autoComplete="username" required placeholder="nombre@empresa.com" />
      </label>
      <label>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required placeholder="••••••••••••" />
      </label>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? "Ingresando…" : "Ingresar al sistema"}
      </button>
      <p className="privacy-note">Acceso privado para el equipo de Minis by Mónica.</p>
    </form>
  );
}
