# Plan profesional: gasto mensual de la cuenta

El selector original de plan permanece en **Análisis de producto → Capital y operación**. Justo debajo se encuentra **Plan profesional · registro mensual**.

1. Introduce el importe mensual previsto de tu cuenta en US$ y la fecha del primer vencimiento que quieres controlar.
2. Guarda el calendario. Esto no registra ni descuenta cargos.
3. Para cada vencimiento, pulsa **Confirmar cargo**, comprueba el cargo en Amazon e introduce importe y fecha reales.
4. Confirma que el gasto no está descontado en el beneficio de los lotes ni en el presupuesto base y pulsa **Registrar pago**.

Cada periodo mensual admite un pago activo. Cambiar el importe o el día del calendario no altera pagos históricos ni permite cobrar dos veces el mismo periodo. El día 31 se ajusta al último día en meses cortos y vuelve al 31 cuando existe. El siguiente vencimiento se muestra junto con las mensualidades anteriores pendientes. Pausar el calendario no elimina los pagos registrados.

**Anular registro** corrige un error de registro y conserva fecha de anulación e historial de correcciones. No devuelve un cobro de Amazon. Una corrección se puede volver a registrar si su periodo está pendiente en el calendario activo.

## Aritmética

- Capital total = presupuesto base + resultados de lotes liquidados − pagos del plan registrados.
- Disponible = capital total − inversiones de compras abiertas − reserva.
- Resultado del negocio = resultados de operaciones cerradas − pagos del plan registrados.

**Resumen de compras** separa el resultado de los lotes antes del plan, el plan pagado y el resultado después del plan. Si no hay ventas, un cargo confirmado igualmente reduce el resultado y el capital. El gasto fijo no se imputa entero a cada producto. La nota de cobertura por producto indica cuántas ventas al beneficio unitario estimado cubrirían una mensualidad; no predice ventas ni cambia la puntuación financiera.

El beneficio introducido al cerrar un lote debe ser **antes del plan**. Si Amazon retuvo el plan de una liquidación, contabiliza el cargo aquí y reconstruye el beneficio del lote antes de esa retención. No reduzcas también el presupuesto base. Los registros previos no se reescriben automáticamente: antes de registrar cargos anteriores, comprueba que no estén ya descontados en el beneficio o presupuesto.

## Alcance

Entrada manual, sin consultas ni cobros a Amazon. Las fechas son locales al dispositivo. Los vencimientos pendientes no se consideran pagos ni se descuentan del capital. El calendario y sus pagos son comunes a todos los ASIN y se guardan en localStorage (`amazon_compuesto_plan_expenses_v1`) de este navegador, como el historial existente. Un registro ilegible o duplicado bloquea el cálculo del capital y nuevas compras; no se convierte silenciosamente en cero. El resultado agregado abarca los registros guardados, no un estado contable mensual devengado ni una conciliación bancaria.

El servidor local debe reiniciarse tras actualizar, porque incorpora el nuevo archivo a su lista de recursos públicos. Las pruebas usan datos sintéticos y no consultan TypeSafe.

Validación: `node tests/amazon-plan-expenses.cjs`, `node tests/operation-close.cjs`, `node tests/multiple-asins.cjs` y `node tests/jev-observer.cjs` (con jsdom disponible).
