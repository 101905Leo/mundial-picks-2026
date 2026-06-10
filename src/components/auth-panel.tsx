"use client";

import { FormEvent, useState } from "react";
import type { User } from "@/components/types";

type Props = {
  onAuth: (user: User) => void;
};

export function AuthPanel({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "login" ? { phone: payload.phone, password: payload.password } : payload),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo completar la accion");
      return;
    }

    onAuth(data.user);
  }

  return (
    <section className="panel">
      <div className="section-title">
        <h2>{mode === "login" ? "Iniciar sesion" : "Crear cuenta"}</h2>
        <div className="tabs">
          <button className={`tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>
            Entrar
          </button>
          <button className={`tab ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")}>
            Registro
          </button>
        </div>
      </div>
      <form className="form" onSubmit={submit}>
        {mode === "register" ? (
          <div className="form-row">
            <label htmlFor="name">Nombre o alias</label>
            <input id="name" name="name" minLength={2} placeholder="Tu nombre o alias" required />
          </div>
        ) : null}
        <div className="form-row">
          <label htmlFor="phone">{mode === "register" ? "Numero de WhatsApp" : "Numero de WhatsApp"}</label>
          <input id="phone" name="phone" inputMode="tel" placeholder="3008588571 o +573008588571" required />
          {mode === "register" ? (
            <small>Debe ser tu WhatsApp real. Luego podremos verificarlo con un código.</small>
          ) : null}
        </div>
        <div className="form-row">
          <label htmlFor="password">Contrasena</label>
          <input id="password" name="password" type="password" minLength={6} required />
        </div>
        {message ? <div className="notice">{message}</div> : null}
        <button className="button primary" type="submit">
          {mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>
    </section>
  );
}
