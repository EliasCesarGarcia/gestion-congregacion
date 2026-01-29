package models

// Modelo para el catálogo global de publicaciones
type Publicacion struct {
	ID                string `gorm:"primaryKey" json:"id"`
	NombrePublicacion string `json:"nombre_publicacion"`
	Tipo              string `json:"tipo"`
	Siglas            string `json:"siglas"`
	URLPortada        string `json:"url_portada"`
}

// Modelo extendido de Usuario (incluye datos de Persona y Congregación)
type Usuario struct {
	ID                 string `gorm:"primaryKey" json:"id"`
	PersonaID          int    `json:"persona_id"`
	NombreCompleto     string `json:"nombre_completo" gorm:"column:nombre_completo"`
	Email              string `json:"email" gorm:"column:email"`
	FotoURL            string `json:"foto_url" gorm:"column:foto_url"`
	CongregacionID     string `json:"congregacion_id"`
	CongregacionNombre string `json:"congregacion_nombre" gorm:"column:congregacion_nombre"`
	NumeroCongregacion string `json:"numero_congregacion" gorm:"column:numero_congregacion"`
	Ciudad             string `json:"ciudad" gorm:"column:ciudad"`
	Partido            string `json:"partido" gorm:"column:partido"`
	Provincia          string `json:"provincia" gorm:"column:provincia"`
	Direccion          string `json:"direccion" gorm:"column:direccion"`
	Pais               string `json:"pais" gorm:"column:pais"`
	EsAdminLocal       bool   `json:"es_admin_local"`
	Username           string `json:"username" gorm:"column:username_temp"`
	PasswordChangedAt  string `json:"password_changed_at" gorm:"column:password_changed_at"`
	SecurityUpdatedAt  string `json:"security_updated_at" gorm:"column:security_updated_at"`
}

// Estructura para recibir la solicitud de login desde React
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}