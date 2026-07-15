# Auditoría de preparación para piloto de Yommi 2.0

**Fecha:** 12 de julio de 2026  
**Perspectiva:** propietario de restaurante con 20 años de operación  
**Escenario:** operar mañana y durante siete días usando exclusivamente Yommi

## Veredicto ejecutivo

Hoy no pondría toda la operación de mi restaurante en Yommi durante una semana. Sí podría cargar un menú, activar o desactivar productos, recibir pedidos, aceptar pagos coordinados y avanzar un pedido hasta su entrega. Eso demuestra que el recorrido principal existe.

El problema es lo que ocurre cuando el día deja de ser perfecto. No tengo un botón confiable para cerrar o pausar pedidos, el horario mostrado no impide que entren órdenes, no tengo una alerta operativa suficientemente fuerte, no puedo trabajar si pierdo internet, faltan datos y acciones para resolver incidencias, y una hora pico convertiría el panel en una lista difícil de controlar.

Además, no hay evidencia de un ambiente público listo para operar mañana: los dominios se presentan como futuros, las migraciones aprobadas no se han ejecutado y el almacenamiento de imágenes para un entorno real sigue sin estar habilitado. Antes de aceptar dinero de restaurantes, Yommi necesita demostrar una operación completa en un ambiente real y un turno controlado.

### Clasificación usada

| Prioridad | Significado operativo |
|---|---|
| P0 | Me impide abrir, vender o entregar con seguridad. |
| P1 | Puedo operar, pero con trabajo manual, riesgo de error o dependencia de soporte. |
| P2 | No bloquea el piloto; mejora comodidad, claridad o control posterior. |

## 1. ¿Qué me impediría abrir mi restaurante mañana usando Yommi?

| Prioridad | Impedimento | Por qué me bloquea |
|---|---|---|
| P0 | No hay un servicio público confirmado y listo para clientes | La preparación actual es para desarrollo y despliegue futuro. Sin una URL operativa, datos preparados y verificaciones reales, no puedo anunciar el canal ni recibir pedidos. |
| P0 | La publicación depende de aprobación administrativa | Aunque puedo configurar el negocio mientras está pendiente, no puedo aparecer ni recibir pedidos hasta que alguien me apruebe. No veo un plazo, responsable ni aviso claro de aprobación. |
| P0 | No puedo pausar pedidos ni cerrar inmediatamente | Si cierro temprano, tengo una emergencia o la cocina se satura, no existe una acción operativa visible para dejar de aceptar pedidos en ese momento. |
| P0 | El horario no gobierna la recepción de pedidos | El cliente puede ver que estoy cerrado, pero el recorrido de compra sigue disponible y el pedido puede entrar si el restaurante continúa aprobado y listo. |
| P0 | No hay continuidad útil sin internet | La pantalla puede conservar algunos recursos visuales, pero no permite recibir, aceptar, cobrar ni actualizar pedidos sin conexión. Tampoco existe una cola visible de acciones pendientes por enviar. |
| P0 | No hay una alerta de nuevo pedido adecuada para cocina | El pedido aparece si el panel está conectado, pero no hay alarma persistente, confirmación de que alguien lo vio ni escalamiento si nadie lo atiende. Tendría que vigilar la pantalla todo el turno. |
| P0 | No veo el teléfono del cliente en la tarjeta operativa | Ante una dirección dudosa, demora, sustitución o cliente ausente, el equipo no tiene un contacto visible para resolver el pedido. |
| P0 | No puedo garantizar pedidos con modificaciones comunes | El cliente solo elige producto y cantidad. No puede indicar “sin cebolla”, término, tamaño, sabor, complemento o alergia. Para muchos menús esto impide preparar correctamente. |
| P0 | No hay control de existencias por cantidad | Solo puedo encender o apagar un producto. Con varios pedidos simultáneos puedo vender más unidades de las que tengo antes de alcanzar a marcarlo como agotado. |

## 2. ¿Qué situaciones reales del día a día todavía no están resueltas?

