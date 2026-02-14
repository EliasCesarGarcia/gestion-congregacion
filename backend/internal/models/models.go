package models

type Publicacion struct {
	ID                string `gorm:"primaryKey" json:"id"`
	NombrePublicacion string `json:"nombre_publicacion"`
	Tipo              string `json:"tipo"`
	Siglas            string `json:"siglas"`
	URLPortada        string `json:"url_portada"`
}

type Usuario struct {
    ID                 string `gorm:"primaryKey" json:"id"`
    PersonaID          int    `json:"persona_id" gorm:"column:persona_id"`
    NombreCompleto     string `json:"nombre_completo" gorm:"column:nombre_completo"`
    Email              string `json:"email" gorm:"column:email"`
    Contacto           string `json:"contacto" gorm:"column:contacto"`
    Estado             string `json:"estado" gorm:"column:estado"` // ALTA/BAJA
    FotoURL            string `json:"foto_url" gorm:"column:foto_url"`
    CongregacionID     string `json:"congregacion_id"`
    CongregacionNombre string `json:"congregacion_nombre" gorm:"column:congregacion_nombre"`
    NumeroCongregacion string `json:"numero_congregacion" gorm:"column:numero_congregacion"`
    // Campos de ubicación restaurados
    Region             string `json:"region" gorm:"column:region"`
    Pais               string `json:"pais" gorm:"column:pais"`
    Provincia          string `json:"provincia" gorm:"column:provincia"`
    Partido            string `json:"partido" gorm:"column:partido"`
    Ciudad             string `json:"ciudad" gorm:"column:ciudad"`
    Direccion          string `json:"direccion" gorm:"column:direccion"`
    
    EsAdminLocal       bool   `json:"es_admin_local"`
    Username           string `json:"username" gorm:"column:username_temp"`
    PasswordHash       string `json:"-" gorm:"column:password_hash"` 
    PasswordChangedAt  string `json:"password_changed_at" gorm:"column:password_changed_at"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}