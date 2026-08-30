# Guion del video demo — 2:50

Requisito obligatorio del hackathon (2-3 min). Escrito para grabarse **en vivo
sobre la testnet**: el argumento central del producto es que nada aquí está
simulado, y una demo que huele a datos falsos destruye justo eso.

- **URL:** <https://palpito-somnia.vercel.app>
- **Narración** en inglés, **interfaz en español** con el toggle a la vista. Eso
  demuestra el bilingüismo sin gastar un segundo en explicarlo.
- **Grabar a 1280×800.** Es donde la app respira mejor.

---

## Antes de grabar

- [ ] Wallet con **STT** para gas (<https://testnet.somnia.network>) y **tUSDC**
      (el botón de la app). El STT va primero: mintear tUSDC es una transacción.
- [ ] Una ventana de **5m** abierta con al menos 60 s por delante. Es el reloj de
      toda la demo. Si no hay, espera al siguiente ciclo — rueda sola.
- [ ] Pestaña 2 ya abierta en un perfil con historial largo, para la calibración:
      `/u/0xf9b7325262bb00678b83ec52059e7eeb2a4b5f63`
- [ ] Pestaña 3 en el explorador del oráculo, en una pregunta ya resuelta.
- [ ] Notificaciones del sistema cerradas.
- [ ] **Plan B:** si la testnet se cae a mitad, el muro sigue mostrando historial.
      Graba la parte de reputación primero y la de operar después; se montan en
      cualquier orden.

**Beat condicional:** el aviso de *ganancias sin reclamar* solo aparece si tu
wallet ha ganado algo ya liquidado. Si no lo tienes, sáltalo — está marcado
abajo como opcional y el video funciona sin él.

---

## 0:00–0:18 · El problema

**Plano:** crypto-Twitter, un hilo cualquiera de "I called it".

> "Everyone in crypto says they called it. Nobody proves it. Screenshots are
> editable, threads get deleted, and the loudest voice wins by default."

**Corte a Palpito**, muro cargado, cuentas regresivas corriendo.

> "Palpito is a feed where saying it and proving it are the same action."

---

## 0:18–0:45 · Decirlo con palabras

**Plano:** el campo de texto. Escribe despacio, que se lea:

```
no creo que el bitcoin suba en los próximos 5 minutos
```

Pulsa **Convertir**. Se rellenan solos: **BTC · 5m · Baja**.

> "You write it the way you'd say it, and it resolves to a window that is open
> right now. It reads the negation too: 'I don't think it rises' is a call that
> it falls."

**Sin cortar**, escribe:

```
quien gana el clasico del domingo
```

> "And when it can't be done, it says so."

**Plano del rechazo:** *"En DreamDEX solo hay ventanas de precio de bitcoin y
ethereum… No hay deportes, ni elecciones, ni precios objetivo."*

> "That honesty is the product. This venue is BTC and ETH price windows, and
> pretending otherwise would have been the easiest lie to tell."

---

## 0:45–1:15 · Hacerlo real

**Plano:** vuelve al palpito de BTC 5m Baja. Señala el porcentaje.

> "The price comes from the pool's live order book, not from the last trade. We
> measured a window that last-traded at 42% with a real ask resting at 4% —
> quoting the last trade shows a number nobody is offering."

Elige **5 tUSDC**. Pulsa **Hacer palpito**. **Firma en MetaMask, en cámara.**

> "One signature. Fully collateralised, no leverage — your stake is the most you
> can lose."

**Plano:** la confirmación con el enlace a la transacción, y el palpito
**apareciendo en el muro** con su cuenta regresiva.

---

## 1:15–1:38 · Lo social ES la liquidez

**Plano:** toca el sello **◇ creó liquidez** en una tarjeta. Se abre la
explicación.

> "Here's the part that only works on this venue. Event contracts settle a
> crossing of Buy-Up against Buy-Down by minting a fresh pair — two opposite-side
> buyers need no seller and no market maker."

**Plano:** los botones **Me sumo** y **Voy en contra** de otra tarjeta viva.

> "So disagreeing with someone here doesn't consume liquidity. It *is* the
> liquidity. That's a strange property for an exchange and a completely ordinary
> one for a social feed."

---

## 1:38–2:00 · Salir, y cobrar

**Plano:** tu posición abierta, con el precio de salida en vivo.

> "You don't have to wait for the result. Sell out at whatever the book pays right
> now — sized from your on-chain balance, because you can only sell what you hold."

**(Opcional, solo si lo tienes)** Plano del aviso dorado de ganancias sin reclamar.

> "And when you win, the money doesn't come back on its own. A settled market pays
> only when someone asks. Building this, we found a wallet sitting on 5,854 tUSDC
> it never claimed. One signature sweeps them all."

---

## 2:00–2:30 · La prueba

**Plano:** pestaña 2, el perfil con las bandas de calibración.

> "A hit rate tells you almost nothing. The price you pay *is* your stated
> confidence — so we put the claim next to the outcome. This trader is well
> calibrated at 19, 38 and 50 percent… and then says 87 and is right 15 percent of
> the time. That's the number that separates someone who knows from someone who
> got lucky, and a single percentage buries it."

**Plano:** una tarjeta liquidada. Pulsa **Ver por qué**. Corte a la pestaña 3:
la pregunta, las fuentes, la mediana, el bloque.

> "And none of it is our word for it. Every settled call links to its own
> resolution on the oracle. Our leaderboard is computed from that, with no
> database behind it — anyone can recompute the same numbers."

---

## 2:30–2:50 · Cierre

**Plano:** el ranking, con las pestañas de 24 h / 7 días / histórico. Luego el
toggle **ES/EN**, un clic, la interfaz cambia entera.

> "Spanish first, English second — that's the on-ramp we care about. It's live on
> Somnia testnet, the repo is public, and every chain call in it is plain viem,
> because the SDK's own transport doesn't work in a browser. That's in our
> feedback report too."

**Última toma**, 3 segundos en negro:

```
palpito-somnia.vercel.app
github.com/ALFA117/palpito
```

---

## Notas de montaje

- **No aceleres las firmas.** Ver MetaMask abrirse y confirmarse es la prueba de
  que nada está simulado. Es el plano más valioso del video.
- Si una orden no cruza y llena cero, **déjalo en el corte**. La app lo dice con
  claridad ("Nadie tomó el otro lado"), y manejar bien un fallo en vivo convence
  más que una toma perfecta.
- Subtítulos quemados en inglés: los jueces no son hispanohablantes.
- Si te pasas de 3:00, el recorte es el beat de "salir y cobrar" (1:38–2:00). La
  calibración y el oráculo no se tocan — son el argumento.