| Prioridad | Situación diaria | Estado actual y efecto |
|---|---|---|
| P0 | Cierre anticipado o pausa por saturación | No hay control inmediato de “aceptando pedidos”. Editar información o apagar todo el menú es lento y confuso. |
| P0 | Cancelar después de aceptar | La pantalla solo ofrece rechazar cuando el pedido está pendiente. Aunque algunas cancelaciones posteriores son válidas, el restaurante no tiene la acción visible. |
| P0 | Cliente solicita cancelar | El seguimiento del cliente no ofrece cancelación ni solicitud de ayuda. El cliente recurrirá a WhatsApp o soporte. |
| P0 | Pedido equivocado, incompleto o derramado | No hay incidencia, reposición, corrección ni registro de acuerdo con el cliente. El pedido entregado queda cerrado. |
| P0 | Cliente no llega por un pickup | El pedido queda “listo” indefinidamente. No existe “cliente no se presentó”, plazo de espera ni salida operativa segura. |
| P0 | Retraso de entrega | Solo puedo marcar “en camino”; no puedo informar demora, nuevo tiempo estimado ni contactar al cliente desde la tarjeta. |
| P0 | Venta simultánea del último producto | La disponibilidad es binaria y no reserva unidades. Dos o más clientes pueden pedir la última pieza al mismo tiempo. |
| P1 | Confirmar una transferencia | El cliente recibe instrucciones, pero el comprobante se coordina fuera de Yommi. Yo debo buscar el pago, relacionarlo manualmente y luego confirmar. |
| P1 | Pedido pagado que debe cancelarse | El flujo normal lo bloquea porque no hay devoluciones. Es prudente, pero obliga a una resolución manual sin una ruta de atención visible. |
| P1 | Ajustar un pedido ya creado | No puedo corregir cantidad, sustituir producto, quitar un artículo ni acordar una diferencia de total dentro del pedido. |
| P1 | Cobro con cambio | Para efectivo no se pregunta con cuánto pagará el cliente. El repartidor puede salir sin cambio suficiente. |
| P1 | Tiempo de preparación | No puedo prometer 20, 35 o 60 minutos ni actualizar esa expectativa. El cliente solo ve estados generales. |
| P1 | Varias personas operando | No hay indicación de quién aceptó, quién prepara o quién entregó cada pedido en la pantalla del restaurante. |
| P1 | Cierre de caja | Solo veo cinco pedidos recientes y sus importes. No tengo un resumen confiable por día, método de pago, cancelaciones o ventas entregadas. |
| P1 | Entrega fuera de alcance | Existe una tarifa única de envío, pero no hay una manera operativa de rechazar antes del pedido una dirección demasiado lejana. |
| P1 | Reabrir después de una pausa o vacaciones | No existe una fecha de reanudación ni una vista clara que confirme cuándo volveré a recibir pedidos. |
| P2 | Orden del menú y prioridades | No hay controles claros para acomodar categorías y productos según la operación del día. |
| P2 | Historial completo y búsqueda | El panel muestra solo una muestra reciente; localizar un pedido antiguo por cliente o número sería difícil. |

## 3. ¿Qué pantallas me harían llamar al soporte?

### Panel del restaurante — P0/P1

- **P0:** un pedido de pickup muestra el rótulo “Dirección” aunque no existe entrega; puede aparecer vacío o indefinido.
- **P0:** si no entra un pedido esperado, no puedo distinguir entre “no hubo pedido”, “se perdió la conexión” y “el panel dejó de actualizarse”.
- **P0:** no encuentro cómo cerrar, pausar pedidos o declarar saturación.
- **P1:** los estados aparecen con nombres internos en inglés, mientras los botones usan español. Esto provoca dudas sobre qué ve el cliente.
- **P1:** “Marcar listo para recoger” también aparece en el recorrido de entrega, donde el siguiente paso es “En camino”. El lenguaje no distingue bien mostrador y reparto.
- **P1:** si una acción falla, aparece un mensaje general, pero no siempre me dice si debo reintentar, contactar al cliente o llamar a soporte.
- **P1:** solo hay cinco pedidos en historial reciente y no hay búsqueda, filtros ni totales del turno.

### Configuración del restaurante — P0/P1

