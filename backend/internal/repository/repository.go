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
	"strings"
	"time"

	"gorm.io/gorm"

	"context"
	"log"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// --- USUARIOS Y AUTENTICACIÓN ---

// GetUserForLogin extrae los datos del usuario (Admin o Persona)
func (r *Repository) GetUserForLogin(username string) (*models.Usuario, error) {
	var u models.Usuario

	// PROTECCIÓN POR LATENCIA: si la DB tarda más de 5s, cortamos la conexión
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Intento 1: usuarios con acceso en core_usuarios (hoy, el dueño)
	err := r.db.WithContext(ctx).Table("core_usuarios").
		Select(`
			core_usuarios.id,
			core_usuarios.persona_id,
			core_usuarios.username_temp as username,
			core_usuarios.password_hash,
			core_personas.apellido_nombre as nombre_completo,
			core_personas.url_imagen as foto_url,
			core_personas.email,
			core_personas.contacto,
			core_personas.estado,
			COALESCE(core_personas.rol_app, 'publicador') as rol_app,
			COALESCE(core_congregaciones.id::text, '') as congregacion_id,
			COALESCE(core_congregaciones.activa, false) as cong_activa,
			core_congregaciones.nombre as congregacion_nombre,
			core_congregaciones.numero_congregacion,
			core_congregaciones.zona_horaria,
			core_congregaciones.direccion,
			core_congregaciones.ciudad,
			core_congregaciones.partido,
			core_congregaciones.provincia_estado as provincia,
			core_congregaciones.pais,
			core_congregaciones.region
		`).
		Joins("LEFT JOIN core_personas ON core_personas.id = core_usuarios.persona_id").
		Joins("LEFT JOIN core_congregaciones ON core_congregaciones.id = core_usuarios.congregacion_id").
		Where("LOWER(core_usuarios.username_temp) = LOWER(?) AND core_personas.estado = 'ALTA'", username).
		First(&u).Error

	if err != nil {
		// Si es timeout o error de red, disparamos el breaker
		if err != gorm.ErrRecordNotFound {
			log.Printf("❌ DB error en login (consulta 1): %v", err)
			monitor.TripCircuit()
			return nil, err
		}

		// Intento 2: persona normal en core_personas (los hermanos)
		err = r.db.WithContext(ctx).Table("core_personas").
			Select(`
				core_personas.id as persona_id,
				core_personas.apellido_nombre as nombre_completo,
				core_personas.email,
				core_personas.contacto,
				core_personas.url_imagen as foto_url,
				core_personas.username_temp as username,
				core_personas.password_hash,
				core_personas.estado,
				COALESCE(core_personas.rol_app, 'publicador') as rol_app,
				COALESCE(core_congregaciones.id::text, '') as congregacion_id,
				COALESCE(core_congregaciones.activa, false) as cong_activa,
				core_congregaciones.nombre as congregacion_nombre,
				core_congregaciones.numero_congregacion,
				core_congregaciones.zona_horaria,
				core_congregaciones.direccion,
				core_congregaciones.ciudad,
				core_congregaciones.partido,
				core_congregaciones.provincia_estado as provincia,
				core_congregaciones.pais,
				core_congregaciones.region
			`).
			Joins("LEFT JOIN core_congregaciones ON core_congregaciones.id = core_personas.congregacion_id").
			Where("LOWER(core_personas.username_temp) = LOWER(?) AND core_personas.estado = 'ALTA'", username).
			First(&u).Error

		if err != nil {
			if err != gorm.ErrRecordNotFound {
				log.Printf("❌ DB error en login (consulta 2): %v", err)
				monitor.TripCircuit()
			}
			return nil, err
		}
	}

	monitor.ResetFailures()
	return &u, nil
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

// GetActor lee de la base quién es la persona del token: su congregación,
// su rol y si su cuenta y su congregación siguen activas.
func (r *Repository) GetActor(personaID string) (*models.Actor, error) {
	var a models.Actor

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res := r.db.WithContext(ctx).Table("core_personas").
		Select(`core_personas.id::text as persona_id,
			COALESCE(core_personas.congregacion_id::text, '') as congregacion_id,
			COALESCE(core_personas.rol_app, 'publicador') as rol_app,
			COALESCE(core_personas.estado, '') as estado,
			COALESCE(core_congregaciones.activa, false) as cong_activa`).
		Joins("LEFT JOIN core_congregaciones ON core_congregaciones.id = core_personas.congregacion_id").
		Where("core_personas.id::text = ?", personaID).
		Limit(1).Scan(&a)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &a, nil
}

// ListPersonas devuelve una página de personas en ALTA, sin datos sensibles.
// Si todas es false, filtra por la congregación indicada (regla de oro).
func (r *Repository) ListPersonas(congregacionID string, todas bool, busqueda string, limit, offset int) ([]models.PersonaResumen, int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Búsqueda por nombre: se recorta a 60 caracteres y se escapan \, % y _
	// para que el texto del usuario nunca actúe como comodín.
	busqueda = strings.TrimSpace(busqueda)
	if runas := []rune(busqueda); len(runas) > 60 {
		busqueda = string(runas[:60])
	}
	patron := ""
	if busqueda != "" {
		esc := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(busqueda)
		patron = "%" + esc + "%"
	}

	base := func() *gorm.DB {
		q := r.db.WithContext(ctx).Table("core_personas").Where("core_personas.estado = 'ALTA'")
		if !todas {
			q = q.Where("core_personas.congregacion_id::text = ?", congregacionID)
		}
		if patron != "" {
			q = q.Where("core_personas.apellido_nombre ILIKE ?", patron)
		}
		return q
	}

	var total int64
	if err := base().Count(&total).Error; err != nil {
		return nil, 0, err
	}

	lista := []models.PersonaResumen{}
	err := base().
		Select(`core_personas.id as id,
			core_personas.apellido_nombre as nombre_completo,
			COALESCE(core_personas.rol_app, 'publicador') as rol_app,
			COALESCE(core_personas.estado, '') as estado,
			COALESCE(core_personas.url_imagen, '') as foto_url,
			COALESCE(core_personas.congregacion_id::text, '') as congregacion_id`).
		Order("core_personas.apellido_nombre asc, core_personas.id asc").
		Limit(limit).Offset(offset).
		Scan(&lista).Error
	if err != nil {
		return nil, 0, err
	}
	return lista, total, nil
}

// BuscarActor es como GetActor, pero devuelve (nil, nil) si la persona no existe.
func (r *Repository) BuscarActor(personaID string) (*models.Actor, error) {
	a, err := r.GetActor(personaID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return a, nil
}

// GetMisModulos: si todos es true devuelve todos los módulos con nivel 3.
// Si no, los comunes más los que la persona tiene asignados.
func (r *Repository) GetMisModulos(personaID string, todos bool) ([]models.Modulo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.Modulo{}
	var res *gorm.DB
	if todos {
		res = r.db.WithContext(ctx).Table("core_modulos").
			Select("id, COALESCE(nombre, '') as nombre, COALESCE(descripcion, '') as descripcion, es_comun, 3 as nivel_acceso").
			Where("activo = true").
			Order("nombre asc").Scan(&lista)
	} else {
		res = r.db.WithContext(ctx).Table("core_modulos as m").
			Select("m.id, COALESCE(m.nombre, '') as nombre, COALESCE(m.descripcion, '') as descripcion, m.es_comun, COALESCE(p.nivel_acceso, 1) as nivel_acceso").
			Joins("LEFT JOIN core_permisos_modulos p ON p.modulo_id = m.id AND p.persona_id::text = ?", personaID).
			Where("m.activo = true AND (m.es_comun = true OR p.id IS NOT NULL)").
			Order("m.nombre asc").Scan(&lista)
	}
	if res.Error != nil {
		return nil, res.Error
	}
	return lista, nil
}

// GetModulo devuelve el módulo ACTIVO, o (nil, nil) si no existe o está inactivo.
func (r *Repository) GetModulo(id string) (*models.Modulo, error) {
	var m models.Modulo
	res := r.db.Table("core_modulos").
		Select("id, COALESCE(nombre, '') as nombre, COALESCE(descripcion, '') as descripcion, es_comun").
		Where("id = ? AND activo = true", id).Limit(1).Scan(&m)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return &m, nil
}

// AsignarModulo da (o actualiza) el permiso de una persona sobre un módulo.
// La congregacion_id se copia SIEMPRE de la fila de la persona, nunca del cliente.
func (r *Repository) AsignarModulo(personaID, moduloID string, nivel int) error {
	return r.db.Exec(`
		INSERT INTO core_permisos_modulos (persona_id, modulo_id, congregacion_id, nivel_acceso)
		SELECT p.id, ?::text, p.congregacion_id, ?::integer
		FROM core_personas p
		WHERE p.id::text = ?
		ON CONFLICT (persona_id, modulo_id) DO UPDATE SET nivel_acceso = EXCLUDED.nivel_acceso`,
		moduloID, nivel, personaID).Error
}

// QuitarModulo borra el permiso. Devuelve cuántas filas se borraron.
func (r *Repository) QuitarModulo(personaID, moduloID string) (int64, error) {
	res := r.db.Exec("DELETE FROM core_permisos_modulos WHERE persona_id::text = ? AND modulo_id = ?", personaID, moduloID)
	return res.RowsAffected, res.Error
}

// --- ADMINISTRACIÓN DE MÓDULOS (solo superadmin) ---

const sqlModuloAdmin = `SELECT m.id,
	COALESCE(m.nombre, '') AS nombre,
	COALESCE(m.descripcion, '') AS descripcion,
	COALESCE(m.es_comun, false) AS es_comun,
	m.activo AS activo,
	(SELECT COUNT(*) FROM core_permisos_modulos p WHERE p.modulo_id = m.id) AS asignaciones,
	(SELECT COUNT(*) FROM core_anuncios a WHERE a.modulo_relacionado::text = m.id) AS anuncios
FROM core_modulos m`

// ListModulosAdmin devuelve TODOS los módulos (activos e inactivos) con sus conteos.
func (r *Repository) ListModulosAdmin() ([]models.ModuloAdmin, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.ModuloAdmin{}
	res := r.db.WithContext(ctx).Raw(sqlModuloAdmin + " ORDER BY m.nombre ASC").Scan(&lista)
	if res.Error != nil {
		return nil, res.Error
	}
	return lista, nil
}

// GetModuloAdmin devuelve un módulo (activo o no), o (nil, nil) si no existe.
func (r *Repository) GetModuloAdmin(id string) (*models.ModuloAdmin, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var m models.ModuloAdmin
	res := r.db.WithContext(ctx).Raw(sqlModuloAdmin+" WHERE m.id = ? LIMIT 1", id).Scan(&m)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return &m, nil
}

// CrearModulo inserta el módulo. Devuelve 0 filas si el id ya existía.
func (r *Repository) CrearModulo(id, nombre, descripcion string, esComun bool) (int64, error) {
	res := r.db.Exec(`
		INSERT INTO core_modulos (id, nombre, descripcion, es_comun, activo)
		VALUES (?, ?, ?, ?, true)
		ON CONFLICT (id) DO NOTHING`,
		id, nombre, descripcion, esComun)
	return res.RowsAffected, res.Error
}

// ActualizarModulo cambia solo los campos recibidos (nunca el id).
func (r *Repository) ActualizarModulo(id string, campos map[string]interface{}) error {
	return r.db.Table("core_modulos").Where("id = ?", id).Updates(campos).Error
}

// EliminarModulo borra el módulo SOLO si nadie lo referencia (todo en una sola
// sentencia, sin carrera). Devuelve cuántas filas se borraron.
func (r *Repository) EliminarModulo(id string) (int64, error) {
	res := r.db.Exec(`
		DELETE FROM core_modulos m
		WHERE m.id = ?
		  AND NOT EXISTS (SELECT 1 FROM core_permisos_modulos p WHERE p.modulo_id = m.id)
		  AND NOT EXISTS (SELECT 1 FROM core_anuncios a WHERE a.modulo_relacionado::text = m.id)`,
		id)
	return res.RowsAffected, res.Error
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

// UpdateProfileField recibe el NOMBRE DE COLUMNA ya validado por el service
// (lista blanca). Nunca debe llamarse con un campo que venga directo del cliente.
func (r *Repository) UpdateProfileField(personaID, columna, valor string) error {
	if columna == "username_temp" {
		return r.db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Table("core_personas").Where("id = ?", personaID).Update("username_temp", valor).Error; err != nil {
				return err
			}
			return tx.Table("core_usuarios").Where("persona_id = ?", personaID).Update("username_temp", valor).Error
		})
	}
	return r.db.Table("core_personas").Where("id = ?", personaID).Update(columna, valor).Error
}

// UsernameTakenByOther indica si otra persona ya usa ese nombre de usuario
// (se revisan core_personas y core_usuarios, sin distinguir mayúsculas).
func (r *Repository) UsernameTakenByOther(username, personaID string) (bool, error) {
	var count int64
	err := r.db.Table("core_personas").
		Where("LOWER(username_temp) = LOWER(?) AND id::text <> ?", username, personaID).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	if count > 0 {
		return true, nil
	}
	err = r.db.Table("core_usuarios").
		Where("LOWER(username_temp) = LOWER(?) AND (persona_id IS NULL OR persona_id::text <> ?)", username, personaID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) UpdateFoto(personaID, url string) error {
	return r.db.Table("core_personas").Where("id = ?", personaID).Update("url_imagen", url).Error
}

// SuspendAccount da de baja la cuenta de UNA persona. El usuario de
// core_usuarios se busca por persona_id: el cliente ya no manda ese dato.
func (r *Repository) SuspendAccount(personaID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Table("core_personas").Where("id = ?", personaID).Update("estado", "BAJA").Error; err != nil {
			return err
		}
		return tx.Table("core_usuarios").Where("persona_id = ?", personaID).Update("estado_cuenta", "suspendida").Error
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

	if err != nil {
		if err.Error() != "record not found" {
			monitor.TripCircuit() // Solo disparamos el breaker si es un error de conexión, no si la tabla está vacía
		}
		return nil, err
	}

	monitor.ResetFailures()
	return map[string]interface{}{"contenido": info.Contenido, "updated_at": info.UpdatedAt}, nil
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

// UpdatePassword guarda el hash nuevo en las dos tablas, en una sola transacción.
func (r *Repository) UpdatePassword(personaID string, hash string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Table("core_usuarios").Where("persona_id = ?", personaID).Updates(map[string]interface{}{"password_hash": hash, "password_changed_at": time.Now()}).Error; err != nil {
			return err
		}
		return tx.Table("core_personas").Where("id = ?", personaID).Updates(map[string]interface{}{"password_hash": hash, "password_changed_at": time.Now()}).Error
	})
}

// GetPasswordHashByPersona devuelve el hash vigente de una persona.
// Mismo orden que el login: primero core_usuarios y, si no está, core_personas.
func (r *Repository) GetPasswordHashByPersona(personaID string) (string, error) {
	var hash string
	res := r.db.Table("core_usuarios").
		Select("COALESCE(password_hash, '')").
		Where("persona_id = ?", personaID).
		Limit(1).Scan(&hash)
	if res.Error != nil {
		return "", res.Error
	}
	if res.RowsAffected > 0 && hash != "" {
		return hash, nil
	}

	hash = ""
	res = r.db.Table("core_personas").
		Select("COALESCE(password_hash, '')").
		Where("id = ?", personaID).
		Limit(1).Scan(&hash)
	if res.Error != nil {
		return "", res.Error
	}
	if res.RowsAffected == 0 || hash == "" {
		return "", gorm.ErrRecordNotFound
	}
	return hash, nil
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
// Busca esta función y reemplázala por esta versión:
func (r *Repository) GetPublicaciones() ([]models.Publicacion, error) {
	var pubs []models.Publicacion
	err := r.db.Table("pub_catalogo").Order("orden asc").Find(&pubs).Error

	if err != nil {
		// Si falla el catálogo, algo anda muy mal en la DB
		monitor.TripCircuit()
		return nil, err
	}

	monitor.ResetFailures() // Si funciona, limpiamos el contador de fallos
	return pubs, nil
}
