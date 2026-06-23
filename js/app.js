// --- VALIDACIÓN DE DÍA NUEVO ---
const hoyFECHA = new Date().toLocaleDateString();
const ultimaFechaOperacion = localStorage.getItem('ultima_fecha_operacion');

// Si la fecha guardada es distinta a la de hoy, vaciamos el historial
if (ultimaFechaOperacion !== hoyFECHA) {
    localStorage.setItem('archivo_comedor_local', JSON.stringify([]));
    localStorage.setItem('ultima_fecha_operacion', hoyFECHA);
}

// Se carga el historial (Si es un día nuevo)
let historialJSON = JSON.parse(localStorage.getItem('archivo_comedor_local')) || [];
let contadoresActuales = {};

// Inicializar contadores 
TIPOS_HOTEL.forEach(cat => contadoresActuales[cat.id] = 0);

// Timestamp formato API
function getTimestamp() {
    const ahora = new Date();
    return ahora.getFullYear() + "-" +
        String(ahora.getMonth() + 1).padStart(2, '0') + "-" +
        String(ahora.getDate()).padStart(2, '0') + " " +
        String(ahora.getHours()).padStart(2, '0') + ":" +
        String(ahora.getMinutes()).padStart(2, '0') + ":" +
        String(ahora.getSeconds()).padStart(2, '0');
}

// ==================== FUNCIÓN PARA LIMPIAR PANTALLA Y DIBUJO DE LOS BOTONES =========================
function renderCards(grupo) {
    const container = document.getElementById('cards-container');
    if (!container) return;

    container.innerHTML = '';

    const filtrados = TIPOS_HOTEL.filter(item => item.grupo === grupo);

    document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));

    const activeTab = Array.from(document.querySelectorAll('.tab-btn'))
        .find(t => t.innerText.trim().toLowerCase() === grupo.toLowerCase());

    if (activeTab) activeTab.classList.add('active');

    filtrados.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';

        // --- Detecta si es huésped ---
        const esHuesped = grupo.toLowerCase() === 'huésped';
        const eventosPresion = esHuesped ? `
            onmousedown="iniciarPresion(event, ${item.id})" 
            onmouseup="finalizarPresion()" 
            onmouseleave="finalizarPresion()"
            ontouchstart="iniciarPresion(event, ${item.id})" 
            ontouchend="finalizarPresion()"`
            : '';
        // ------------------------------------------

        card.innerHTML = `
            <span class="card-title">${item.nombre}</span>
            <div class="counter-controls">
                <button class="btn-qty" onclick="cambiarVal(${item.id}, -1)">-</button>
                <span id="qty-${item.id}" 
                      style="${esHuesped ? 'cursor: pointer; user-select: none;' : ''}" 
                      ${eventosPresion}>
                    ${contadoresActuales[item.id] || 0}
                </span>
                <button class="btn-qty" onclick="cambiarVal(${item.id}, 1)">+</button>
            </div>
        `;

        container.appendChild(card);
    });
}
//=====================================================================================================

// ============================ FUNCIÓN PARA CAMBIAR VALORES DE CONTADORES ============================
function cambiarVal(id, delta) {
    if (contadoresActuales[id] + delta >= 0) {
        contadoresActuales[id] += delta;

        const el = document.getElementById(`qty-${id}`);
        if (el) el.innerText = contadoresActuales[id];
    }
}
//=====================================================================================================

