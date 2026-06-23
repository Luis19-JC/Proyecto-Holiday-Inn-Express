<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$servidor = "localhost";
$usuario = "root";
$contrasena = "";
$base_datos = "hotel_reportes";

$conexion = mysqli_connect($servidor, $usuario, $contrasena, $base_datos);

if (!$conexion) {
    http_response_code(500);
    echo json_encode(["error" => "Error de conexión"]);
    exit;
}

// Validación de la Key 
$key_esperada = "pi31416";
$key_recibida = $_POST['key'] ?? '';

if ($key_recibida !== $key_esperada) {
    http_response_code(403);
    echo json_encode(["error" => "Acceso denegado"]);
    exit;
}

if (isset($_POST['info']) && is_array($_POST['info'])) {
    
    $exitos = 0;

    foreach ($_POST['info'] as $registro) {
        $tipo = (int)$registro['tipo']; 
        $num  = (int)$registro['num'];
        $fh   = mysqli_real_escape_string($conexion, $registro['timestamp']);

        $sql = "INSERT INTO registros_dia (tipo, num, fh) VALUES ($tipo, $num, '$fh')";
        
        if (mysqli_query($conexion, $sql)) {
            $exitos++;
        }
    }

    echo json_encode([
        "status" => "success",
        "mensaje" => "Se insertaron $exitos registros correctamente."
    ]);

} else {
    echo json_encode(["error" => "No hay datos para procesar"]);
}

mysqli_close($conexion);
?>