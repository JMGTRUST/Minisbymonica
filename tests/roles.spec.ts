import { expect, test } from "@playwright/test";

test("shows the landing page and rejects invalid credentials", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ingresa a tu portal" })).toBeVisible();
  await page.getByLabel("Correo electrónico").fill("nadie@test.local");
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Ingresar al sistema" }).click();
  await expect(page.locator(".form-error")).toContainText("incorrectos");
});

test("protected portals redirect signed-out visitors", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await page.goto("/chofer");
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
});

test("admin sees only the admin portal", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@test.local");
  await page.getByLabel("Contraseña").fill("admin-test-password");
  await page.getByRole("button", { name: "Ingresar al sistema" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Buenos días, administración" })).toBeVisible();
  await page.goto("/chofer");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
});

test("driver sees only the assigned route portal", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("chofer@test.local");
  await page.getByLabel("Contraseña").fill("chofer-test-password");
  await page.getByRole("button", { name: "Ingresar al sistema" }).click();
  await expect(page).toHaveURL(/\/chofer$/);
  await expect(page.getByRole("heading", { name: "Tu ruta de hoy" })).toBeVisible();
  await expect(page.getByText("Solo ves tu ruta")).toBeVisible();
  await expect(page.getByText("Mercancía en tiendas")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/chofer$/);
});
