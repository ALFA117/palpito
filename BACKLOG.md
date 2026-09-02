# Backlog — 50 mejoras

Ordenadas por lo que mueve la aguja en los criterios de evaluación del hackathon.
`[x]` hecho, `[~]` en curso, `[!]` necesita una decisión tuya.

---

**Estado:** 40 de 50 hechas, 1 en curso (#47). Lo desplegado vive en
<https://palpito-somnia.vercel.app>, el repo en
<https://github.com/ALFA117/palpito>.

Nota sobre una pasada anterior: a mitad de camino, el propio cursor de
paginación recién agregado (#6) rompió el muro en producción — un `null`
explícito que esta config de Hasura no ignora como se asumió, sino que
rechaza — y quedó así por dos commits hasta encontrarlo. Ya está corregido y
verificado contra el indexer real y un build de producción.

Esta pasada cerró los cinco ítems que habían quedado sin intentar (17, 18,
20, 32, 40). Lo que queda son ocho `[!]` que necesitan una decisión tuya
(1, 33, 44, 45, 46, 48, y los ya investigados 41/42), uno `[~]` a medio
tratamiento honesto (47), y uno `[ ]` deliberadamente descartado (28). En
otras palabras: no queda nada más por intentar sin tu input primero.

## ✅ Resuelto: la página no hidrataba en producción

Era **`src/app/loading.tsx`**. Con ese archivo, Next envuelve la ruta en un
Suspense que en build de producción dejaba el subárbol de la página como HTML
inerte: el compositor nunca hidrataba, así que su consulta del libro jamás
arrancaba y los precios se quedaban en puntos suspensivos para siempre. El
`Chrome` (cabecera, idioma) sí hidrataba, que es lo que despistó — parecía un
problema de datos y era de renderizado.

Se encontró instrumentando: un `console.log` en cada render del compositor no
aparecía **ni una vez** en el navegador. Eso lo cerró en un paso.

Dos cosas más salieron de esa investigación:

- **El SDK enruta toda lectura de cadena por WebSocket** y lanza
  `NotConfiguredError` sin `wsRpcUrl` (una URL HTTP en la config del chain no
  basta). Ese camino funciona desde Node y no completa desde el navegador.
- Por eso la lectura del libro ya **no pasa por el SDK**: es un `eth_call`
  directo con viem contra `getBookLevels`. Verificado idéntico al SDK en tres
  pools vivos, ~200 ms.

**Todas las lecturas ya salen del SDK** y usan viem sobre HTTP: el libro
(`getBookLevels`), el estado del mercado (`markets` del módulo + `status`) y los
balances de posiciones (ERC-6909 `balanceOf`). Verificadas idénticas al SDK
contra datos reales, y ahora `getMarketState` **lanza** donde el SDK devolvía un
objeto hueco.

**Las escrituras también migraron.** `placeBinaryOrder` y `redeemMany` se
codifican y envían con viem y el wallet client, incluidas las autorizaciones
(allowance ERC-20 para comprar, operator ERC-6909 para vender y para reclamar).
El calldata se comparó contra `buildPlaceOrder` del SDK: **idéntico byte a byte
en los cuatro lados**. `@somnia-chain/markets-sdk` ya no es dependencia del
proyecto.

Pendiente menor: recuperar el esqueleto de carga de otra forma (la #26 vuelve a
estar abierta).

## A. Correctitud y riesgos reales

1. `[!]` **Choque de nombre.** `palpito.vercel.app` ya es de otro producto del mismo rubro
   ("Pálpito · Trade real-world events"). Decidir: mantener el nombre, o renombrar.
2. `[x]` Sin error boundary: un error de cliente deja la página en blanco.
3. `[x]` Las ganancias liquidadas **nunca se reclaman**. La doc es explícita: un mercado
   liquidado paga solo cuando alguien lo pide. Hoy el dinero de un usuario que acierta
   se queda ahí.
4. `[x]` Tras hacer un palpito / sumarse / vender, ni el muro ni las posiciones se refrescan.
5. `[x]` `resolveVenueId` cacheaba en memoria de módulo: en serverless esa variable
   arranca en blanco en cada cold start, así que no protegía nada que `gql`'s
   `revalidate: 60` no cubriera ya de forma persistente. Se quitó el caché
   redundante.
6. `[x]` El muro cortaba en 40 fills, sin paginación. `recentCalls` ahora acepta
   un cursor `before` sobre `timestamp` (no un offset: un offset se corre bajo
   un feed al que le siguen llegando fills nuevos). Un botón "Ver más" pide la
   siguiente página a `/api/calls`.
7. `[x]` Cambio de cuenta en la wallet a mitad de sesión: verificado, no hacía
   falta código nuevo. `address` sale de `useAccount()` de wagmi en cada
   componente y entra a las query keys de react-query y a los args de
   `useReadContract`, así que un cambio de cuenta ya dispara refetch de balance
   y posiciones por sí solo.
8. `[x]` Sin reintento ante fallo transitorio del indexer. `gql()` ahora reintenta
   una vez, con 300ms de espera, ante un 5xx o un fallo de red — no ante un
   error de GraphQL real.
9. `[x]` `useCollateralBalance` formatea con locale `undefined`; inconsistente con `money()`.
    Ya recibe el locale de la app y pasa por `money()`.
10. `[x]` Los alias de wallet (`zorroa1b`) pueden colisionar; sin desambiguación.
    No se puede eliminar la colisión así — se amplió el sufijo de 3 a 4
    caracteres hex (~16x menos frecuente) y el disambiguador real sigue siendo
    la dirección, que ya se muestra junto al alias en todos los sitios donde
    aparece (`CallCard`, `BoardView`, `ProfileView`).
11. `[x]` El perfil cargaba hasta 200 palpitos y los renderizaba todos de una.
    El fetch se queda como está — `buildStanding` necesita el historial
    completo para un hit rate correcto, así que no había una lectura más
    barata que hacer — pero ahora solo se muestran 40 tarjetas a la vez, con
    "Ver más" revelando el resto de datos que ya están en la página. Sin
    round-trip extra: a diferencia del muro, aquí no hace falta.
12. `[x]` El precio de salida usaba solo la cima del libro. `getBook` ahora lee
    10 niveles por lado y `estimateProceeds` camina el libro para el tamaño
    real de la posición, en vez de cotizar todo el tamaño al mejor precio.
13. `[x]` `placeCall` no distinguía el fallo por allowance insuficiente de
    cualquier otro. La aprobación (allowance ERC-20 u operator ERC-6909) ahora
    revisa el receipt y lanza `APPROVAL_FAILED` si se revirtió — antes ese
    revert era invisible y el fallo posterior de la orden, ya sin permiso,
    salía como el mismo "no se pudo" genérico que cualquier otra cosa. Nuevo
    código de error `approval` en los tres flujos de escritura (hacer, sumarse,
    vender).
14. `[x]` Sin validación visible de longitud en el campo de texto. `maxLength=200` más un
    contador que aparece en los últimos 40 caracteres. La ruta ya recortaba en 500 sin
    decírselo a nadie, que es la peor versión de un límite.
15. `[x]` `parseHunch` mapeaba "hoy" y "mañana" a la misma ventana de 24h. Se
    quitó "mañana"/"tomorrow" del patrón: ninguna ventana del venue representa
    honestamente "el día calendario siguiente" — todas son duraciones rodantes
    desde ahora, tope 24h — así que fingir que "mañana" resuelve a la misma
    ventana que "hoy" afirmaba algo que el venue no puede cumplir.

## B. Producto que falta

16. `[x]` Sin metadatos sociales: al compartir el link no aparece nada.
17. `[x]` Sin página por mercado (enlace profundo a una ventana). Nueva ruta
    `/m/[marketId]`, con sus propias `marketById`/`callsByMarket` en el
    indexer — verificadas contra Hasura en vivo antes de darlas por buenas,
    después del susto de la #6. Enlazada desde el badge de ventana de cada
    `CallCard` y desde las tarjetas del ticker "en vivo" del muro.
18. `[x]` Sin tarjeta compartible de un palpito resuelto (la prueba, como
    imagen). `next/og`'s `ImageResponse` en `/api/og/[callId]`, más
    `callById` nuevo en el indexer y una página `/c/[callId]` cuyo
    `generateMetadata` apunta el `og:image` ahí — así el link, no la imagen,
    es lo que se comparte. Botón "Compartir" en `CallCard`, solo cuando la
    ventana ya se resolvió. Verificado con un `next start` real contra un
    fill resuelto de verdad: la imagen renderiza y el metadata resuelve.
19. `[x]` Las posiciones abiertas solo salían en el muro, no en tu perfil.
    Seguían apareciendo mezcladas cronológicamente en la lista de "palpitos"
    de cualquier perfil, pero enterradas si el historial era largo. Ahora hay
    una sección "Abierto ahora" aparte, arriba, visible para cualquiera que
    vea ese perfil — no es una vista nueva de datos nuevos, es la misma data
    puesta donde se ve.
20. `[x]` Sin aviso cuando tu ventana se resuelve. Toast in-app: compara el
    poll anterior de `usePositions` contra el actual, pero no basta con que
    una posición desaparezca — vender también la hace desaparecer, y
    `useSell` ya invalida esa misma query al vender. El desambiguador real es
    el reloj: `openPositions` solo devuelve ventanas sin vencer, así que una
    fila que desaparece con su `expiry` ya pasado se resolvió; si el
    `expiry` seguía en el futuro, se vendió. Enlaza a la página de mercado
    nueva (#17). No probado con una wallet real sosteniendo una posición
    hasta que resuelva dentro de esta sesión — verificado por lectura del
    código y build de producción, no en vivo.
21. `[x]` Sin filtros en el muro (por activo o ventana).
22. `[x]` Ranking solo histórico total; falta "últimas 24h" y "esta semana".
23. `[x]` Sin métrica de calibración en el perfil (prometida en el pivote: ¿cuando dices "seguro" aciertas el 80%?).
24. `[x]` Racha sin implementar (la clave i18n existe pero no se usa).
25. `[x]` Sin guía cuando el venue no tiene ventanas abiertas. Verificado: ya
    existía — `CallComposer` muestra un `Empty` con `noLiveWindows` /
    `noLiveWindowsWhy` cuando `markets.length === 0`. No hacía falta código
    nuevo.

## C. Experiencia y diseño

26. `[x]` Resuelto sin `loading.tsx`. Como todas las rutas son dinámicas, el SSR ya bloquea
    hasta tener datos: no hay primer pintado vacío que rellenar con esqueletos. Lo que
    faltaba era acuse de recibo al navegar, y eso lo da `useLinkStatus` (`NavLink` en
    `RouteProgress.tsx`) con una barra fija arriba — sin límite de Suspense, que era
    justo lo que rompía la hidratación.
27. `[x]` La cuenta regresiva no cambia de urgencia bajo 30 s.
28. `[ ]` Las tarjetas no muestran cómo va esa predicción ahora. Descartado por ahora:
    exigiría leer el libro por cada tarjeta (40 `eth_call` por tick) y el único dato
    gratis, `lastPrice`, es justo el que decidimos no usar por engañoso.
29. `[x]` En móvil no había acceso fijo a "hacer un palpito" al bajar por el
    muro. `main` ya reservaba `pb-28` bajo el contenido — parece que estaba
    pensado para esto y nunca se construyó. Botón flotante, solo en móvil, que
    hace scroll suave de vuelta al compositor.
30. `[x]` La explicación de mint-a-pair va en `title`: invisible en táctil. Peor: los
    botones que la llevaban solo salen con wallet conectada, así que un jurado sin
    extensión nunca la veía. Ahora es una línea fija bajo el par Sube/Baja del
    compositor, más un desplegable “?” junto a “Voy en contra”.
31. `[x]` `focus-visible` verificado con teclado en input, botón y enlace: anillo dorado
    de 2px en todos. El `outline-none` del campo de texto no gana porque la regla global
    va sin capa y las utilidades de Tailwind van en `@layer`.
32. `[x]` Sin estado de "recién llegado": no hay onboarding de 3 pasos.
    Tarjeta dorada arriba del muro, gated por un flag en `localStorage`
    (no una cuenta: solo recuerda ese navegador), con los tres pasos y un
    botón para cerrarla. No aparece en el HTML de servidor a propósito —
    `localStorage` no existe en SSR, así que se decide después de montar, y
    el primer render del cliente tiene que coincidir con el del servidor
    (nada) o React tira un mismatch de hidratación.
33. `[!]` El wordmark es solo texto; falta identidad más marcada. Necesita tu
    decisión: esto es gusto de marca, no un bug — cualquier marca que yo
    inventara sin dirección tuya sería ruido, no identidad.
34. `[x]` Stagger de entrada en el muro, con tope a las 8 primeras tarjetas.
35. `[x]` Sin modo de contraste alto. Respeta `prefers-contrast: more` del
    sistema operativo automáticamente, igual que ya se respeta
    `prefers-reduced-motion` — sin toggle nuevo en la app, porque la señal ya
    existe en el nivel que debería tenerla.

## D. Entregables del hackathon

36. `[x]` Guion del video de 2-3 minutos, con planos y tiempos.
37. `[x]` Deck de presentación.
38. `[x]` Informe de feedback del SDK como documento aparte.
39. `[x]` Capturas en el README: muro, calibración, ranking y recibo del oráculo,
    tomadas con Chrome headless contra el despliegue en vivo (`docs/img/`).
    Falta una móvil: headless no aplica bien el viewport de teléfono y sale
    cortada, aunque en navegador real encaja a 375 px.
40. `[x]` Datos de respaldo para que la demo no dependa de que haya ventanas
    vivas. `npm run snapshot` (`scripts/snapshot-demo.mjs`) escribe una
    instantánea real y fechada de los mercados y palpitos recientes del
    venue a `docs/demo-snapshot.json` — deliberadamente **no** es algo que
    la app misma lea. Dejar que alguien firme una transacción real contra un
    mercado ya vencido en el fallback sería peor que un "no hay ventanas
    abiertas" honesto: fallaría en cadena, o peor, parecería que funcionó.
    Así que esto es solo para narrar encima en vivo si el pitch cae justo en
    un hueco entre ventanas — nunca se hace pasar por dato en vivo. Corrida
    contra el venue real: 10 mercados vivos, 40 palpitos recientes,
    capturados 2026-09-02.

## E. Profundidad técnica (los jueces escribieron el SDK)

41. `[!]` Usar los hooks de tiempo real del SDK. **Intentado y no funciona**: el tail
    nunca arranca (`useIsTailing()` siempre false, sin error). Documentado en
    FEEDBACK.md #10. Reintentar si el SDK lo arregla.
42. `[!]` Muro en vivo: **retirado**. Ni con los hooks del SDK ni con sondeo propio.
    Al investigarlo salió un fallo mayor, abajo.
43. `[x]` Mostrar volumen por mercado (receta "Read a market's volume").
44. `[!]` Mini-visualización del grafo del oráculo en línea, no solo el
    enlace. `oracleGraphUrl` apunta a una vista HTML
    (`?view=graph`) sin API JSON documentada que se conozca — construir una
    visualización propia sin adivinarle la forma a un endpoint no documentado
    de un tercero es el tipo de riesgo que este pase ya se llevó un
    susto con. Necesita confirmar si el oráculo expone los datos en algún
    otro formato antes de intentarlo.
45. `[!]` Session keys / operators para una UX sin fricción de firma. Grande y
    sensible: toca directamente el camino del dinero (autorizaciones,
    custodia de la sesión). No es algo para improvisar sin una revisión de
    seguridad aparte.
46. `[!]` Atribución de builder fee (`approveBuilder`): la historia de
    monetización. Necesita tu decisión — cuántos bps y a qué dirección — antes
    de que el código tenga sentido escribirlo.
47. `[~]` Distinguir en el muro los cuatro caminos de cruce, no solo
    mint-a-pair. `Call.kind` ahora trae el nombre crudo del indexer y
    `CallCard` lo muestra como etiqueta cuando no es `MINT_A_PAIR` — pero solo
    ese valor tiene traducción y explicación propia; los otros tres se
    muestran tal cual salen del indexer en vez de adivinarles una etiqueta.
    Falta la lista exacta de los cuatro nombres, documentada en el SDK, para
    darles el mismo tratamiento.
48. `[!]` Conciencia multi-venue en la UI. `resolveVenueId` ya elige el venue
    con ventanas vivas automáticamente, así que la app funciona — pero una UI
    que de verdad muestre y deje elegir entre venues es una función nueva, no
    un ajuste, y cambia lo que la app promete mostrar. Necesita tu decisión
    sobre si vale la pena para lo que queda del venue de prueba, antes de
    construirla.
49. `[x]` Banco de pruebas de verdad en vez de scripts desechables. Vitest,
    52 pruebas sobre la lógica pura: `parseHunch` (incluida la trampa de
    "mañana"/"hoy" recién corregida), el scoring (`outcomeOf`, `payoutOf`,
    `buildStanding` — hit rate, pnl, racha, calibración), `toTickPrice`/
    `toLotSize` (el grid de precio y tamaño) y `estimateProceeds` (el libro
    caminado). `npm test`. Ningún mock del venue: todo corre contra funciones
    puras con datos sintéticos, nada golpea la cadena ni el indexer.
50. `[x]` Medir y mostrar la latencia de liquidación de Somnia. Cronometrado
    desde que la wallet devuelve el hash (no desde antes de la firma, para no
    contra la lentitud del usuario mirando su wallet como si fuera lentitud de
    la cadena) hasta el receipt minado. Se muestra en hacer/sumarse/vender/
    reclamar.