- **P0:** no existe el control operativo “abierto y aceptando pedidos”.
- **P0:** los horarios son texto libre como `09:00-22:00` o `CERRADO`; es fácil escribir un formato que el cliente interprete mal.
- **P1:** puedo desactivar todas las modalidades o dejar combinaciones de cobro poco prácticas y solo descubrir el problema al intentar vender.
- **P1:** activar transferencia exige varios datos, pero no hay una prueba visible de cómo los verá el cliente antes de guardar.
- **P1:** si guardar falla, el mensaje no explica qué campo causó el rechazo.
- **P1:** la mezcla de etiquetas en español e inglés transmite que la pantalla aún no está terminada.

### Gestión del menú — P1

- **P1:** “Activo/Inactivo” no dice claramente “Disponible/Agotado hoy”. Un empleado nuevo puede interpretar que está eliminando el producto de forma permanente.
- **P1:** cambiar muchos agotados exige hacerlo producto por producto.
- **P1:** no puedo indicar existencias restantes, hora de reposición, modificaciones ni notas aceptadas.
- **P1:** eliminar una categoría con productos puede generar dudas sobre qué ocurrirá con pedidos anteriores.

### Seguimiento del pedido del cliente — P0/P1

- **P0:** muestra un bloque grande de mapa que declara que la integración está pendiente. Un cliente esperará ubicación real y llamará cuando no la vea.
- **P0:** no hay botón para cancelar, reportar un problema o contactar al restaurante desde el pedido.
- **P1:** no se muestra tiempo estimado ni explicación de retrasos.
- **P1:** una transferencia depende de enviar comprobante fuera del seguimiento; el cliente puede no saber si basta con pagar o también debe avisar.
- **P1:** un pedido cancelado no tiene un recorrido explicativo propio ni siguientes pasos.

### Carrito — P0/P1

- **P0:** permite iniciar la compra aunque el negocio figure cerrado.
- **P0:** no permite instrucciones del pedido, opciones del producto ni advertencias alimentarias.
- **P1:** después de crear la orden abre WhatsApp con “¿Me confirmas disponibilidad y tiempo?”. El cliente puede pensar que el pedido todavía no existe o crear una segunda conversación paralela.
- **P1:** el mensaje llama “total aproximado” a un total que ya fue calculado, lo que abre discusión sobre el monto.
- **P1:** exige exactamente diez dígitos a invitados; formatos con prefijo, espacios o números extranjeros producirán abandono.
- **P1:** si un producto se agotó mientras estaba en el carrito, el rechazo es correcto, pero el cliente no recibe una alternativa ni vuelve al menú con una explicación guiada.

## 4. ¿Qué funciones faltan para trabajar durante una semana completa?

### Imprescindibles — P0

- Abrir, cerrar y pausar pedidos con efecto inmediato y estado visible para el cliente.
- Bloquear pedidos fuera del horario real y permitir cierres excepcionales sin reescribir toda la semana.
- Alerta sonora y visual persistente, con confirmación de pedido visto.
- Mostrar teléfono y datos útiles del cliente al restaurante cuando corresponda.
- Notas del pedido y opciones básicas de producto necesarias para preparar correctamente.
- Control operativo de agotados que evite sobreventa en concurrencia.
- Cancelación antes y después de aceptar cuando el pago lo permita, con motivo visible para ambas partes.
- Manejo de cliente ausente, pedido equivocado, reposición y entrega fallida.
- Información de retraso y tiempo estimado.
- Una cola de pedidos ordenada por urgencia que siga siendo utilizable en hora pico.
- Señal clara de desconexión y recuperación segura al volver internet.

### Necesarias para operar con menos llamadas — P1

- Resumen del turno: pedidos recibidos, entregados, cancelados, venta entregada y desglose por forma de pago.
- Búsqueda de pedidos por número, cliente o teléfono.
- Motivos de rechazo/cancelación y mensajes comprensibles para el cliente.
- Registro visible de quién realizó cada acción cuando trabaja más de una persona.
- Captura de “paga con” para efectivo.
- Flujo claro para comprobantes de transferencia y conciliación manual.
- Confirmación de dirección y alcance de entrega antes de aceptar.
- Vista previa del restaurante tal como lo verá el cliente.
- Canal de ayuda visible con información del pedido ya incluida.

### Convenientes después del piloto — P2

