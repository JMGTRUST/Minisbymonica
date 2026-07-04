"use server";

import { redirect } from "next/navigation";
import { clearSession, createSession, safeEqual, type UserRole } from "@/lib/session";

export type LoginState = {
  error?: string;
};

type ConfiguredUser = {
  email: string;
  name: string;
  password: string;
  role: UserRole;
};

function configuredUsers(): ConfiguredUser[] {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const driverEmail = process.env.CHOFER_EMAIL;
  const driverPassword = process.env.CHOFER_PASSWORD;

  if (!adminEmail || !adminPassword || !driverEmail || !driverPassword) return [];

  return [
    { email: adminEmail, name: "Administración", password: adminPassword, role: "admin" },
    {
      email: driverEmail,
      name: process.env.CHOFER_NAME || "Chofer piloto",
      password: driverPassword,
      role: "chofer",
    },
  ];
}

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const users = configuredUsers();

  if (!users.length) {
    return { error: "El acceso todavía no está configurado en Render." };
  }

  const user = users.find((candidate) => candidate.email.toLowerCase() === email);
  if (!user || !safeEqual(password, user.password)) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return { error: "Correo o contraseña incorrectos." };
  }

  await createSession({ email: user.email, name: user.name, role: user.role });
  redirect(user.role === "admin" ? "/admin" : "/chofer");
}

export async function logout() {
  await clearSession();
  redirect("/");
}
