/**
 * ARCHIVO: repository.go
 * UBICACIÓN: internal/repository/repository.go
 * DESCRIPCIÓN: Capa de persistencia. Contiene todas las consultas SQL/GORM.
 * Se encarga de la extracción pura de datos sin aplicar lógica de negocio.
 */

package repository

import (
	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/monitor"
	"time"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// --- USUARIOS Y AUTENTICACIÓN ---

// GetUserForLogin extrae los datos del usuario (Admin o Persona)
// Corregido: Se añade .Error al final de cada consulta
// GetUserForLogin contiene tu query original con todos los campos para el Frontend
func (r *Repository) GetUserForLogin(username string) (*models.Usuario, error) {
    var u models.Usuario
    
    // Intento 1: Administradores
    err := r.db.Table("core_usuarios").
        Select(`core_usuarios.*, core_personas.apellido_nombre as nombre_completo, core_personas.url_imagen as foto_url, core_personas.email, core_personas.contacto, core_personas.estado, core_congregaciones.nombre as congregacion_nombre, core_congregaciones.numero_congregacion, core_congregaciones.zona_horaria, core_congregaciones.region, core_congregaciones.pais, core_congregaciones.provincia_estado as provincia, core_congregaciones.partido, core_congregaciones.ciudad, core_congregaciones.direccion`).
        Joins("JOIN core_personas ON core_personas.id = core_usuarios.persona_id").
        Joins("JOIN core_congregaciones ON core_congregaciones.id = core_usuarios.congregacion_id").
        Where("LOWER(core_usuarios.username_temp) = ? AND core_personas.estado = 'ALTA'", username).First(&u).Error

    if err != nil {
        // Si el error NO es "No encontrado", es un error de conexión/base de datos
        if err.Error() != "record not found" {
            monitor.TripCircuit() // <--- PROTECCIÓN ACTIVA: Avisamos al monitor
            return nil, err
        }

        // Intento 2: Persona normal
        err = r.db.Table("core_personas").
            Select(`core_personas.id as persona_id, core_personas.apellido_nombre as nombre_completo, core_personas.email, core_personas.contacto, core_personas.url_imagen as foto_url, core_personas.username_temp, core_personas.password_hash, core_personas.estado, core_congregaciones.nombre as congregacion_nombre, core_congregaciones.numero_congregacion, core_congregaciones.zona_horaria, core_congregaciones.region, core_congregaciones.pais, core_congregaciones.provincia_estado as provincia, core_congregaciones.partido, core_congregaciones.ciudad, core_congregaciones.direccion`).
            Joins("JOIN core_congregaciones ON core_congregaciones.id = core_personas.congregacion_id").
            Where("LOWER(core_personas.username_temp) = ? AND core_personas.estado = 'ALTA'", username).First(&u).Error
        
        if err != nil && err.Error() != "record not found" {
            monitor.TripCircuit() // <--- PROTECCIÓN ACTIVA
            return nil, err
        }
    }

    // Si llegamos aquí con éxito, reseteamos errores para mantener el circuito cerrado
    monitor.ResetFailures()
    return &u, err
}

func (r *Repository) UserExists(username string) bool {
	var count int64
	r.db.Table("core_usuarios").Where("username_temp = ?", username).Count(&count)
	if count > 0 {
		return true
	}
	r.db.Table("core_personas").Where("username_temp = ?", username).Count(&count)
	return count > 0
}

func (r *Repository) GetUserByEmail(email string) (*models.Usuario, error) {
	var u models.Usuario
	err := r.db.Table("core_usuarios").
		Select("core_usuarios.username_temp, core_personas.id as persona_id, core_congregaciones.numero_congregacion, core_congregaciones.nombre as congregacion_nombre").
		Joins("JOIN core_personas ON core_personas.id = core_usuarios.persona_id").
		Joins("JOIN core_congregaciones ON core_congregaciones.id = core_usuarios.congregacion_id").
		Where("core_personas.email = ?", email).First(&u).Error
	return &u, err
}

// --- GESTIÓN DE PIN Y VERIFICACIÓN ---

func (r *Repository) GetCongregacionName(num string) string {
	var nombre string
	r.db.Table("core_congregaciones").Select("nombre").Where("numero_congregacion = ?", num).Scan(&nombre)
	return nombre
}

func (r *Repository) SavePin(pin string) error {
	return r.db.Table("core_verificaciones").Create(map[string]interface{}{
		"pin": pin, "tipo": "SECURITY_CHECK", "utilizado": false, "expira_at": time.Now().UTC().Add(15 * time.Minute),
	}).Error
}

func (r *Repository) InvalidateOldPines() {
	r.db.Table("core_verificaciones").Where("tipo = ? AND utilizado = false", "SECURITY_CHECK").Updates(map[string]interface{}{"utilizado": true})
}

func (r *Repository) ConsumePin(pin string) error {
	var v struct {
		Id       int
		ExpiraAt time.Time
	}
	err := r.db.Table("core_verificaciones").Where("pin = ? AND utilizado = false", pin).First(&v).Error
	if err != nil || time.Now().UTC().After(v.ExpiraAt) {
		return gorm.ErrRecordNotFound
	}
	return r.db.Table("core_verificaciones").Where("id = ?", v.Id).Update("utilizado", true).Error
}

// FindEmailByIDAndCong busca el email comparando ID de persona y número de congregación
func (r *Repository) FindEmailByIDAndCong(personaID, numCong string) (string, error) {
	var email string
	err := r.db.Table("core_personas").
		Select("core_personas.email").
		Joins("JOIN core_congregaciones ON core_congregaciones.id = core_personas.congregacion_id").
		Where("core_personas.id = ? AND core_congregaciones.numero_congregacion = ?", personaID, numCong).
		Scan(&email).Error
	return email, err
}

// GetAllContactsForRecovery trae todos los contactos para validación telefónica (Lógica de recuperación)
func (r *Repository) GetAllContactsForRecovery() ([]struct {
	Email    string
	Contacto string
	Id       int
}, error) {
	var results []struct {
		Email    string
		Contacto string
		Id       int
	}
	err := r.db.Table("core_personas").Select("email, contacto, id").Scan(&results).Error
	return results, err
}

// --- MÓDULO DE PERFIL Y SEGURIDAD ---

func (r *Repository) UpdateProfileField(personaID, campo, valor string) error {
	if campo == "username" {
		return r.db.Transaction(func(tx *gorm.DB) error {
			tx.Table("core_personas").Where("id = ?", personaID).Update("username_temp", valor)
			return tx.Table("core_usuarios").Where("persona_id = ?", personaID).Update("username_temp", valor).Error
		})
	}
	return r.db.Table("core_personas").Where("id = ?", personaID).Update(campo, valor).Error
}

func (r *Repository) UpdateFoto(personaID, url string) error {
	return r.db.Table("core_personas").Where("id = ?", personaID).Update("url_imagen", url).Error
}

func (r *Repository) SuspendAccount(personaID, usuarioID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		tx.Table("core_personas").Where("id = ?", personaID).Update("estado", "BAJA")
		if usuarioID != "" {
			tx.Table("core_usuarios").Where("id = ?", usuarioID).Update("estado_cuenta", "suspendida")
		}
		return nil
	})
}