- Reordenar menú con rapidez.
- Comparar días o turnos.
- Guardar motivos frecuentes de agotado o cierre.
- Exportar un cierre sencillo para revisión administrativa.

## 5. ¿Qué procesos son lentos o confusos?

| Prioridad | Proceso | Fricción observada |
|---|---|---|
| P0 | Detener pedidos | No hay una acción única. La alternativa sería tocar horarios, modalidades o disponibilidades, sin certeza de efecto inmediato. |
| P0 | Resolver una incidencia | Debo salir de Yommi, localizar al cliente por otro medio y recordar después qué ocurrió. |
| P0 | Manejar hora pico | Cada pedido ocupa una tarjeta grande y exige varios clics secuenciales. No hay orden por promesa, retraso o prioridad. |
| P1 | Alta inicial del menú | Categoría y productos se crean uno por uno. Para un menú real de decenas de artículos, la preparación rebasa ampliamente quince minutos. |
| P1 | Configurar horarios | Escribir siete rangos manuales en texto libre es lento y propenso a errores. |
| P1 | Marcar varios agotados | Requiere localizar y cambiar cada producto individualmente. |
| P1 | Transferencia | Cliente paga por un lado, envía evidencia por otro y yo confirmo en Yommi. Son tres puntos donde se puede perder la relación con el pedido. |
| P1 | Pedido creado más WhatsApp | Existen dos señales de confirmación: la orden en Yommi y una conversación que pregunta si se confirma. |
| P1 | Aprobación del restaurante | Veo “pendiente”, pero no sé cuánto tardará, quién revisa ni qué debo hacer si mañana sigo igual. |
| P2 | Revisar resultados | Solo puedo sumar mentalmente los pedidos visibles o buscar información fuera de la plataforma. |

## 6. ¿Qué errores cometería un restaurante nuevo?

| Prioridad | Error probable | Consecuencia |
|---|---|---|
| P0 | Creer que poner `CERRADO` o cambiar el horario detiene pedidos | Puede recibir órdenes cuando la cocina no está operando. |
| P0 | No mantener el panel abierto y visible | Puede perder pedidos porque no hay una alerta persistente ni confirmación de atención. |
| P0 | Aceptar un pedido y descubrir después que falta un producto | La pantalla deja de mostrar la opción de rechazo, aunque el pedido todavía necesite cancelarse. |
| P0 | Vender el último producto varias veces | La disponibilidad no representa cantidad ni reserva existencias. |
| P0 | Marcar entregado o cobrar al pedido equivocado durante un pico | Las tarjetas usan solo los primeros caracteres del identificador y no hay segunda confirmación en acciones críticas. |
| P1 | Confundir “Activo” con publicación permanente | Puede dejar un agotado disponible o esconder un producto que sí vende. |
| P1 | Configurar delivery con tarifa cero por omisión | Absorberá el costo o discutirá el cobro con el cliente. |
| P1 | Habilitar transferencia con instrucciones incompletas o poco claras | Recibirá comprobantes sin referencia suficiente para conciliarlos. |
| P1 | Escribir horarios con formato inconsistente | El restaurante puede aparecer abierto o cerrado de forma incorrecta. |
| P1 | Asumir que el mapa sigue al repartidor | El cliente verá una promesa visual que todavía no se cumple. |
| P1 | Desactivar el último producto para pausar | El negocio puede desaparecer del canal público sin explicar al propietario cómo recuperarlo. |
| P2 | Cargar imágenes antes de completar lo esencial | Invertirá tiempo en presentación sin haber validado todavía el recorrido completo de pedido. |

## 7. ¿Qué errores cometerían los clientes?