// ================ FUNCIÓN PARA EL FUNCIONAMIENTO CORRECTO DE CONFIRMACIÓN Y GUARDAR =================
async function confirmarYGuardar() {
    verificarHorarioServicio();
    const btn = document.querySelector('.btn-confirm-main');
    if (btn.disabled) return;

    let infoAEnviar = [];
    let cuerpoTabla = "";
    let hayDatos = false;

    TIPOS_HOTEL.forEach(item => {
        const cantidad = contadoresActuales[item.id] || 0;
        if (cantidad > 0) {
            infoAEnviar.push({ timestamp: getTimestamp(), tipo: item.id, num: cantidad });
            // Se genera las filas de la tabla para el Swal
            cuerpoTabla += `<tr><td>${item.nombre}</td><td class="dato-cantidad">${cantidad}</td></tr>`;
            hayDatos = true;
        }
    });

    if (!hayDatos) return;

    // Mostramos la alerta con los datos que se van a enviar
    const resultado = await Swal.fire({
        title: '¿Confirmar registro?',
        html: `<table class="tabla-confirmacion">
                <thead><tr><th>Categoría</th><th>Cant.</th></tr></thead>
                <tbody>${cuerpoTabla}</tbody>
               </table>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#0056b3',
        confirmButtonText: 'Aceptar',
        cancelButtonText: 'Cancelar'
    });

    if (!resultado.isConfirmed) return;

    // --- PROCESO DE ENVÍO ---
    const formData = new FormData();
    formData.append("key", "pi31416");
    infoAEnviar.forEach((item, index) => {
        formData.append(`info[${index}][tipo]`, item.tipo);
        formData.append(`info[${index}][num]`, item.num);
        formData.append(`info[${index}][timestamp]`, item.timestamp);
    });

    let fueExitoso = false;

    try {
        const response = await fetch("http://localhost/front-comedor-reportes/prueba.php", {
            method: "POST",
            body: formData
        });
        if (response.ok) fueExitoso = true;
    } catch (error) {
        fueExitoso = false;
    }

    // --- GUARDADO CON ESTADO DE ENVÍO ---
    infoAEnviar.forEach(reg => {
        historialJSON.push({ ...reg, enviado: fueExitoso });
        contadoresActuales[reg.tipo] = 0;
    });

    localStorage.setItem('archivo_comedor_local', JSON.stringify(historialJSON));
    localStorage.setItem('ultima_fecha_operacion', new Date().toLocaleDateString());

    if (fueExitoso) {
        actualizarTotalConfirmado();
        // Esto hace que la tabla de reportes se refresque apenas se guarde algo
        cargarTablaReportes();
        Swal.fire({ text: "Registro exitoso", icon: "success", timer: 1500, showConfirmButton: false });
    } else {
        Swal.fire({
            text: "Sin conexión. Los datos se enviarán y sumarán al total cuando se recupere el internet.",
            icon: "warning",
            confirmButtonColor: "#0056b3"
        });
    }

    // Inicia con Huésped
    renderCards('huésped');
}
//=====================================================================================================

// ======================= FUNCIÓN PARA ACTUALIZAR EL TOTAL "TOTAL CONFIRMADO" ========================
function actualizarTotalConfirmado() {
    // Se suma solo los que ya se han enviado
    const total = historialJSON
        .filter(item => item.enviado === true)
        .reduce((sum, item) => sum + item.num, 0);

    const el = document.getElementById('display-total');
    if (el) {
        el.innerText = total;
    }
}
//=====================================================================================================

// ========== FUNCIONES PARA EL FUNCIONAMIENTO AL ABRIR Y CERRAR EL MODAL DEL DESGLOSE ================
function abrirModal() {
    const modal = document.getElementById('modal-resumen');
    const detalle = document.getElementById('detalle-resumen');

    if (!modal || !detalle) return;

    modal.style.display = 'flex';

    let html = "<ul>";

    TIPOS_HOTEL.forEach(tipo => {
        // IMPORTANTE: Se filtra por tipo y por estado enviado: true
        const totalCat = historialJSON
            .filter(r => r.tipo === tipo.id && r.enviado === true)
            .reduce((sum, r) => sum + r.num, 0);

        if (totalCat > 0) {
            html += `
                <li>
                    <strong>${tipo.nombre}</strong>
                    <span class="qty-badge">${totalCat}</span>
                </li>`;
        }
    });

    html += "</ul>";

    // Si no hay nada confirmado aún, mostramos un mensaje amigable
    if (html === "<ul></ul>") {
        html = "<p style='text-align:center; padding:20px;'>No hay registros confirmados el día de hoy.</p>";
    }

    detalle.innerHTML = html;
}

function cerrarModal() {
    const modal = document.getElementById('modal-resumen');
    if (modal) modal.style.display = 'none';
}
//=====================================================================================================

// ------------------------------ CHECK-LIST DE SEGURIDAD Y PREPARACIÓN -------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Verifica si el botón debe estar bloqueado o no por la hora
    verificarHorarioServicio();

    // Renderiza los botones de Huésped
    renderCards('huésped');

    // Muestra el total (ya sea el acumulado de hoy o 0 si es día nuevo)
    actualizarTotalConfirmado();

    // Muestra la fecha
    mostrarFechaFormateada();

    // Muestra la sincronización
    sincronizarPendientes();
});
//=====================================================================================================

// =========== FUNCIONES PARA ACTIVACIÓN DEL TECLADO PARA EL APARTADO DE HUÉSPED (EXTRA) ==============
// Lógica para entrada manual (1 segundos presionado)
let presionadoTimer;

function iniciarPresion(e, id) {
    presionadoTimer = setTimeout(() => {
        abrirInputNumerico(id);
    }, 1000); // 1000 milisegundos = 1 segundos
}

function finalizarPresion() {
    clearTimeout(presionadoTimer);
}

// --- LÓGICA DEL TECLADO TÁCTIL ---
let currentKeyboardId = null;
let currentKeyboardValue = "";

// Función abrirInputNumerico
function abrirInputNumerico(id) {
    currentKeyboardId = id;
    const item = TIPOS_HOTEL.find(t => t.id === id);
    document.getElementById('teclado-titulo').innerText = item.nombre;

    // Iniciar con el valor actual del contador
    currentKeyboardValue = contadoresActuales[id].toString();
    actualizarPantallaTeclado();

    document.getElementById('modal-teclado').style.display = 'flex';
}

function tecladoAdd(num) {
    if (currentKeyboardValue === "0") currentKeyboardValue = "";
    if (currentKeyboardValue.length < 4) { // Límite de 4 dígitos para que no se rompa el diseño
        currentKeyboardValue += num;
    }
    actualizarPantallaTeclado();
}

function tecladoDelete() {
    currentKeyboardValue = currentKeyboardValue.slice(0, -1);
    if (currentKeyboardValue === "") currentKeyboardValue = "0";
    actualizarPantallaTeclado();
}

function tecladoClear() {
    currentKeyboardValue = "0";
    actualizarPantallaTeclado();
}

function actualizarPantallaTeclado() {
    document.getElementById('keyboard-screen').innerText = currentKeyboardValue;
}

function confirmarTeclado() {
    const finalValue = parseInt(currentKeyboardValue) || 0;
    contadoresActuales[currentKeyboardId] = finalValue;

    // Actualiza el número en la tarjeta
    const el = document.getElementById(`qty-${currentKeyboardId}`);
    if (el) el.innerText = finalValue;

    cerrarTeclado();
}

function cerrarTeclado() {
    document.getElementById('modal-teclado').style.display = 'none';
    currentKeyboardId = null;
}
//=====================================================================================================
// Soporte para teclado físico (Si es que se requiere el uso de un teclado) 
document.addEventListener('keydown', (e) => {
    const tecladoVisible = document.getElementById('modal-teclado').style.display === 'flex';
    if (tecladoVisible) {
        if (e.key === 'Enter') confirmarTeclado();
        if (e.key === 'Escape') cerrarTeclado();
        if (e.key === 'Backspace') tecladoDelete();
        if (!isNaN(e.key) && e.key !== ' ') tecladoAdd(e.key);
    }
});
//=====================================================================================================

// ================================== FUNCIÓN PARA PANTALLA COMPLETA ==================================
function toggleFullScreen() {
    const btn = document.getElementById('btn-fs');
    // Selección al elemento raíz (toda la página)
    const docElm = document.documentElement;

    // Comprobamos si ya está en pantalla completa 
    const isFullScreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    if (!isFullScreen) {
        // --- ENTRAR EN PANTALLA COMPLETA ---
        // Busca el método compatible con el navegador del dispositivo
        const requestMethod = docElm.requestFullscreen || docElm.webkitRequestFullscreen || docElm.webkitRequestFullScreen || docElm.mozRequestFullScreen || docElm.msRequestFullscreen;

        if (requestMethod) {
            // navigationUI: "hide" intenta ocultar los botones de Android
            requestMethod.call(docElm, { navigationUI: "hide" })
                .then(() => {
                    btn.innerText = "✕ Salir Fullscreen";
                    btn.style.backgroundColor = "rgba(255, 0, 0, 0.2)";
                })
                .catch(err => {
                    console.error("Error al intentar pantalla completa:", err);
                });
        }
    } else {
        // --- SALIR DE PANTALLA COMPLETA ---
        const exitMethod = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;

        if (exitMethod) {
            exitMethod.call(document);
            btn.innerText = "⛶ Pantalla Completa";
            btn.style.backgroundColor = "rgba(255,255,255,0.1)";
        }
    }
}
//=====================================================================================================

// Escuchar cambios de pantalla completa para actualizar el botón
// o los gestos de Android para salir.
const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
events.forEach(eventType => {
    document.addEventListener(eventType, () => {
        const btn = document.getElementById('btn-fs');
        const isFullScreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

        if (!isFullScreen) {
            btn.innerText = "⛶ Pantalla Completa";
            btn.style.backgroundColor = "rgba(255,255,255,0.1)";
        }
    });
});


// =========================== FUNCIÓN PARA VALIDAR HORARIO DE SERVICIO ===============================
function verificarHorarioServicio() {
    const ahora = new Date();
    const diaSemana = ahora.getDay(); // 0 es Domingo, 1 al 6 es Lunes-Sábado
    const horaActual = ahora.getHours();
    const minutoActual = ahora.getMinutes();

    // Se convierte la hora actual a minutos totales para comparar fácil
    const tiempoActualEnMinutos = (horaActual * 60) + minutoActual;

    let inicio, fin;

    if (diaSemana === 0) {
        // DOMINGO: 6:30 AM a 11:30 AM
        inicio = (6 * 60) + 30;
        fin = (11 * 60) + 30;
    } else {
        // LUNES A SÁBADO: 6:00 AM a 11:00 AM
        inicio = 6 * 60;
        fin = 11 * 60;
    }

    const btnConfirmar = document.querySelector('.btn-confirm-main');

    if (tiempoActualEnMinutos >= inicio && tiempoActualEnMinutos < fin) {
        // HORARIO PERMITIDO
        btnConfirmar.disabled = false;
        btnConfirmar.style.opacity = "1";
        btnConfirmar.style.cursor = "pointer";
        btnConfirmar.style.backgroundColor = "var(--h-blue)";
        btnConfirmar.innerText = "Confirmar Registro";
    } else {
        // FUERA DE HORARIO
        btnConfirmar.disabled = true;
        btnConfirmar.style.opacity = "0.5";
        btnConfirmar.style.cursor = "not-allowed";
        btnConfirmar.style.backgroundColor = "#64748B";
        btnConfirmar.innerText = "Cerrado (Fuera de Horario)";
    }
}
//=====================================================================================================

// Ejecutar la validación cada minuto para que el botón se bloquee solo si pasa la hora
setInterval(verificarHorarioServicio, 60000);

// También ejecutarla cuando cargue la página
document.addEventListener('DOMContentLoaded', () => {
    verificarHorarioServicio();
});
//=====================================================================================================

// ========================== FUNCIÓN PARA MOSTRAR LA FECHA EN EL ENCABEZADO ==========================
function mostrarFechaFormateada() {
    const fecha = new Date();
    const opciones = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    // Genera el texto
    let fechaHoy = fecha.toLocaleDateString('es-ES', opciones);

    // Pone la primera letra en mayúscula
    fechaHoy = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);

    const el = document.getElementById('fecha-actual');
    if (el) el.innerText = fechaHoy;
}
//=====================================================================================================

// ========================== FUNCIÓN PARA LOS RESPALDOS (SINCRONIZACIÓN) =============================
async function sincronizarPendientes() {
    // Se filtra solo lo que NO se ha enviado
    const pendientes = historialJSON.filter(reg => reg.enviado === false);

    // Si no hay nada pendiente, SALIMOS. Para evitar el mensaje al actualizar.
    if (pendientes.length === 0) return;

    const formData = new FormData();
    formData.append("key", "pi31416");
    pendientes.forEach((item, index) => {
        formData.append(`info[${index}][tipo]`, item.tipo);
        formData.append(`info[${index}][num]`, item.num);
        formData.append(`info[${index}][timestamp]`, item.timestamp);
    });

    try {
        const response = await fetch("http://localhost/front-comedor-reportes/prueba.php", {
            method: "POST",
            body: formData
        });

        if (response.ok) {
            // Se Marca como enviados
            historialJSON.forEach(reg => {
                if (reg.enviado === false) reg.enviado = true;
            });

            localStorage.setItem('archivo_comedor_local', JSON.stringify(historialJSON));

            // Aumenta el total en pantalla
            actualizarTotalConfirmado();

            // Solo mostramos el mensaje porque REALMENTE se sincronizó algo
            Swal.fire({
                title: 'Sincronización Exitosa',
                text: 'Los datos pendientes se han enviado correctamente.',
                icon: 'success',
                timer: 2500,
                showConfirmButton: false
            });
        }
    } catch (e) {
        console.log("Reintentando conexión...");
    }
}
//===================================================================================================== 

// DISPARADOR AUTOÁTICO PARA COMPUTADORA
window.addEventListener('online', sincronizarPendientes);

// --- DISPARADORES AUTOMÁTICOS PARA TABLET SIN ACTUALIZACIONES ---

// REVISIÓN (Cada 2 segundos)
// Revisa si hay red y si hay pendientes constantemente.
setInterval(() => {
    if (navigator.onLine) {
        sincronizarPendientes();
    }
}, 2000);

// DISPARADOR POR TACTO
// Despierta la conexión si la tablet entró en modo ahorro al tocar la pantalla.
document.addEventListener('touchstart', () => {
    if (navigator.onLine) sincronizarPendientes();
}, { passive: true });

// EVENTO NATIVO DE RED
window.addEventListener('online', sincronizarPendientes);

// AL REGRESAR A LA PESTAÑA (Por si bloquean la tablet)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
        sincronizarPendientes();
    }
});
//===================================================================================================== AQUIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII

// ============================ FUNCIÓN PARA CAMBIAR DE VISTAS (Módulos) ==============================
function irA(modulo) {
    // Referencias de los módulos y su botón
    const modComedor = document.getElementById('modulo-comedor');
    const modReportes = document.getElementById('modulo-reportes');
    const modEmpleados = document.getElementById('modulo-empleados');
    const modComedorEmp = document.getElementById('modulo-comedor-empleados');
    const modReporteEmpleados = document.getElementById('modulo-reporte-empleados');

    const btnComedor = document.getElementById('btn-nav-comedor');
    const btnReportes = document.getElementById('btn-nav-reportes');
    const btnEmpleados = document.getElementById('btn-nav-empleados');
    const btnComedorEmp = document.getElementById('btn-nav-comedor-emp');
    const btnReporteEmpleados = document.getElementById('btn-nav-reporte-empleados');

    // Oculta todos los módulos y limpiar clases
    [modComedor, modReportes, modEmpleados, modComedorEmp, modReporteEmpleados].forEach(m => {
        if (m) m.style.display = 'none';
    });
    [btnComedor, btnReportes, btnEmpleados, btnComedorEmp, btnReporteEmpleados].forEach(b => {
        if (b) b.classList.remove('active');
    });

    // Limpiar escáner si salimos de su módulo
    if (modulo !== 'comedor-empleados' && scannerComedor) {
        scannerComedor.clear();
        scannerComedor = null;
    }

    // Lógica de visualización
    if (modulo === 'reportes' && modReportes) {
        modReportes.style.display = 'block';
        if (btnReportes) btnReportes.classList.add('active');
        if (typeof cargarTablaReportes === 'function') cargarTablaReportes();
    }
    else if (modulo === 'reporte-empleados' && modReporteEmpleados) { // NUEVO BLOQUE
        modReporteEmpleados.style.display = 'block';
        if (btnReporteEmpleados) btnReporteEmpleados.classList.add('active');
        if (typeof cargarTablaReporteEmpleados === 'function') cargarTablaReporteEmpleados();
    }
    else if (modulo === 'empleados' && modEmpleados) {
        modEmpleados.style.display = 'block';
        if (btnEmpleados) btnEmpleados.classList.add('active');
        if (typeof cargarTablaEmpleados === 'function') cargarTablaEmpleados();
        if (typeof prepararBotonesDeptos === 'function') prepararBotonesDeptos();
    }
    else if (modulo === 'comedor-empleados' && modComedorEmp) {
        modComedorEmp.style.display = 'block';
        if (btnComedorEmp) btnComedorEmp.classList.add('active');
        iniciarEscanerQR();
    }
    else {
        // Fallback por defecto a Comedor
        if (modComedor) modComedor.style.display = 'block';
        if (btnComedor) btnComedor.classList.add('active');
    }
}
//======================================================================================================

// ======================= FUNCIÓN PARA CARGAR LA TABLA (DIBUJAR LA TABLA) =============================
async function cargarTablaReportes() {
    const tablaBody = document.getElementById('tabla-reportes-body');
    if (!tablaBody) return;

    try {
        const response = await fetch('http://localhost/front-comedor-reportes/obtener_reportes.php');
        const data = await response.json();

        tablaBody.innerHTML = '';

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #edeff2";

            // Usamos fecha_bonita que viene del PHP
            tr.innerHTML = `
                <td style="padding: 15px; font-weight: 700; color: #003876;">${row.fecha_bonita}</td>
                <td>${row.h_normal}</td>
                <td>${row.h_extra}</td>
                <td>${row.dp_normal}</td>
                <td>${row.dp_plus}</td>
                <td>${row.ama_llaves}</td>
                <td>${row.mant}</td>
                <td>${row.ayb}</td>
                <td>${row.recep}</td>
                <td>${row.admin}</td>
                <td>${row.ventas}</td>
                <td>${row.rh}</td>
                <td>${row.seg}</td>
                <td>${row.cor_comite}</td>
                <td>${row.cor_ventas}</td>
                <td style="padding: 15px; font-weight: 800; color: white; background: #003876;">${row.gran_total}</td>
            `;
            tablaBody.appendChild(tr);
        });
    } catch (error) {
        tablaBody.innerHTML = '<tr><td colspan="15" style="padding: 20px; color: red;">Error: Revisa la conexión con obtener_reportes.php</td></tr>';
    }
}
// ====================================================================================================

// ============================== FUNCIÓN PARA EL FILTRADO DE BUSQUEDA ================================
document.addEventListener('DOMContentLoaded', () => {
    const buscador = document.getElementById('buscador-empleados');

    buscador.addEventListener('input', function () {
        const filtro = this.value.toLowerCase().trim();
        const filas = document.querySelectorAll('#tabla-reportes-body tr');

        filas.forEach(fila => {
            const fechaTexto = fila.cells[0].textContent.toLowerCase();

            if (fechaTexto.includes(filtro)) {
                fila.style.display = '';
            } else {
                fila.style.display = 'none';
            }
        });
    });
});
//=====================================================================================================

// =========================== FUNCIÓN PARA EXPORTAR LA TABLA EN EXCEL ================================
function exportarExcel() {
    let tablaOriginal = document.querySelector("#tabla-reportes") ||
        document.querySelector("#modulo-reportes table") ||
        document.querySelector(".table-responsive table");

    if (!tablaOriginal || tablaOriginal.rows.length <= 1) {
        Swal.fire({ text: "No hay datos para exportar", icon: "info" });
        return;
    }

    let sumaTotal = 0;
    const filasCuerpo = tablaOriginal.querySelectorAll("tbody tr");
    filasCuerpo.forEach((fila) => {
        let valor = parseFloat(fila.cells[fila.cells.length - 1].innerText.replace(/[^0-9.-]+/g, "")) || 0;
        sumaTotal += valor;
    });

    const totalColumnas = tablaOriginal.rows[0].cells.length;
    const fechaArchivo = new Date().toLocaleDateString().replace(/\//g, '-');

    // Construcción del HTML forzando el estilo de Excel
    let htmlExcel = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"></head>
    <body>
    <table>
        <tr><td></td><td></td><td></td></tr>
        <tr><td></td><td></td><td></td>
            <td colspan="${totalColumnas}" style="text-align:center; font-family:Arial; font-size:13pt; font-style:italic;">Holiday Inn Express Merida Centro Historico</td>
        </tr>
        <tr><td></td><td></td><td></td>
            <td colspan="${totalColumnas}" style="text-align:center; font-family:Arial; font-size:18pt; font-weight:bold;">Reporte de Control de Comedor</td>
        </tr>
        <tr><td></td><td></td><td></td>
            <td colspan="${totalColumnas}" style="text-align:center; font-family:Arial; font-size:11pt; font-weight:bold;">REGISTRO COMPLETO DE ASISTENCIA Y COSTOS</td>
        </tr>
        <tr><td></td><td></td><td></td></tr>
    `;

    // Encabezados
    htmlExcel += '<tr><td></td><td></td><td></td>';
    Array.from(tablaOriginal.querySelectorAll('th')).forEach((th, i) => {
        let style = "font-family:Arial; font-weight:bold; text-align:center; border-top:1pt solid #000; border-bottom:2pt solid #000; height:35px;";
        if (i === 0) style += " border-right:2pt solid #000;";
        if (i === totalColumnas - 1) style += " border-left:2pt solid #000;";
        htmlExcel += `<td style="${style}">${th.innerText}</td>`;
    });
    htmlExcel += '</tr>';

    // Cuerpo con efecto Cebra
    Array.from(tablaOriginal.querySelectorAll('tbody tr')).forEach((tr, idx) => {
        let bg = (idx % 2 !== 0) ? "background-color:#f5f5f5;" : "";
        htmlExcel += '<tr><td></td><td></td><td></td>';
        Array.from(tr.cells).forEach((td, i) => {
            let style = `font-family:Arial; text-align:center; ${bg} height:28px;`;
            if (i === 0) style += " border-right:2pt solid #000; font-weight:bold;";
            if (i === totalColumnas - 1) style += " border-left:2pt solid #000; font-weight:bold;";
            htmlExcel += `<td style="${style}">${td.innerText}</td>`;
        });
        htmlExcel += '</tr>';
    });

    // Fila Suma Total
    htmlExcel += `
        <tr><td></td><td></td><td></td>
            <td colspan="${totalColumnas - 1}" style="text-align:right; font-family:Arial; font-weight:bold; border-top:2pt solid #000;">Suma total</td>
            <td style="text-align:center; font-family:Arial; font-weight:bold; border-top:2pt solid #000; border-left:2pt solid #000;">${sumaTotal}</td>
        </tr>
    </table></body></html>`;

    const blob = new Blob([htmlExcel], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Comedor_${fechaArchivo}.xls`;
    link.click();
}
//=====================================================================================================

// ============================== FUNCIÓN PARA EXPORTAR LA TABLA EN PDF ===============================
function exportarPDF() {
    let tablaOriginal = document.querySelector("#tabla-reportes") ||
        document.querySelector("#modulo-reportes table") ||
        document.querySelector(".table-responsive table");

    if (!tablaOriginal) return;

    const tablaParaPDF = tablaOriginal.cloneNode(true);
    tablaParaPDF.style.width = "100%";
    tablaParaPDF.style.borderCollapse = "collapse";
    tablaParaPDF.style.fontFamily = "Arial, sans-serif";

    // --- CÁLCULO DE SUMA TOTAL ---
    let sumaGeneral = 0;
    const filasCuerpo = tablaParaPDF.querySelectorAll("tbody tr");
    filasCuerpo.forEach(fila => {
        const celdas = fila.cells;
        const valorTotalFila = parseFloat(celdas[celdas.length - 1].innerText) || 0;
        sumaGeneral += valorTotalFila;

        // Estilo de filas
        fila.style.backgroundColor = (Array.from(filasCuerpo).indexOf(fila) % 2 === 0) ? "#f8f9fa" : "#ffffff";
    });

    // --- ESTILOS DE CELDAS ---
    const todasLasCeldas = tablaParaPDF.querySelectorAll("th, td");
    const numCols = tablaOriginal.rows[0].cells.length;

    todasLasCeldas.forEach((c, i) => {
        c.style.padding = "10px";
        c.style.textAlign = "center";

        // Columna 0 (FECHA): Borde derecho para la línea vertical
        if (i % numCols === 0) {
            c.style.borderRight = "1px solid #000";
        }
        // Última columna (TOTAL): Borde izquierdo
        if ((i + 1) % numCols === 0) {
            c.style.borderLeft = "1px solid #000";
            c.style.fontWeight = "bold";
        }
    });

    // --- AGREGAR FILA DE SUMA TOTAL ---
    const tfoot = document.createElement("tfoot");
    // El colspan cubre todas las columnas menos la última
    tfoot.innerHTML = `
        <tr>
            <td colspan="${numCols - 1}" style="text-align: left; padding: 10px; font-weight: bold; border-top: 1px solid #000;">Suma total</td>
            <td style="text-align: center; padding: 10px; font-weight: bold; border-top: 1px solid #000; border-left: 1px solid #000;">${sumaGeneral}</td>
        </tr>
    `;
    tablaParaPDF.appendChild(tfoot);

    const ths = tablaParaPDF.querySelectorAll("th");
    ths.forEach(th => {
        th.style.borderTop = "2px solid #000";
        th.style.borderBottom = "2px solid #000";
        th.style.padding = "10px";
    });

    const contenedor = document.createElement("div");
    contenedor.style.width = "1400px";
    contenedor.style.padding = "40px";
    contenedor.innerHTML = `
        <div style="text-align: center; font-family: Arial, sans-serif; margin-bottom: 20px;">
            <p style="font-style: italic; margin: 0;">Holiday Inn Express Merida Centro Historico</p>
            <h1 style="margin: 5px 0; font-size: 18pt;">Reporte de Control de Comedor</h1>
            <p style="font-weight: bold; margin: 0;">REGISTRO COMPLETO DE ASISTENCIAS</p>
        </div>
        <div style="border-top: 1px solid #000; margin-bottom: 20px;"></div>
    `;
    contenedor.appendChild(tablaParaPDF);

    html2pdf().set({
        margin: 10,
        filename: "Reporte_Control_Comedor.pdf",
        html2canvas: { scale: 3, width: 1400 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(contenedor).save();
}
//=====================================================================================================

//================================ FUNCIONES PARA EL MODAL DE EMPLEADOS ===============================

// Cargar lo botones desde la BD 
async function prepararBotonesDeptos() {
    const contenedor = document.getElementById('contenedor-deptos');
    contenedor.innerHTML = '<p style="font-size:0.8rem; color:gray;">Cargando departamentos...</p>';

    try {
        const resp = await fetch('http://localhost/front-comedor-reportes/empleados_backend.php?accion=obtener_deptos');
        const deptos = await resp.json();

        contenedor.innerHTML = '';

        deptos.forEach(depto => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'depto-btn-premium';
            btn.innerText = depto.nombre;

            // Se guarda el ID de la tabla departamentos
            btn.setAttribute('data-id', depto.id_departamento);

            btn.onclick = () => seleccionarDepto(depto.id_departamento, btn);
            contenedor.appendChild(btn);
        });
    } catch (error) {
        console.error("Error al obtener departamentos:", error);
        contenedor.innerHTML = '<p style="color:red;">Error al cargar datos</p>';
    }
}

function seleccionarDepto(id, elemento) {
    document.querySelectorAll('.depto-btn-premium').forEach(b => b.classList.remove('selected'));
    elemento.classList.add('selected');
    document.getElementById('emp-depto-id').value = id;
}

// Carga la tabla de empleados
async function cargarTablaEmpleados() {
    const tbody = document.getElementById('tabla-empleados-body');
    if (!tbody) return;

    try {
        const resp = await fetch('http://localhost/front-comedor-reportes/empleados_backend.php?accion=listar');
        const empleados = await resp.json();

        tbody.innerHTML = '';
        empleados.forEach(emp => {
            // Se usa el nombre que viene del join en el PHP
            const nombreDepto = emp.nombre_departamento || 'S/D';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${emp.nombreColaborador}</td>
                <td style="text-align: center;">${emp.idColaborador}</td>
                <td style="text-align: center;">${nombreDepto}</td>
                <td style="text-align: center;">${emp.puesto}</td>
                <td style="text-align: center;">
                    <button class="btn-qr-premium" onclick="imprimirQR('${emp.codigo_verificador}', '${emp.nombreColaborador}', '${emp.idColaborador}')">
                        🖨️ QR
                    </button>
                </td>
                <td style="text-align: center;">
                    <button class="btn-edit-premium" onclick="editarEmpleado(${JSON.stringify(emp).replace(/"/g, '&quot;')})">✏️</button>
                    <button class="btn-delete-premium" onclick="confirmarBorrado(${emp.id}, '${emp.nombreColaborador}')">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error al cargar empleados", e);
    }
}

// Mostrar y ocultar el modal
function abrirModalEmpleado() {
    document.getElementById('form-empleado').reset();
    document.getElementById('edit-id-empleado').value = '';
    document.getElementById('emp-depto-id').value = '';
    document.getElementById('titulo-modal-empleado').innerText = "Registrar Nuevo Colaborador";

    document.querySelectorAll('.depto-btn-premium').forEach(b => b.classList.remove('selected'));

    // Carga los botones desde la BD cada vez que se abre
    prepararBotonesDeptos();

    document.getElementById('modal-empleado').style.display = 'flex';
}

function cerrarModalEmpleado() {
    document.getElementById('modal-empleado').style.display = 'none';
}

// Evento de guardar
document.getElementById('form-empleado')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const deptoId = document.getElementById('emp-depto-id').value;
    if (!deptoId) {
        Swal.fire("Error", "Selecciona un departamento", "error");
        return;
    }

    const formData = new FormData();
    formData.append('id', document.getElementById('edit-id-empleado').value);
    formData.append('nombre', document.getElementById('emp-nombre').value);
    formData.append('idColaborador', document.getElementById('emp-idcolab').value);
    formData.append('depto_id', deptoId);
    formData.append('puesto', document.getElementById('emp-puesto').value);

    // Confirmación previa
    const confirm = await Swal.fire({
        title: '¿Confirmar datos?',
        text: `Se registrará a ${document.getElementById('emp-nombre').value}`,
        icon: 'question',
        showCancelButton: true
    });

    if (!confirm.isConfirmed) return;

    try {
        const resp = await fetch('http://localhost/front-comedor-reportes/empleados_backend.php?accion=guardar', {
            method: 'POST',
            body: formData
        });
        const res = await resp.json();

        if (res.status === 'success') {
            Swal.fire("Logrado", res.mensaje, "success");
            cerrarModalEmpleado();
            cargarTablaEmpleados();
        }
    } catch (error) {
        Swal.fire("Error", "No se pudo guardar", "error");
    }
});

// 
// Editar al empleado con sus datos existentes
async function editarEmpleado(emp) {
    abrirModalEmpleado();

    document.getElementById('titulo-modal-empleado').innerText = "Actualizar Colaborador";
    document.getElementById('edit-id-empleado').value = emp.id;
    document.getElementById('emp-nombre').value = emp.nombreColaborador;
    document.getElementById('emp-idcolab').value = emp.idColaborador;
    document.getElementById('emp-puesto').value = emp.puesto;

    // Se espera a que los botones se carguen de la BD
    await prepararBotonesDeptos();

    // Busca el botón que tenga el data-id igual al depto_Id del empleado
    const botonCorrecto = document.querySelector(`.depto-btn-premium[data-id="${emp.depto_Id}"]`);

    if (botonCorrecto) {
        //Selecciona el botón automáticamente
        seleccionarDepto(emp.depto_Id, botonCorrecto);
    }
}

async function confirmarBorrado(id, nombre) {
    const resultado = await Swal.fire({
        title: '¿Eliminar empleado?',
        html: `Estás a punto de dar de baja a:<br><b>${nombre}</b><br><br><small>El registro permanecerá en la base de datos pero no será visible en el panel.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (resultado.isConfirmed) {
        const formData = new FormData();
        formData.append('id', id);

        try {
            const resp = await fetch('http://localhost/front-comedor-reportes/empleados_backend.php?accion=borrar', {
                method: 'POST',
                body: formData
            });
            const res = await resp.json();
            if (res.status === 'success') {
                Swal.fire("Eliminado", "El empleado ha sido dado de baja.", "success");
                cargarTablaEmpleados();
            }
        } catch (e) {
            Swal.fire("Error", "No se pudo procesar la baja", "error");
        }
    }
}
//=======================================================================================================

//=============================== FUNCIONES PARA LA IMPRESIÓN DE LOS QRs ================================
function imprimirQR(codigo, nombre, idColaborador) {
    const contenedor = document.getElementById('contenedor-qr-grafico');
    contenedor.innerHTML = '';

    // Crear el contenedor interno que mantendrá el QR centrado
    const espacioQR = document.createElement('div');
    espacioQR.style.marginBottom = '15px';
    espacioQR.style.display = 'flex';
    espacioQR.style.justifyContent = 'center'; // Fuerza al QR gráfico a quedarse en el centro técnico
    contenedor.appendChild(espacioQR);

    // Generar el código QR dentro del espacio centrado
    new QRCode(espacioQR, {
        text: codigo,
        width: 160,
        height: 160,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    // Crear bloque de texto con los datos requeridos
    const infoTexto = document.createElement('div');
    infoTexto.style.textAlign = 'center';
    infoTexto.style.fontFamily = 'Arial, sans-serif';
    infoTexto.style.color = '#003876';

    infoTexto.innerHTML = `
        <div style="font-size: 1.1rem; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
            ${nombre}
        </div>
        <div style="font-size: 0.9rem; font-weight: 600; color: #003876;">
            ID: ${idColaborador}
        </div>
    `;

    // Adjuntar el texto abajo del QR
    contenedor.appendChild(infoTexto);

    // Desplegar el modal en pantalla
    document.getElementById('modal-imprimir').style.display = 'flex';
}
//====================================================================================================

// ======================== EVENTO PARA FILTRAR LA TABLA EN TIEMPO REAL ===============================
document.getElementById('buscador-empleados')?.addEventListener('input', function (e) {
    // Convertimos lo que escribió el usuario a minúsculas para que no importen las mayúsculas
    const textoBusqueda = e.target.value.toLowerCase().trim();

    // Agarramos todas las filas que están adentro del cuerpo de la tabla
    const filas = document.querySelectorAll('#tabla-empleados-body tr');

    filas.forEach(fila => {
        // Obtenemos el texto de cada celda de la fila actual
        const nombre = fila.children[0]?.innerText.toLowerCase() || '';
        const idColab = fila.children[1]?.innerText.toLowerCase() || '';
        const depto = fila.children[2]?.innerText.toLowerCase() || '';
        const puesto = fila.children[3]?.innerText.toLowerCase() || '';

        // Verificamos si el texto de búsqueda coincide con alguno de los campos
        if (
            nombre.includes(textoBusqueda) ||
            idColab.includes(textoBusqueda) ||
            depto.includes(textoBusqueda) ||
            puesto.includes(textoBusqueda)
        ) {
            // Si coincide, mostramos la fila
            fila.style.display = '';
        } else {
            // Si no coincide, la ocultamos de la pantalla
            fila.style.display = 'none';
        }
    });
});
//===================================================================================================== 

// =================================== FUNCIÓN PARA EL LECTOR DE QRS ==================================
let scannerComedor = null;

const audioExito = new Audio('assets/sonidos/exito.mp3');
const audioError = new Audio('assets/sonidos/error.mp3');

function iniciarEscanerQR() {
    if (scannerComedor) return;

    scannerComedor = new Html5QrcodeScanner("qr-reader", {
        fps: 10,
        qrbox: 250,
        rememberLastUsedCamera: true
    });

    scannerComedor.render(async (decodedText) => {
        const card = document.querySelector('.scanner-card');
        card.style.opacity = '0.5';
        card.style.transition = 'opacity 0.3s ease';

        scannerComedor.clear();

        try {
            const formData = new FormData();
            formData.append('codigo', decodedText);
            const resp = await fetch('validar_qr.php', { method: 'POST', body: formData });
            const data = await resp.json();

            if (data.status === 'success') {
                audioExito.play();
                Swal.fire("¡Bienvenido!", data.mensaje, "success");
            } else {
                audioError.play();
                Swal.fire("Acceso Denegado", data.mensaje, "error");
            }
        } catch (e) {
            audioError.play();
            Swal.fire("Error", "No se pudo conectar", "error");
        }

        setTimeout(() => {
            card.style.opacity = '1';
            scannerComedor = null;
            iniciarEscanerQR();
        }, 3000);
    });
}
// ===================================================================================================

// ========================== FUNCIÓN PARA LA TABLA REPORTES EMPLEADOS =============================
function cargarTablaReporteEmpleados() {
    fetch('reporte_empleados.php')
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('tabla-reporte-empleados-body');
            tbody.innerHTML = '';

            data.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-align: left; font-weight:bold;">${item.fecha_bonita}</td>
                    <td>${item.ama_llaves}</td>
                    <td>${item.mant}</td>
                    <td>${item.ayb}</td>
                    <td>${item.recepcion}</td>
                    <td>${item.admin}</td>
                    <td>${item.ventas}</td>
                    <td>${item.rh}</td>
                    <td>${item.seguridad}</td>
                    <td style="background:#003876; color:white; font-weight:bold;">${item.total}</td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(error => console.error('Error cargando reportes:', error));
}
// ====================================================================================================

// ============================== FUNCIÓN PARA EL FILTRADO DE BUSQUEDA ================================
document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'buscador-empleados') {
        const filtro = e.target.value.toLowerCase().trim();

        const contenedorPadre = e.target.closest('#modulo-reportes, #modulo-reporte-empleados');
        if (!contenedorPadre) return;

        const tbody = contenedorPadre.querySelector('tbody');
        if (!tbody) return;

        const filas = tbody.querySelectorAll('tr');

        filas.forEach(fila => {
            const celdaFecha = fila.cells[0];
            if (celdaFecha) {
                const textoFecha = celdaFecha.textContent.toLowerCase();
                fila.style.display = textoFecha.includes(filtro) ? '' : 'none';
            }
        });
    }
});
// ==================================================================================================

// ================================= FUNCIÓN EXPORTAR EXCEL =========================================
function exportarExcelEmpleados() {
    let tablaOriginal = document.querySelector("#tabla-reporte-empleados") ||
        document.querySelector("#modulo-reporte-empleados table") ||
        document.querySelector(".table-responsive table");

    if (!tablaOriginal || tablaOriginal.rows.length <= 1) {
        Swal.fire({ text: "No hay datos para exportar", icon: "info" });
        return;
    }

    let sumaTotal = 0;
    const filasCuerpo = tablaOriginal.querySelectorAll("tbody tr");
    filasCuerpo.forEach((fila) => {
        let valor = parseFloat(fila.cells[fila.cells.length - 1].innerText.replace(/[^0-9.-]+/g, "")) || 0;
        sumaTotal += valor;
    });

    const totalColumnas = tablaOriginal.rows[0].cells.length;
    const fechaArchivo = new Date().toLocaleDateString().replace(/\//g, '-');

    let htmlExcel = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"></head>
    <body>
    <table>
        <tr><td></td><td></td><td></td></tr>
        <tr><td></td><td></td><td></td>
            <td colspan="${totalColumnas}" style="text-align:center; font-family:Arial; font-size:13pt; font-style:italic;">Holiday Inn Express Merida Centro Historico</td>
        </tr>
        <tr><td></td><td></td><td></td>
            <td colspan="${totalColumnas}" style="text-align:center; font-family:Arial; font-size:18pt; font-weight:bold;">Reporte de Control de Comedor</td>
        </tr>
        <tr><td></td><td></td><td></td>
            <td colspan="${totalColumnas}" style="text-align:center; font-family:Arial; font-size:11pt; font-weight:bold;">REGISTRO COMPLETO DE ASISTENCIA Y COSTOS</td>
        </tr>
        <tr><td></td><td></td><td></td></tr>
    `;

    htmlExcel += '<tr><td></td><td></td><td></td>';
    Array.from(tablaOriginal.querySelectorAll('th')).forEach((th, i) => {
        let style = "font-family:Arial; font-weight:bold; text-align:center; border-top:1pt solid #000; border-bottom:2pt solid #000; height:35px;";
        if (i === 0) style += " border-right:2pt solid #000;";
        if (i === totalColumnas - 1) style += " border-left:2pt solid #000;";
        htmlExcel += `<td style="${style}">${th.innerText}</td>`;
    });
    htmlExcel += '</tr>';

    // Cuerpo con efecto Cebra
    Array.from(tablaOriginal.querySelectorAll('tbody tr')).forEach((tr, idx) => {
        let bg = (idx % 2 !== 0) ? "background-color:#f5f5f5;" : "";
        htmlExcel += '<tr><td></td><td></td><td></td>';
        Array.from(tr.cells).forEach((td, i) => {
            let style = `font-family:Arial; text-align:center; ${bg} height:28px;`;
            if (i === 0) style += " border-right:2pt solid #000; font-weight:bold;";
            if (i === totalColumnas - 1) style += " border-left:2pt solid #000; font-weight:bold;";
            htmlExcel += `<td style="${style}">${td.innerText}</td>`;
        });
        htmlExcel += '</tr>';
    });

    // Fila Suma Total
    htmlExcel += `
        <tr><td></td><td></td><td></td>
            <td colspan="${totalColumnas - 1}" style="text-align:right; font-family:Arial; font-weight:bold; border-top:2pt solid #000;">Suma total</td>
            <td style="text-align:center; font-family:Arial; font-weight:bold; border-top:2pt solid #000; border-left:2pt solid #000;">${sumaTotal}</td>
        </tr>
    </table></body></html>`;

    const blob = new Blob([htmlExcel], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Comedor_${fechaArchivo}.xls`;
    link.click();
}
// ==================================================================================================

// =================================== FUNCIÓN EXPORTAR PDF ===========================================
function exportarPDFEmpleados() {
    const tablaOriginal = document.getElementById("tabla-reporte-empleados");
    if (!tablaOriginal) return;

    const tablaParaPDF = tablaOriginal.cloneNode(true);
    tablaParaPDF.style.width = "100%";
    tablaParaPDF.style.borderCollapse = "collapse";
    tablaParaPDF.style.fontFamily = "Arial, sans-serif";

    // --- CÁLCULO DE SUMA TOTAL ---
    let sumaGeneral = 0;
    const filasCuerpo = tablaParaPDF.querySelectorAll("tbody tr");
    filasCuerpo.forEach(fila => {
        const celdas = fila.cells;
        const valorTotalFila = parseFloat(celdas[celdas.length - 1].innerText) || 0;
        sumaGeneral += valorTotalFila;

        // Estilo de filas
        fila.style.backgroundColor = (Array.from(filasCuerpo).indexOf(fila) % 2 === 0) ? "#f8f9fa" : "#ffffff";
    });

    // --- ESTILOS DE CELDAS ---
    const todasLasCeldas = tablaParaPDF.querySelectorAll("th, td");
    todasLasCeldas.forEach((c, i) => {
        c.style.padding = "10px";
        c.style.textAlign = "center";
        // Borde izquierdo en la columna TOTAL y borde derecho en FECHA
        if (i % tablaOriginal.rows[0].cells.length === 0) c.style.borderRight = "1px solid #000";
        if ((i + 1) % tablaOriginal.rows[0].cells.length === 0) {
            c.style.borderLeft = "1px solid #000";
            c.style.fontWeight = "bold"; // Negrita en columna TOTAL
        }
    });

    // --- AGREGAR FILA DE SUMA TOTAL ---
    const tfoot = document.createElement("tfoot");
    tfoot.innerHTML = `
        <tr>
            <td colspan="${tablaOriginal.rows[0].cells.length - 1}" style="text-align: right; padding: 10px; font-weight: bold; border-top: 1px solid #000;">Suma total</td>
            <td style="text-align: center; padding: 10px; font-weight: bold; border-top: 1px solid #000; border-left: 1px solid #000;">${sumaGeneral}</td>
        </tr>
    `;
    tablaParaPDF.appendChild(tfoot);

    const ths = tablaParaPDF.querySelectorAll("th");
    ths.forEach(th => {
        th.style.borderTop = "2px solid #000";
        th.style.borderBottom = "2px solid #000";
        th.style.padding = "10px";
    });

    const contenedor = document.createElement("div");
    contenedor.style.width = "1400px";
    contenedor.style.padding = "40px";
    contenedor.innerHTML = `
        <div style="text-align: center; font-family: Arial, sans-serif; margin-bottom: 20px;">
            <p style="font-style: italic; margin: 0;">Holiday Inn Express Merida Centro Historico</p>
            <h1 style="margin: 5px 0; font-size: 18pt;">Reporte de Colaboradores</h1>
            <p style="font-weight: bold; margin: 0;">REGISTRO DE ASISTENCIA DE COLABORADORES</p>
        </div>
        <div style="border-top: 1px solid #000; margin-bottom: 20px;"></div>
    `;
    contenedor.appendChild(tablaParaPDF);

    html2pdf().set({
        margin: 10,
        filename: "Reporte_Asistencia_Colaboradores.pdf",
        html2canvas: { scale: 3, width: 1400 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(contenedor).save();
}
// ==================================================================================================