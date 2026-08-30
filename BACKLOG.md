# Backlog — 50 mejoras

Ordenadas por lo que mueve la aguja en los criterios de evaluación del hackathon.
`[x]` hecho, `[~]` en curso, `[!]` necesita una decisión tuya.

---

**Estado:** 19 de 50 hechas. Lo desplegado vive en
<https://palpito-somnia.vercel.app>, el repo en
<https://github.com/ALFA117/palpito>.

## ⚠ Fallo abierto, lo primero que hay que mirar

**La cotización del compositor no resuelve en build de producción.** `useBook` →
`getBinaryOrderBook` del SDK se queda pendiente para siempre: sin error, sin
petición fallida, sin nada en consola. En `next dev` funciona; en `next start` y en
Vercel, no. Los precios de Sube/Baja quedan en "…".

Descartado (probado uno por uno, con build de producción local):
`LiveFeed` · el paquete `@somnia-chain/reactivity` · pasarle `wsRpcUrl` al SDK ·
hidratación rota (el toggle de idioma y los radios SÍ responden) · CORS del indexer
(la consulta funciona desde la propia página) · chunks JS que no cargan.

Mitigado, no resuelto: la lectura ahora tiene tiempo límite de 6 s y reintenta, y el
estado sin precio se muestra como "sin precio" en vez de puntos infinitos. **El resto
de la app —muro, ranking, calibración, recibos, perfiles— funciona.**

Siguiente paso sugerido: reemplazar `getBinaryOrderBook` del SDK por un `eth_call`
directo con viem, que es lo único que esa llamada hace por dentro.

## A. Correctitud y riesgos reales

1. `[!]` **Choque de nombre.** `palpito.vercel.app` ya es de otro producto del mismo rubro
   ("Pálpito · Trade real-world events"). Decidir: mantener el nombre, o renombrar.
2. `[x]` Sin error boundary: un error de cliente deja la página en blanco.
3. `[x]` Las ganancias liquidadas **nunca se reclaman**. La doc es explícita: un mercado
   liquidado paga solo cuando alguien lo pide. Hoy el dinero de un usuario que acierta
   se queda ahí.
4. `[x]` Tras hacer un palpito / sumarse / vender, ni el muro ni las posiciones se refrescan.
5. `[ ]` `resolveVenueId` cachea en memoria de módulo: en serverless arranca frío cada vez.
6. `[ ]` El muro corta en 40 fills, sin paginación.
7. `[ ]` Cambio de cuenta en la wallet a mitad de sesión: revisar que balance y posiciones sigan.
8. `[ ]` Sin reintento ante fallo transitorio del indexer.
9. `[ ]` `useCollateralBalance` formatea con locale `undefined`; inconsistente con `money()`.
10. `[ ]` Los alias de wallet (`zorroa1b`) pueden colisionar; sin desambiguación.
11. `[ ]` El perfil carga hasta 200 palpitos sin paginar.
12. `[ ]` El precio de salida usa solo la cima del libro; leer más niveles daría mejor estimación.
13. `[ ]` `placeCall` no distingue el fallo por allowance insuficiente.
14. `[ ]` Sin validación visible de longitud en el campo de texto.
15. `[ ]` `parseHunch` mapea "hoy" y "mañana" a la misma ventana de 24h.

## B. Producto que falta

16. `[x]` Sin metadatos sociales: al compartir el link no aparece nada.
17. `[ ]` Sin página por mercado (enlace profundo a una ventana).
18. `[ ]` Sin tarjeta compartible de un palpito resuelto (la prueba, como imagen).
19. `[ ]` Las posiciones abiertas solo salen en el muro, no en tu perfil.
20. `[ ]` Sin aviso cuando tu ventana se resuelve.
21. `[x]` Sin filtros en el muro (por activo o ventana).
22. `[x]` Ranking solo histórico total; falta "últimas 24h" y "esta semana".
23. `[x]` Sin métrica de calibración en el perfil (prometida en el pivote: ¿cuando dices "seguro" aciertas el 80%?).
24. `[x]` Racha sin implementar (la clave i18n existe pero no se usa).
25. `[ ]` Sin guía cuando el venue no tiene ventanas abiertas.

## C. Experiencia y diseño

26. `[x]` Sin esqueletos de carga: las páginas simplemente esperan.
27. `[x]` La cuenta regresiva no cambia de urgencia bajo 30 s.
28. `[ ]` Las tarjetas no muestran cómo va esa predicción ahora. Descartado por ahora:
    exigiría leer el libro por cada tarjeta (40 `eth_call` por tick) y el único dato
    gratis, `lastPrice`, es justo el que decidimos no usar por engañoso.
29. `[ ]` En móvil no hay acceso fijo a "hacer un palpito" al bajar por el muro.
30. `[ ]` La explicación de mint-a-pair va en `title`: invisible en táctil.
31. `[ ]` Sin auditoría de `focus-visible`.
32. `[ ]` Sin estado de "recién llegado": no hay onboarding de 3 pasos.
33. `[ ]` El wordmark es solo texto; falta identidad más marcada.
34. `[ ]` Sin animación de entrada en tarjetas nuevas del muro.
35. `[ ]` Sin modo de contraste alto.

## D. Entregables del hackathon

36. `[x]` Guion del video de 2-3 minutos, con planos y tiempos.
37. `[x]` Deck de presentación.
38. `[x]` Informe de feedback del SDK como documento aparte.
39. `[!]` Capturas en el README. Necesita 3 pantallazos tuyos: muro, calibración, recibo del oráculo.
40. `[ ]` Datos de respaldo para que la demo no dependa de que haya ventanas vivas.

## E. Profundidad técnica (los jueces escribieron el SDK)

41. `[!]` Usar los hooks de tiempo real del SDK. **Intentado y no funciona**: el tail
    nunca arranca (`useIsTailing()` siempre false, sin error). Documentado en
    FEEDBACK.md #10. Reintentar si el SDK lo arregla.
42. `[!]` Muro en vivo: **retirado**. Ni con los hooks del SDK ni con sondeo propio.
    Al investigarlo salió un fallo mayor, abajo.
43. `[x]` Mostrar volumen por mercado (receta "Read a market's volume").
44. `[ ]` Mini-visualización del grafo del oráculo en línea, no solo el enlace.
45. `[ ]` Session keys / operators para una UX sin fricción de firma.
46. `[ ]` Atribución de builder fee (`approveBuilder`): la historia de monetización.
47. `[ ]` Distinguir en el muro los cuatro caminos de cruce, no solo mint-a-pair.
48. `[ ]` Conciencia multi-venue en la UI.
49. `[ ]` Banco de pruebas de verdad en vez de scripts desechables.
50. `[ ]` Medir y mostrar la latencia de liquidación de Somnia (su argumento de venta).