| Prioridad | Error probable | Consecuencia |
|---|---|---|
| P0 | Pedir aunque la ficha indique cerrado | La interfaz todavía permite continuar y el restaurante quizá no responda. |
| P0 | Omitir una modificación importante porque no existe campo de notas | Recibirá algo distinto de lo esperado o potencialmente inadecuado para su dieta. |
| P0 | Esperar ubicación en vivo del repartidor | El seguimiento muestra un mapa pendiente y no ofrece una expectativa alternativa clara. |
| P1 | Creer que debe confirmar otra vez por WhatsApp | Puede duplicar el pedido o pensar que la orden de Yommi no fue válida. |
| P1 | Pagar transferencia y no enviar aviso por el canal esperado | El restaurante no confirmará el pago y la preparación no comenzará. |
| P1 | Escribir un teléfono con prefijo o espacios | El formulario lo rechazará aunque el número sea utilizable. |
| P1 | Elegir delivery sin saber si su dirección está dentro del alcance | El restaurante tendrá que rechazar después de creado el pedido. |
| P1 | Querer cancelar desde seguimiento | No encontrará la acción ni un contacto claro. |
| P1 | Reintentar después de una conexión dudosa | Puede no saber si el primer pedido se creó y arriesgar una orden duplicada. |
| P2 | Interpretar estados en inglés o cancelación sin motivo | No entenderá qué ocurrió ni qué debe hacer después. |

## 8. ¿Qué pasa si...?

### No tengo internet — P0

Dejo de recibir nuevos pedidos y no puedo aceptar, preparar, confirmar pagos ni entregar desde Yommi. La pantalla no ofrece un modo operativo desconectado ni una cola de cambios pendientes. Al regresar la conexión tendría que recargar y revisar manualmente qué pedidos cambiaron. Si voy a operar exclusivamente con la plataforma, necesito una conexión de respaldo fuera del producto.

### Cierro antes — P0

No tengo un botón de cierre inmediato. Cambiar el horario semanal no garantiza que el pedido quede bloqueado. El cliente puede seguir llegando al carrito y crear una orden mientras el restaurante continúa aprobado, activo y con productos disponibles.

### Se acaba un producto — P1 en un turno normal; P0 con alta demanda

Puedo entrar al menú y cambiarlo de “Activo” a “Inactivo”. Los nuevos pedidos serán rechazados si intentan incluir ese producto, lo cual es correcto. Sin embargo, no hay cantidad disponible, cambio masivo ni reserva; varios clientes pueden comprar las últimas unidades antes de que yo alcance a apagarlo. Si desactivo el único producto disponible, el restaurante deja de cumplir la condición para operar y puede desaparecer, sin un control explícito de pausa.

### Llega un pedido equivocado — P0

No hay una acción para reportar, corregir, reponer o documentar el error. Una vez entregado, el recorrido terminó. Tendría que resolverlo por teléfono o WhatsApp, pero el contacto del cliente no aparece en la tarjeta principal del restaurante.

### Quiero cancelar — P0/P1

Si el pedido sigue pendiente, puedo rechazarlo. Después de aceptarlo, la pantalla ya no ofrece cancelación aunque todavía pueda existir una causa operativa válida. Si ya está pagado, la cancelación normal se bloquea y requiere solución manual porque Yommi no gestiona devoluciones; esto es correcto como protección, pero falta una ruta de atención visible. El cliente no tiene acción de cancelación.

### Un cliente no llega — P0

El pedido de pickup permanece listo sin límite ni estado de “no se presentó”. No puedo cerrar el caso, registrar el intento de contacto o distinguirlo de un pedido que aún será recogido. Tampoco tengo el teléfono visible en la tarjeta para llamarle.

### El repartidor se retrasa — P0

Solo puedo dejar el pedido “en camino”. No puedo registrar demora, ajustar el tiempo esperado ni mandar una explicación desde el pedido. El cliente ve un mapa que no brinda seguimiento real y terminará llamando al restaurante.

### Cambia el horario — P1

Puedo editar los siete días en configuración, escribiendo cada rango como texto. Es lento, no valida bien excepciones y no confirma que el cambio afecte la aceptación de pedidos. Un cambio temporal termina mezclándose con el horario habitual.

### Cierro por vacaciones — P0

No existe un periodo de vacaciones con fecha de inicio y regreso. Escribir todos los días como cerrados no constituye una pausa segura porque la existencia de un horario, aunque diga cerrado, sigue contando como configuración completa y no bloquea por sí misma la creación del pedido.

### Quiero pausar pedidos — P0

No puedo hacerlo directamente. Apagar todos los productos o modalidades es una maniobra indirecta, lenta y riesgosa. También puede hacer desaparecer el restaurante sin decir al cliente cuándo vuelve ni dejarme una reapertura sencilla.