func (r *Repository) SaveSecurityLog(titulo, desc string) error {
	return r.db.Table("core_seguridad_info").Create(map[string]interface{}{
		"contenido": titulo, "descripcion_larga": desc, "updated_at": time.Now(),
	}).Error
}

func (r *Repository) GetLatestSecurityInfo() (map[string]interface{}, error) {
	var info struct {
		Contenido string
		UpdatedAt time.Time
	}
	err := r.db.Table("core_seguridad_info").Order("updated_at desc").First(&info).Error
	return map[string]interface{}{"contenido": info.Contenido, "updated_at": info.UpdatedAt}, err
}

// Lista de destinatarios para boletín
type Destinatario struct {
	Email              string
	NombreCompleto     string
	Username           string
	CongregacionNombre string
}

func (r *Repository) GetActiveMembersForBroadcast() ([]Destinatario, error) {
	var lista []Destinatario
	err := r.db.Table("core_personas").
		Select("core_personas.email, core_personas.apellido_nombre as nombre_completo, core_personas.username_temp as username, core_congregaciones.nombre as congregacion_nombre").
		Joins("JOIN core_congregaciones ON core_congregaciones.id = core_personas.congregacion_id").
		Where("core_personas.estado = 'ALTA' AND core_personas.email IS NOT NULL AND core_personas.email != ''").
		Scan(&lista).Error
	return lista, err
}

func (r *Repository) CreateSecurityLog(titulo, desc string) error {
	return r.db.Table("core_seguridad_info").Create(map[string]interface{}{
		"contenido": titulo, "descripcion_larga": desc, "updated_at": time.Now(),
	}).Error
}

func (r *Repository) UpdatePassword(personaID string, hash string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		tx.Table("core_usuarios").Where("persona_id = ?", personaID).Updates(map[string]interface{}{"password_hash": hash, "password_changed_at": time.Now()})
		return tx.Table("core_personas").Where("id = ?", personaID).Updates(map[string]interface{}{"password_hash": hash, "password_changed_at": time.Now()}).Error
	})
}

// --- QUERIES DE SEGURIDAD Y PIN ---

func (r *Repository) CreatePin(pin string, expira time.Time) error {
	return r.db.Table("core_verificaciones").Create(map[string]interface{}{
		"pin": pin, "tipo": "SECURITY_CHECK", "utilizado": false, "expira_at": expira,
	}).Error
}

func (r *Repository) VerifyPin(pin string) (int, error) {
	var v struct {
		Id       int
		ExpiraAt time.Time
	}
	err := r.db.Table("core_verificaciones").Where("pin = ? AND utilizado = false", pin).First(&v).Error
	if err != nil || time.Now().UTC().After(v.ExpiraAt) {
		return 0, gorm.ErrRecordNotFound
	}
	r.db.Table("core_verificaciones").Where("id = ?", v.Id).Update("utilizado", true)
	return v.Id, nil
}

// SaveSecurityInfo guarda un registro simple de información de seguridad
func (r *Repository) SaveSecurityInfo(contenido string) error {
	return r.db.Table("core_seguridad_info").Create(map[string]interface{}{
		"contenido":  contenido,
		"updated_at": time.Now(),
	}).Error
}

// --- QUERIES DE CATÁLOGO ---
func (r *Repository) GetPublicaciones() ([]models.Publicacion, error) {
	var pubs []models.Publicacion
	err := r.db.Table("pub_catalogo").Order("orden asc").Find(&pubs).Error
	return pubs, err
}
