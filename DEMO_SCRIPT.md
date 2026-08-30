# Guion del video demo — 2:45

Un video de 2-3 minutos, requisito obligatorio. Está escrito para grabarse **en vivo
sobre la testnet**, porque el argumento central del producto es que nada aquí está
simulado — y una demo que se nota grabada contra datos falsos destruye justo eso.

**Idioma:** narración en inglés, interfaz en español con el toggle visible. Eso
demuestra el bilingüismo sin gastar tiempo en explicarlo.

---

## Antes de grabar

- [ ] Wallet con **STT** (testnet.somnia.network) y **tUSDC** (botón de la app).
- [ ] Comprobar que hay una ventana de **5m** abierta con al menos 60 s por delante.
      Es el reloj de toda la demo: si no hay, esperar al siguiente ciclo.
- [ ] Tener una **segunda pestaña** ya en el perfil de una wallet con historial largo
      (por ejemplo la que tiene 144 palpitos resueltos). Evita esperar una carga en cámara.
- [ ] Tener el **explorador del oráculo** abierto en otra pestaña, en una pregunta ya
      resuelta. Es el plano que cierra el argumento.
- [ ] Cerrar notificaciones del sistema. Grabar a 1280×800.
- [ ] **Plan B:** si la testnet se cae a mitad, el muro sigue mostrando historial. Grabar
      la parte de reputación primero y la de operar después; se montan en cualquier orden.

---

## 0:00–0:20 · El problema

**Plano:** crypto-Twitter en una pestaña, un hilo cualquiera de "I called it".

> "Everyone in crypto says they called it. Nobody proves it. Screenshots are
> editable, threads get deleted, and the loudest voice wins by default."

**Corte a Palpito, muro cargado, palpitos con cuenta regresiva corriendo.**

> "Palpito is a feed where saying it and proving it are the same action."

---

## 0:20–0:50 · Decirlo con palabras

**Plano:** el campo de texto. Escribir despacio, que se lea:

```
no creo que el bitcoin suba en los próximos 5 minutos
```

Pulsar Convertir. **Se rellenan solos: BTC · 5m · Baja.**

> "You write it the way you'd say it. It resolves to a window that is open right
> now — and it reads the negation: 'I don't think it rises' is a call that it falls."

**Sin cortar**, escribir:

```
quien gana el clasico del domingo
```

> "And when it can't be done, it says so."

**Plano del rechazo:** "En DreamDEX solo hay ventanas de precio de bitcoin y
ethereum... No hay deportes, ni elecciones, ni precios objetivo."

> "That honesty is the product. This venue is BTC and ETH price windows, and
> pretending otherwise would be the easiest lie to tell."

---

## 0:50–1:25 · Hacerlo real

**Plano:** volver al palpito de BTC 5m Baja. Señalar el precio.

> "The price comes from the pool's order book, not from the last trade. We found
> windows that last-traded at 42% with a live ask at 4% — quoting the last trade
> would show a number nobody is offering."

Elegir 5 tUSDC. Pulsar **Hacer palpito**. **Firmar en MetaMask, en cámara.**

> "One signature. Fully collateralised, no leverage — the stake is the maximum loss."

**Plano:** la confirmación con el enlace a la transacción, y el palpito **apareciendo
en el muro** con su cuenta regresiva.

---

## 1:25–1:50 · Lo social ES la liquidez

**Plano:** hover sobre **Voy en contra** en la tarjeta de otra persona.

> "Here's the part that only works on this venue. Event contracts settle a crossing
> of Buy-Up against Buy-Down by minting a fresh pair — two opposite-side buyers
> need no seller and no market maker."

**Señalar una tarjeta con el sello `◇ creó liquidez`.**

> "So disagreeing with someone here doesn't consume liquidity. It *is* the
> liquidity. That's a strange property for an exchange and a completely ordinary
> one for a social feed."

---

## 1:50–2:15 · Salir, o esperar

**Plano:** la sección de posiciones abiertas, con el precio de salida en vivo.

> "You don't have to wait for the result. Sell out at whatever the book pays right
> now — sized from the on-chain balance, because you can only sell what you hold."

**Plano:** el aviso dorado de ganancias sin reclamar.

> "And when you win, the money doesn't come back on its own. A settled market pays
> only when someone asks. While building this we found one wallet sitting on
> 5,854 tUSDC it never claimed. One signature sweeps them all."

---

## 2:15–2:45 · La prueba, y el cierre

**Plano:** una tarjeta liquidada. Pulsar **Ver por qué**.

**Corte al explorador del oráculo:** la pregunta, las fuentes de precio, la mediana,
el bloque.

> "This is the whole argument. Every settled call links to its own resolution —
> the price sources, the median, the block. Not our word for it. Our leaderboard
> is computed from this, not from screenshots, and there is no database behind it:
> anyone can recompute it."

**Plano:** el ranking. Luego el toggle ES/EN, un clic, la interfaz cambia.

> "Spanish first, English second — the on-ramp we care about. It's live on testnet,
> the repo is public. Palpito: say it, and let the chain settle it."

---

## Notas de montaje

- **No aceleres las firmas.** Que se vea MetaMask abrirse y confirmarse es la prueba
  de que no está simulado. Es el plano más valioso del video.
- Si un IOC no cruza y llena cero, **déjalo**. La app lo dice con claridad
  ("Nadie tomó el otro lado") y eso demuestra manejo honesto de errores. Vale más
  que una toma perfecta.
- Subtítulos quemados en inglés: los jueces no son hispanohablantes.
- Última toma en negro con la URL y el repo, 3 segundos.
