"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { User } from "@/components/types";

type Props = {
  initialMode?: "login" | "register";
  initialPhone?: string;
  onAuth: (user: User, options?: { joinedLeague?: boolean }) => void;
};

function normalizeInitialPhone(value = "") {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0057")) digits = digits.slice(4);
  if (digits.startsWith("57") && digits.length > 10) digits = digits.slice(2);
  return /^3\d{9}$/.test(digits) ? digits : "";
}

function formatPhone(value: string) {
  return value.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3");
}

export function AuthPanel({ initialMode = "login", initialPhone = "", onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [quickLoginPhone, setQuickLoginPhone] = useState("");
  const [quickPin, setQuickPin] = useState("");
  const [rememberLogin, setRememberLogin] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const phoneFromPage = normalizeInitialPhone(initialPhone);
    if (initialMode === "register") {
      setPhone(phoneFromPage);
      setQuickLoginPhone("");
      setQuickPin("");
      return;
    }

    if (phoneFromPage) {
      setPhone(phoneFromPage);
      setQuickLoginPhone(phoneFromPage);
      setQuickPin("");
      return;
    }

    setQuickLoginPhone("");
    setQuickPin("");
    const savedPhone = window.localStorage.getItem("mundial_picks_phone") ?? "";
    if (savedPhone) {
      setPhone(savedPhone);
      setRememberLogin(true);
    }
  }, [initialMode, initialPhone]);

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

  async function submitQuickLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (quickPin.length < 4) {
      setMessage("Escribe los 4 números de tu PIN.");
      return;
    }

    await submit(event);
  }

  function addPinDigit(digit: string) {
    setMessage("");
    setQuickPin((current) => (current.length >= 4 ? current : `${current}${digit}`));
  }

  function removePinDigit() {
    setMessage("");
    setQuickPin((current) => current.slice(0, -1));
  }

  if (mode === "login" && quickLoginPhone) {
    return (
      <section className="quick-pin-panel">
        <button
          className="quick-pin-back"
          onClick={() => {
            window.location.href = "/";
          }}
          type="button"
        >
          ‹ <span>Cambiar número</span>
        </button>

        <div className="quick-pin-header">
          <h2>Escribe tu clave</h2>
          <p>WhatsApp reconocido: +57 {formatPhone(quickLoginPhone)}</p>
        </div>

        <form className="quick-pin-form" onSubmit={submitQuickLogin}>
          <input name="phone" type="hidden" value={quickLoginPhone} />
          <input name="password" type="hidden" value={quickPin} />
          <div className="quick-pin-boxes" aria-label="PIN de 4 números">
            {[0, 1, 2, 3].map((index) => (
              <span
                aria-label={quickPin.length > index ? "Número escrito" : "Número pendiente"}
                className={`quick-pin-box ${quickPin.length > index ? "is-filled" : ""}`}
                key={index}
              />
            ))}
          </div>

          <p className="quick-pin-helper">No dudamos que seas tú, pero es mejor confirmar.</p>

          <aside className="quick-pin-promo" aria-label="Promoción de Mundial Picks Arena">
            <strong>Crea tu propia sala</strong>
            <span>Invita a tu familia, hagan picks y sigan el ranking.</span>
            <Link href="/planes">Crear sala</Link>
          </aside>

          <div className="quick-pin-keypad" aria-label="Teclado numérico">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button key={digit} onClick={() => addPinDigit(digit)} type="button">
                {digit}
              </button>
            ))}
            <span className="quick-pin-keypad-spacer" aria-hidden="true" />
            <button onClick={() => addPinDigit("0")} type="button">
              0
            </button>
            <button aria-label="Borrar" className="quick-pin-delete" onClick={removePinDigit} type="button">
              ×
            </button>
          </div>

          {message ? <div className="notice">{message}</div> : null}

          <button className="button primary quick-pin-submit" type="submit">
            Entrar
          </button>

          <button
            className="quick-pin-link"
            onClick={() => {
              setMessage("Pídele al administrador de tu sala que te asigne un nuevo PIN.");
            }}
            type="button"
          >
            Olvidé mi clave
          </button>

        </form>
      </section>
    );
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
            pattern="(\+57[ \-]?)?3[0-9 \-]{9,13}"
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
          <label htmlFor="password">{mode === "register" ? "PIN de 4 números" : "PIN"}</label>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            id="password"
            inputMode={mode === "register" ? "numeric" : "text"}
            maxLength={mode === "register" ? 4 : undefined}
            name="password"
            pattern={mode === "register" ? "\\d{4}" : undefined}
            type="password"
            required
            title={mode === "register" ? "El PIN debe tener exactamente 4 números" : "Ingresa tu PIN de 4 números"}
          />
          {mode === "register" ? (
            <small>Usa 4 números fáciles de recordar. No compartas este PIN.</small>
          ) : null}
        </div>
        {mode === "register" ? (
          <div className="form-row">
            <label htmlFor="inviteCode">Codigo de sala</label>
            <input
              id="inviteCode"
              maxLength={16}
              minLength={4}
              name="inviteCode"
              pattern="\\S{4,16}"
              placeholder="MP20ABCD"
              required
              title="Ingresa el código de sala que recibiste"
            />
            <small>Necesitas el codigo de tu sala para completar el registro.</small>
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
