"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@/components/types";

type Props = {
  initialMode?: "login" | "register";
  onAuth: (user: User, options?: { joinedLeague?: boolean }) => void;
};

export function AuthPanel({ initialMode = "login", onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [rememberLogin, setRememberLogin] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const savedPhone = window.localStorage.getItem("mundial_picks_phone") ?? "";
    if (savedPhone) {
      setPhone(savedPhone);
      setRememberLogin(true);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      password: String(formData.get("password") ?? ""),
      inviteCode: String(formData.get("inviteCode") ?? "").trim(),
    };

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "login"
          ? { phone: payload.phone, password: payload.password }
          : payload,
      ),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo completar la accion");
      return;
    }

    if (mode === "login") {
      if (rememberLogin) {
        window.localStorage.setItem("mundial_picks_phone", data.user.phone);
      } else {
        window.localStorage.removeItem("mundial_picks_phone");
      }
    }

    onAuth(data.user, { joinedLeague: Boolean(data.joinedLeague) });
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
            <label htmlFor="name">Nombre o apodo</label>
            <input id="name" name="name" minLength={2} placeholder="Tu nombre o apodo" required />
          </div>
        ) : null}
        <div className="form-row">
          <label htmlFor="phone">{mode === "register" ? "Numero de WhatsApp" : "Numero de WhatsApp"}</label>
          <input
            autoComplete="tel"
            id="phone"
            inputMode="tel"
            maxLength={18}
            name="phone"
            pattern="([+]57[ -]?)?3[0-9 -]{9,13}"
            placeholder="300 000 0000"
            required
            title="Ingresa un celular colombiano valido. Ejemplo: 300 000 0000"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          {mode === "register" ? (
            <small>Debe ser un celular colombiano real que empiece por 3. Ejemplo: 300 000 0000.</small>
          ) : null}
        </div>
        <div className="form-row">
          <label htmlFor="password">Contrasena</label>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            id="password"
            name="password"
            type="password"
            minLength={6}
            required
          />
        </div>
        {mode === "register" ? (
          <div className="form-row">
            <label htmlFor="inviteCode">Codigo de sala</label>
            <input id="inviteCode" name="inviteCode" maxLength={16} placeholder="Opcional: MP20ABCD" />
            <small>Si ingresas un codigo, después entrarás automáticamente a esa sala.</small>
          </div>
        ) : null}
        {mode === "login" ? (
          <label className="check-row">
            <input
              checked={rememberLogin}
              onChange={(event) => setRememberLogin(event.target.checked)}
              type="checkbox"
            />
            Recordar mi WhatsApp en este dispositivo
          </label>
        ) : null}
        {message ? <div className="notice">{message}</div> : null}
        <button className="button primary" type="submit">
          {mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>
    </section>
  );
}