### Recibo 30 pedidos al mismo tiempo — P0

Los treinta aparecen como tarjetas grandes en una sola lista. No hay separación por pickup/delivery, hora prometida, retraso, pago pendiente o estación de cocina. No hay impresión, vista compacta, responsable, límites de capacidad ni confirmación de que cada orden fue vista. El stock puede sobrevendérse y aumenta mucho el riesgo de cobrar, preparar o entregar el pedido equivocado. Con dos o tres pedidos podría trabajar; con treinta, perdería control del turno.

## 9. Registro consolidado de problemas

| ID | Prioridad | Problema |
|---|---|---|
| PR-01 | P0 | No hay ambiente público confirmado para operar mañana. |
| PR-02 | P0 | La aprobación administrativa puede bloquear la apertura sin plazo visible. |
| PR-03 | P0 | No existe abrir/cerrar/pausar pedidos de inmediato. |
| PR-04 | P0 | El horario mostrado no bloquea pedidos fuera de servicio. |
| PR-05 | P0 | Sin internet no hay continuidad operativa ni estado claro de sincronización. |
| PR-06 | P0 | No hay alerta persistente ni confirmación de nuevo pedido visto. |
| PR-07 | P0 | El teléfono del cliente no está visible en la operación del restaurante. |
| PR-08 | P0 | Faltan notas y modificaciones esenciales del pedido. |
| PR-09 | P0 | No hay existencias por cantidad ni protección suficiente ante sobreventa concurrente. |
| PR-10 | P0 | No hay manejo de pedido equivocado, reposición o entrega fallida. |
| PR-11 | P0 | No hay flujo para cliente ausente en pickup. |
| PR-12 | P0 | No hay comunicación de demora ni tiempo estimado. |
| PR-13 | P0 | La cancelación posterior a aceptación no está disponible en la pantalla. |
| PR-14 | P0 | El cliente no puede cancelar ni pedir ayuda desde su pedido. |
| PR-15 | P0 | La vista de seguimiento promete un mapa que todavía no funciona como seguimiento real. |
| PR-16 | P0 | La lista actual no es operable con 30 pedidos simultáneos. |
| PR-17 | P1 | Los horarios son texto libre y permiten errores. |
| PR-18 | P1 | Agotados masivos y reactivación son lentos. |
| PR-19 | P1 | La transferencia se concilia manualmente entre canales separados. |
| PR-20 | P1 | El pedido creado y la confirmación por WhatsApp se contradicen. |
| PR-21 | P1 | No hay corrección o sustitución de un pedido activo. |
| PR-22 | P1 | No se captura “paga con” para efectivo. |
| PR-23 | P1 | No existe cierre de turno ni métricas operativas suficientes. |
| PR-24 | P1 | No se valida el alcance de entrega antes de crear el pedido. |
| PR-25 | P1 | No hay búsqueda ni historial operativo completo. |
| PR-26 | P1 | Mensajes y estados mezclan idiomas o no explican la siguiente acción. |
| PR-27 | P1 | El teléfono de invitado acepta únicamente un formato rígido de diez dígitos. |
| PR-28 | P1 | No hay motivo de rechazo/cancelación visible para el cliente. |
| PR-29 | P1 | No se identifica quién realizó cada acción durante el turno. |
| PR-30 | P2 | Falta ordenar el menú según prioridades del negocio. |
| PR-31 | P2 | Faltan comparaciones sencillas entre turnos o días. |

## 10. ¿Aceptaría pagar una mensualidad por usar Yommi en el estado actual?

**No.**

No pagaría todavía porque tendría que mantener WhatsApp, llamadas, notas manuales y vigilancia constante como respaldo para situaciones que ocurren todos los días. El recorrido feliz existe, pero la mensualidad se justifica cuando la plataforma reduce carga y riesgo; en el estado actual me pediría confiarle ventas sin darme control suficiente sobre cierres, saturación, conectividad, incidencias y hora pico.

Aceptaría participar en un piloto controlado, con pocos pedidos, personal observando y un canal directo de ayuda. No aceptaría operar exclusivamente una semana completa ni presentar Yommi como mi único canal hasta que los P0 estén resueltos y probados durante un turno real.
