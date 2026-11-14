/**
 * ARCHIVO: motivos_catalogo.go
 * UBICACIÓN: backend/internal/models/motivos_catalogo.go
 * DESCRIPCIÓN: Catálogo único de motivos (tablas core_motivos y
 * core_motivos_usos). Un motivo existe una sola vez y dice DÓNDE sirve con
 * códigos "modulo.operacion": personas.alta, personas.baja, personas.grupo y,
 * más adelante, los de otros módulos. Los gestiona solo el superadmin.
 */

package models

// UsoMotivo: dónde sirve un motivo y si está activo para ese uso.
type UsoMotivo struct {
	Uso    string `json:"uso" gorm:"column:uso"`
	Activo bool   `json:"activo" gorm:"column:activo"`
	Orden  int    `json:"orden" gorm:"column:orden"`
}

// MotivoCatalogo: un motivo con todos sus usos (lo ve el superadmin, también
// los desactivados).
type MotivoCatalogo struct {
	ID     int64       `json:"id"`
	Nombre string      `json:"nombre"`
	Usos   []UsoMotivo `json:"usos"`
}

// OpcionMotivo: una opción del desplegable de un uso (solo motivos activos).
type OpcionMotivo struct {
	ID     int64  `json:"id" gorm:"column:id"`
	Nombre string `json:"nombre" gorm:"column:nombre"`
	Orden  int    `json:"orden" gorm:"column:orden"`
}
