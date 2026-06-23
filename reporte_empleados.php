<?php
$conexion = mysqli_connect("localhost", "root", "", "hotel_reportes");

$sql = "SELECT 
            DATE(l.fh_registro) as fecha_raw,
            SUM(CASE WHEN p.depto_id = 1 THEN 1 ELSE 0 END) as ama_llaves,
            SUM(CASE WHEN p.depto_id = 2 THEN 1 ELSE 0 END) as mant,
            SUM(CASE WHEN p.depto_id = 3 THEN 1 ELSE 0 END) as ayb,
            SUM(CASE WHEN p.depto_id = 4 THEN 1 ELSE 0 END) as recepcion,
            SUM(CASE WHEN p.depto_id = 5 THEN 1 ELSE 0 END) as admin,
            SUM(CASE WHEN p.depto_id = 6 THEN 1 ELSE 0 END) as ventas,
            SUM(CASE WHEN p.depto_id = 7 THEN 1 ELSE 0 END) as rh,
            SUM(CASE WHEN p.depto_id = 8 THEN 1 ELSE 0 END) as seguridad,
            COUNT(*) as total
        FROM lector_qrs l
        JOIN personalmiddt p ON l.id_colaborador = p.idColaborador
        GROUP BY DATE(l.fh_registro)
        ORDER BY fecha_raw DESC";

$resultado = mysqli_query($conexion, $sql);
$datos = [];

$dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

while($row = mysqli_fetch_assoc($resultado)) {
    $timestamp = strtotime($row['fecha_raw']);
    $nombreDia = $dias[date('w', $timestamp)];
    
    $row['fecha_bonita'] = $nombreDia . " " . date("d/m/Y", $timestamp);
    
    $datos[] = $row;
}

echo json_encode($datos);
?>