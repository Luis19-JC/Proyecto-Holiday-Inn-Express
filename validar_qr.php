<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$conexion = mysqli_connect("localhost", "root", "", "hotel_reportes");

$codigo = mysqli_real_escape_string($conexion, $_POST['codigo'] ?? '');
$hoy = date('Y-m-d');

// Busca si el código existe
$sql = "SELECT p.id, p.nombreColaborador, p.activo, p.idColaborador 
        FROM qrs q
        JOIN personalmiddt p ON q.idEmpleado = p.id
        WHERE q.codigo_verificador = '$codigo'";

$res = mysqli_query($conexion, $sql);
$emp = mysqli_fetch_assoc($res);

if (!$emp) {
    echo json_encode(["status" => "error", "mensaje" => "QR no válido."]);
    exit; 
}

if (strtolower($emp['activo']) !== 'si') {
    echo json_encode(["status" => "error", "mensaje" => "Acceso denegado: Empleado de baja."]);
    exit; 
}

// Verifica duplicados
$check = mysqli_query($conexion, "SELECT id FROM lector_qrs 
                                  WHERE id_colaborador = '{$emp['idColaborador']}' 
                                  AND DATE(fh_registro) = CURDATE()");

if (mysqli_num_rows($check) > 0) {
    echo json_encode(["status" => "error", "mensaje" => "QR ya utilizado el día de hoy."]);
    exit;
}

// Si llega aquí, es porque pasó todas las validaciones
$insert = "INSERT INTO lector_qrs (id_colaborador, codigo_verificador, fh_registro) 
           VALUES ('{$emp['idColaborador']}', '$codigo', NOW())";
mysqli_query($conexion, $insert);

echo json_encode(["status" => "success", "mensaje" => "Bienvenido al comedor, " . $emp['nombreColaborador']]);

mysqli_close($conexion);
?>