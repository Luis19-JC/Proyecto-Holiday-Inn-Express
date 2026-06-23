<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$conexion = mysqli_connect("localhost", "root", "", "hotel_reportes");

if (!$conexion) {
    die(json_encode(["error" => "Error de conexión"]));
}

$accion = $_GET['accion'] ?? '';

// Leer empleados con join para traer nombre de depto
if ($accion === 'listar') {
    $sql = "SELECT p.*, q.codigo_verificador, d.nombre as nombre_departamento
            FROM personalmiddt p
            LEFT JOIN qrs q ON p.id = q.idEmpleado
            LEFT JOIN departamentos d ON p.depto_Id = d.id_departamento
            WHERE p.activo = 'Si' 
            ORDER BY p.id DESC";
    
    $res = mysqli_query($conexion, $sql);
    $empleados = [];
    while($row = mysqli_fetch_assoc($res)) {
        $empleados[] = $row;
    }
    echo json_encode($empleados);
}

// Agregar o actualizar empleado
if ($accion === 'guardar') {
    $id = $_POST['id'] ?? ''; 
    $nombre = mysqli_real_escape_string($conexion, $_POST['nombre']);
    $idColab = mysqli_real_escape_string($conexion, $_POST['idColaborador']);
    $depto = (int)$_POST['depto_id'];
    $puesto = mysqli_real_escape_string($conexion, $_POST['puesto']);

    if ($id === '') {
        $sql = "INSERT INTO personalmiddt (nombreColaborador, idColaborador, depto_Id, puesto, activo, fh_cre) 
                VALUES ('$nombre', '$idColab', $depto, '$puesto', 'Si', NOW())";
        
        if (mysqli_query($conexion, $sql)) {
            $nuevoId = mysqli_insert_id($conexion);
            $uid = uniqid();
            $ts = time();
            $codigo = md5($uid . $ts);
            
            $sqlQR = "INSERT INTO qrs (codigo_verificador, idEmpleado, fh_creacion) 
                      VALUES ('$codigo', $nuevoId, NOW())";
            mysqli_query($conexion, $sqlQR);
            
            echo json_encode(["status" => "success", "mensaje" => "Empleado creado"]);
        }
    } else {
        $sql = "UPDATE personalmiddt SET 
                nombreColaborador = '$nombre', 
                idColaborador = '$idColab', 
                depto_Id = $depto, 
                puesto = '$puesto',
                fh_act = NOW() 
                WHERE id = $id";
        
        if (mysqli_query($conexion, $sql)) {
            echo json_encode(["status" => "success", "mensaje" => "Empleado actualizado"]);
        }
    }
}

// Borrar empleado
if ($accion === 'borrar') {
    $id = (int)$_POST['id'];
    $sql = "UPDATE personalmiddt SET activo = 'No', fechaBaja = NOW() WHERE id = $id";
    if (mysqli_query($conexion, $sql)) {
        echo json_encode(["status" => "success"]);
    }
}

// Obtiene los departamentos 
if ($accion === 'obtener_deptos') {
    $sql = "SELECT id_departamento, nombre FROM departamentos ORDER BY nombre ASC";
    $res = mysqli_query($conexion, $sql);
    $deptos = [];
    while($row = mysqli_fetch_assoc($res)) {
        $deptos[] = $row;
    }
    echo json_encode($deptos);
}

mysqli_close($conexion);
?>