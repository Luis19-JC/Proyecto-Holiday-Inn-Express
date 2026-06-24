<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$conexion = mysqli_connect("localhost", "root", "", "hotel_reportes");

if (!$conexion) {
    die(json_encode(["error" => "Error de conexión"]));
}

$sql = "SELECT 
            DATE_FORMAT(fh, '%Y-%m-%d') as fecha_id,
            SUM(CASE WHEN tipo = 1 THEN num ELSE 0 END) as h_normal,
            SUM(CASE WHEN tipo = 2 THEN num ELSE 0 END) as de_adulto,
            SUM(CASE WHEN tipo = 3 THEN num ELSE 0 END) as de_nino,
            SUM(CASE WHEN tipo = 4 THEN num ELSE 0 END) as dp_adulto,
            SUM(CASE WHEN tipo = 5 THEN num ELSE 0 END) as dp_nino,
            SUM(CASE WHEN tipo = 6 THEN num ELSE 0 END) as d_colaborador,
            SUM(CASE WHEN tipo = 7 THEN num ELSE 0 END) as ama_llaves,
            SUM(CASE WHEN tipo = 8 THEN num ELSE 0 END) as mante,
            SUM(CASE WHEN tipo = 9 THEN num ELSE 0 END) as ayb,
            SUM(CASE WHEN tipo = 10 THEN num ELSE 0 END) as recep,
            SUM(CASE WHEN tipo = 11 THEN num ELSE 0 END) as admini,
            SUM(CASE WHEN tipo = 12 THEN num ELSE 0 END) as ventas,
            SUM(CASE WHEN tipo = 13 THEN num ELSE 0 END) as rh,
            SUM(CASE WHEN tipo = 14 THEN num ELSE 0 END) as segu,
            SUM(CASE WHEN tipo = 15 THEN num ELSE 0 END) as cor_eje,
            SUM(CASE WHEN tipo = 16 THEN num ELSE 0 END) as cor_exter,
            SUM(num) as gran_total
        FROM registros_dia
        GROUP BY fecha_id
        ORDER BY fecha_id DESC";

$res = mysqli_query($conexion, $sql);
$data = [];

while($row = mysqli_fetch_assoc($res)) {
    
    $timestamp = strtotime($row['fecha_id']);
    

    $dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    $nombreDia = $dias[date('w', $timestamp)];
    

    $row['fecha_bonita'] = $nombreDia . " " . date("d/m/Y", $timestamp);
    
    $data[] = $row;
}

echo json_encode($data);
mysqli_close($conexion);
?>






