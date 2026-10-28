/**
 * ARCHIVO: service.go
 * UBICACIÓN: internal/service/service.go
 * DESCRIPCIÓN: Capa de lógica de negocio. Orquesta la comunicación entre el
 * repositorio y servicios externos (Bcrypt, Resend, JWT).
 */

package service

import (
	"errors"
	"html"
	"strings"

	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"

	"net/http"
	"net/mail"
	"net/url"

	"os"
	"regexp"
	"time"

	"gestion-congregacion/backend/internal/auth"
	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
	"gestion-congregacion/backend/internal/ws"

	"github.com/microcosm-cc/bluemonday"
	"github.com/redis/go-redis/v9"
	"github.com/resend/resend-go/v2"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo *repository.Repository
	rdb  *redis.Client
}

func NewService(repo *repository.Repository, rdb *redis.Client) *Service {
	return &Service{repo: repo, rdb: rdb}
}

// --- LÓGICA DE IDENTIDAD ---

// Authenticate: Lógica de Login Blindada con Sistema de Doble Llave (Refresh Tokens)
func (s *Service) Authenticate(username, password, captchaToken, ip string) (*models.Usuario, string, string, error) {
	username = strings.TrimSpace(strings.ToLower(username))
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// 1. LÓGICA DE CAPTCHA DINÁMICO
	failedAttempts, _ := s.rdb.Get(ctx, "failed_login:"+ip).Int()

	if failedAttempts >= 3 {
		if captchaToken == "" {
			log.Printf("⚠️ LOGIN RECHAZADO: Falta Captcha para IP %s", ip)
			return nil, "", "", errors.New("SISTEMA: Comportamiento sospechoso. Resuelva el CAPTCHA.")
		}
		if !s.ValidarTurnstile(captchaToken) {
			log.Printf("⚠️ LOGIN RECHAZADO: Captcha inválido para IP %s", ip)
			return nil, "", "", errors.New("SISTEMA: CAPTCHA no válido o expirado.")
		}
	}

	// 2. BUSCAR USUARIO
	u, err := s.repo.GetUserForLogin(username)
	if err != nil {
		log.Printf("⚠️ LOGIN RECHAZADO: Usuario '%s' no encontrado", username)
		return nil, "", "", errors.New("el usuario o la contraseña no son correctos")
	}

	// 3. VALIDAR CONTRASEÑA (BLINDAJE NIVEL DIOS: Solo Bcrypt permitido)
	// Eliminamos el 'if/else' anterior para prohibir texto plano.
	err = bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	if err != nil {
		log.Printf("⚠️ LOGIN RECHAZADO: Contraseña incorrecta para usuario '%s'", username)
		// Incrementamos fallos en Redis para disparar el CAPTCHA en el próximo intento
		s.rdb.Incr(ctx, "failed_login:"+ip)
		s.rdb.Expire(ctx, "failed_login:"+ip, 30*time.Minute)
		return nil, "", "", errors.New("el usuario o la contraseña no son correctos")
	}

	// SI EL LOGIN ES EXITOSO: Reseteamos los fallos de esta IP
	s.rdb.Del(ctx, "failed_login:"+ip)

	// 4. GENERACIÓN DE LLAVES (Tokens)
	if u.PersonaID == 0 {
		return nil, "", "", errors.New("error al generar llave de acceso")
	}
	personaID := fmt.Sprintf("%d", u.PersonaID)

	accessToken, err := auth.GenerarAccessToken(u.ID, personaID)
	if err != nil {
		return nil, "", "", errors.New("error al generar llave de acceso")
	}

	refreshToken, err := auth.GenerarRefreshToken(u.ID, personaID)
	if err != nil {
		return nil, "", "", errors.New("error al generar llave de refresco")
	}

	return u, accessToken, refreshToken, nil
}

func (s *Service) RecoverAccount(pID, num, tel, met string) (string, error) {
	if met == "id_cong" {
		return s.repo.FindEmailByIDAndCong(pID, num)
	}
	contactos, _ := s.repo.GetAllContactsForRecovery()
	for _, v := range contactos {
		re := regexp.MustCompile(`\D`)
		nums := re.ReplaceAllString(v.Contacto, "")
		if len(nums) >= 8 && nums[len(nums)-8:] == tel {
			return v.Email, nil
		}
	}
	return "", errors.New("no encontrado")
}

func (s *Service) SendAccessData(email string) error {
	u, err := s.repo.GetUserByEmail(email)
	if err != nil {
		return err
	}
	go func() {
		client := resend.NewClient(os.Getenv("RESEND_API_KEY"))
		html := fmt.Sprintf("<h2>Acceso:</h2><p>Usuario: %s</p><p>ID: %d</p>", u.Username, u.PersonaID)
		params := &resend.SendEmailRequest{From: "Seguridad <onboarding@resend.dev>", To: []string{email}, Subject: "Datos de Acceso", Html: html}
		client.Emails.Send(params)
	}()
	return nil
}

// --- SEGURIDAD DIGITAL ---

func (s *Service) ProcessPinRequest(email, user, cong string) error {
	pinNum, _ := rand.Int(rand.Reader, big.NewInt(1000000))
	pin := fmt.Sprintf("%06d", pinNum)
	s.repo.InvalidateOldPines()
	s.repo.SavePin(pin)
	go func() {
		client := resend.NewClient(os.Getenv("RESEND_API_KEY"))
		html := fmt.Sprintf("<h1>Código de Verificación</h1><p>Su código es: <b>%s</b></p>", pin)
		params := &resend.SendEmailRequest{From: "Seguridad <onboarding@resend.dev>", To: []string{email}, Subject: "Código: " + pin, Html: html}
		client.Emails.Send(params)
	}()
	return nil
}

// BroadcastSecurity: Guarda boletín, avisa por WebSocket y envía Emails masivos.
// El texto se limpia acá: el servidor no confía en lo que manda el cliente.
func (s *Service) BroadcastSecurity(titulo, desc string) error {
	// 0. Limpieza y límites. StrictPolicy quita todo el HTML, queda solo texto.
	p := bluemonday.StrictPolicy()
	titulo = strings.TrimSpace(p.Sanitize(titulo))
	desc = strings.TrimSpace(p.Sanitize(desc))
	if titulo == "" || desc == "" || len(titulo) > 150 || len(desc) > 5000 {
		return ErrValorInvalido
	}

	// El asunto del email y el aviso de pantalla son texto plano, en una sola línea
	asunto := strings.NewReplacer("\r", " ", "\n", " ").Replace(html.UnescapeString(titulo))
	// En el cuerpo del email, los saltos de línea se ven como saltos
	cuerpo := strings.ReplaceAll(strings.ReplaceAll(desc, "\r", ""), "\n", "<br>")

	// 1. Persistencia en base de datos
	if err := s.repo.SaveSecurityLog(titulo, desc); err != nil {
		return err
	}

	// 2. Notificación Push en tiempo real vía WebSocket
	ws.Broadcast(map[string]string{
		"tipo":   "ALERTA_SEGURIDAD",
		"titulo": asunto,
		"msg":    "Se ha publicado una nueva actualización de seguridad.",
	})

	// 3. Notificación por Email Masivo (Asíncrona)
	go func() {
		lista, err := s.repo.GetActiveMembersForBroadcast()
		if err != nil {
			log.Println("❌ Error al obtener destinatarios:", err)
			return
		}

		client := resend.NewClient(os.Getenv("RESEND_API_KEY"))
		for _, u := range lista {
			cuerpoMail := fmt.Sprintf(`<h3>Aviso de Seguridad</h3><p>Hola <b>%s</b>,</p><p>%s</p>`, html.EscapeString(u.NombreCompleto), cuerpo)

			params := &resend.SendEmailRequest{
				From:    "Seguridad Local <onboarding@resend.dev>",
				To:      []string{u.Email},
				Subject: "⚠️ " + asunto,
				Html:    cuerpoMail,
			}
			client.Emails.Send(params)
			time.Sleep(150 * time.Millisecond) // Blindaje anti-spam
		}
	}()

	return nil
}

// Foto permitida: la propia (perfil_<id>.jpg) o un avatar institucional.
var fotoAvatarRe = regexp.MustCompile(`^/avatars/(hombres|mujeres)/(hombre|mujer)_[0-9]{1,2}\.webp$`)

func (s *Service) UpdateUserFoto(personaID, url string) error {
	if url != "perfil_"+personaID+".jpg" && !fotoAvatarRe.MatchString(url) {
		return ErrFotoInvalida
	}
	fixedURL := strings.Replace(url, "PEOPLE_PROFILE", "People_profile", -1)
	return s.repo.UpdateFoto(personaID, fixedURL)
}

func (s *Service) AddSecurityInfo(cont string) error { return s.repo.SaveSecurityLog(cont, "") }

// GetSecurityBulletin: Trae la info más reciente
func (s *Service) GetSecurityBulletin() (map[string]interface{}, error) {
	return s.repo.GetLatestSecurityInfo()
}

func (s *Service) GetCatalog() ([]models.Publicacion, error) { return s.repo.GetPublicaciones() }

// GetActor devuelve quién es la persona (congregación, rol, estado) leído de la base.
func (s *Service) GetActor(personaID string) (*models.Actor, error) {
	return s.repo.GetActor(personaID)
}

// ListPersonas devuelve una página de personas de la congregación del actor.
// todas=true (solo superadmin) se salta el filtro por congregación.
func (s *Service) ListPersonas(a *models.Actor, todas bool, busqueda string, page, limit int) (*models.PersonasPagina, error) {
	if !todas && a.CongregacionID == "" {
		return nil, errors.New("la persona no tiene congregación")
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}

	lista, total, err := s.repo.ListPersonas(a.CongregacionID, todas, busqueda, limit, (page-1)*limit)
	if err != nil {
		return nil, err
	}
	return &models.PersonasPagina{Total: total, Page: page, Limit: limit, Personas: lista}, nil
}

var (
	ErrNivelInvalido    = errors.New("nivel de acceso no válido (de 1 a 3)")
	ErrModuloNoExiste   = errors.New("el módulo no existe")
	ErrModuloComun      = errors.New("el módulo es común y no se asigna")
	ErrPersonaIDInvalid = errors.New("persona_id no válido")
	ErrPersonaNoValida  = errors.New("la persona no existe en su congregación")
	ErrSinAsignacion    = errors.New("esa persona no tiene ese módulo asignado")
)

// MisModulos: todos=true para coordinador, secretario, servicio o superadmin.
func (s *Service) MisModulos(a *models.Actor, todos bool) ([]models.Modulo, error) {
	return s.repo.GetMisModulos(a.PersonaID, todos)
}

// destinoValido: la persona destino existe y es de la congregación del actor
// (el superadmin puede en cualquiera). Mismo error si no existe o es de otra.
func (s *Service) destinoValido(a *models.Actor, esSuper bool, destino string, exigirAlta bool) error {
	t, err := s.repo.BuscarActor(destino)
	if err != nil {
		return err
	}
	if t == nil || t.CongregacionID == "" {
		return ErrPersonaNoValida
	}
	if exigirAlta && t.Estado != "ALTA" {
		return ErrPersonaNoValida
	}
	if !esSuper && t.CongregacionID != a.CongregacionID {
		return ErrPersonaNoValida
	}
	return nil
}

// AsignarModulo: el permiso (rol del actor) ya lo revisó el handler.
func (s *Service) AsignarModulo(a *models.Actor, esSuper bool, personaDestino int, moduloID string, nivel int) error {
	if personaDestino <= 0 {
		return ErrPersonaIDInvalid
	}
	if nivel < 1 || nivel > 3 {
		return ErrNivelInvalido
	}
	moduloID = strings.ToLower(strings.TrimSpace(moduloID))
	if moduloID == "" || len(moduloID) > 60 {
		return ErrModuloNoExiste
	}

	destino := fmt.Sprintf("%d", personaDestino)
	if err := s.destinoValido(a, esSuper, destino, true); err != nil {
		return err
	}

	m, err := s.repo.GetModulo(moduloID)
	if err != nil {
		return err
	}
	if m == nil {
		return ErrModuloNoExiste
	}
	if m.EsComun {
		return ErrModuloComun
	}
	return s.repo.AsignarModulo(destino, moduloID, nivel)
}

// QuitarModulo: igual que asignar, pero no exige que la persona esté en ALTA
// (se puede limpiar los permisos de alguien dado de baja).
func (s *Service) QuitarModulo(a *models.Actor, esSuper bool, personaDestino int, moduloID string) error {
	if personaDestino <= 0 {
		return ErrPersonaIDInvalid
	}
	moduloID = strings.ToLower(strings.TrimSpace(moduloID))
	if moduloID == "" || len(moduloID) > 60 {
		return ErrModuloNoExiste
	}

	destino := fmt.Sprintf("%d", personaDestino)
	if err := s.destinoValido(a, esSuper, destino, false); err != nil {
		return err
	}

	n, err := s.repo.QuitarModulo(destino, moduloID)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrSinAsignacion
	}
	return nil
}

// --- ADMINISTRACIÓN DE MÓDULOS (solo superadmin; el handler ya lo comprobó) ---

var (
	ErrModuloIDInvalido   = errors.New("id no válido: minúsculas, números y _, empieza con letra, máximo 60")
	ErrModuloExiste       = errors.New("ya existe un módulo con ese id")
	ErrNombreModulo       = errors.New("el nombre es obligatorio (máximo 100 caracteres)")
	ErrDescripcionModulo  = errors.New("la descripción admite máximo 500 caracteres")
	ErrModuloSinCambios   = errors.New("no se indicó ningún campo para modificar")
	ErrModuloEnUso        = errors.New("el módulo tiene asignaciones o anuncios: desactívelo en lugar de eliminarlo")
	ErrComunConAsignacion = errors.New("el módulo tiene personas asignadas: quíteselo antes de hacerlo común")
)

var moduloIDRe = regexp.MustCompile(`^[a-z][a-z0-9_]{0,59}$`)

func validarNombreModulo(n string) error {
	if l := len([]rune(n)); l == 0 || l > 100 {
		return ErrNombreModulo
	}
	return nil
}

func validarDescripcionModulo(d string) error {
	if len([]rune(d)) > 500 {
		return ErrDescripcionModulo
	}
	return nil
}

func (s *Service) ListModulosAdmin() ([]models.ModuloAdmin, error) {
	return s.repo.ListModulosAdmin()
}

func (s *Service) CrearModulo(id, nombre, descripcion string, esComun bool) error {
	id = strings.ToLower(strings.TrimSpace(id))
	nombre = strings.TrimSpace(nombre)
	descripcion = strings.TrimSpace(descripcion)

	if !moduloIDRe.MatchString(id) {
		return ErrModuloIDInvalido
	}
	if err := validarNombreModulo(nombre); err != nil {
		return err
	}
	if err := validarDescripcionModulo(descripcion); err != nil {
		return err
	}

	n, err := s.repo.CrearModulo(id, nombre, descripcion, esComun)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrModuloExiste
	}
	return nil
}

// EditarModulo: solo cambia los campos que vienen (puntero distinto de nil).
func (s *Service) EditarModulo(id string, nombre, descripcion *string, esComun, activo *bool) error {
	id = strings.ToLower(strings.TrimSpace(id))
	if id == "" || len(id) > 60 {
		return ErrModuloNoExiste
	}

	campos := map[string]interface{}{}
	if nombre != nil {
		n := strings.TrimSpace(*nombre)
		if err := validarNombreModulo(n); err != nil {
			return err
		}
		campos["nombre"] = n
	}
	if descripcion != nil {
		d := strings.TrimSpace(*descripcion)
		if err := validarDescripcionModulo(d); err != nil {
			return err
		}
		campos["descripcion"] = d
	}
	if esComun != nil {
		campos["es_comun"] = *esComun
	}
	if activo != nil {
		campos["activo"] = *activo
	}
	if len(campos) == 0 {
		return ErrModuloSinCambios
	}

	m, err := s.repo.GetModuloAdmin(id)
	if err != nil {
		return err
	}
	if m == nil {
		return ErrModuloNoExiste
	}
	// Pasar a común un módulo con personas asignadas dejaría filas sin sentido.
	if esComun != nil && *esComun && !m.EsComun && m.Asignaciones > 0 {
		return ErrComunConAsignacion
	}
	return s.repo.ActualizarModulo(id, campos)
}

// EliminarModulo: borra de verdad solo si nadie lo referencia; si no, hay que desactivarlo.
func (s *Service) EliminarModulo(id string) error {
	id = strings.ToLower(strings.TrimSpace(id))
	if id == "" || len(id) > 60 {
		return ErrModuloNoExiste
	}

	m, err := s.repo.GetModuloAdmin(id)
	if err != nil {
		return err
	}
	if m == nil {
		return ErrModuloNoExiste
	}

	n, err := s.repo.EliminarModulo(id)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrModuloEnUso
	}
	return nil
}

var (
	ErrCampoInvalido = errors.New("campo no permitido")
	ErrValorInvalido = errors.New("valor no válido")
	ErrUsernameEnUso = errors.New("el nombre de usuario ya está en uso")
	ErrFotoInvalida  = errors.New("foto no permitida")
)

// Lista blanca: campo que manda el cliente -> columna real de la base.
// La contraseña NO está acá: va por su propia ruta (paso 2c).
var camposPerfil = map[string]string{
	"username": "username_temp",
	"email":    "email",
	"contacto": "contacto",
}

var contactoRe = regexp.MustCompile(`^[0-9]{8,20}$`)

func (s *Service) UpdateProfile(personaID, campo, valor string) error {
	columna, ok := camposPerfil[campo]
	if !ok {
		return ErrCampoInvalido
	}

	// No confiamos en lo que envíe el cliente
	p := bluemonday.StrictPolicy()
	valor = strings.TrimSpace(p.Sanitize(valor))
	if valor == "" {
		return ErrValorInvalido
	}

	switch campo {
	case "username":
		valor = strings.ToLower(valor)
		if len(valor) < 3 || len(valor) > 40 || strings.ContainsAny(valor, " \t\r\n") {
			return ErrValorInvalido
		}
		ocupado, err := s.repo.UsernameTakenByOther(valor, personaID)
		if err != nil {
			return err
		}
		if ocupado {
			return ErrUsernameEnUso
		}
	case "email":
		addr, err := mail.ParseAddress(valor)
		if err != nil || addr.Address != valor || len(valor) > 254 {
			return ErrValorInvalido
		}
		valor = strings.ToLower(valor)
	case "contacto":
		if !contactoRe.MatchString(valor) {
			return ErrValorInvalido
		}
	}

	return s.repo.UpdateProfileField(personaID, columna, valor)
}

func (s *Service) SuspendUser(personaID string) error { return s.repo.SuspendAccount(personaID) }

// VerifyPin: Valida y consume el PIN (lo marca como usado)
func (s *Service) VerifyPin(pin string) error {
	if pin == "" {
		return errors.New("el PIN es obligatorio")
	}
	return s.repo.ConsumePin(pin)
}

func (s *Service) IdentifyUser(user string) error {
	if s.repo.UserExists(user) {
		return nil
	}
	return errors.New("no encontrado")
}

/**
 * NUEVA FUNCIÓN EN EL SERVICE
 * ValidarTurnstile verifica el token con los servidores de Cloudflare.
 */
/**
 * ValidarTurnstile: Verifica el token con Cloudflare.
 * Incluye logs detallados para depuración en tiempo real.
 */
func (s *Service) ValidarTurnstile(token string) bool {
	secretKey := os.Getenv("TURNSTILE_SECRET_KEY")

	if secretKey == "" {
		log.Println("⚠️  ALERTA SEGURIDAD: TURNSTILE_SECRET_KEY no encontrada en .env")
		return false
	}

	// Usamos url.Values para codificar correctamente los parámetros
	data := url.Values{}
	data.Set("secret", secretKey)
	data.Set("response", token)

	resp, err := http.PostForm("https://challenges.cloudflare.com/turnstile/v0/siteverify", data)
	if err != nil {
		log.Println("❌ ERROR de red al validar con Cloudflare:", err)
		return false
	}
	defer resp.Body.Close()

	var result struct {
		Success    bool     `json:"success"`
		ErrorCodes []string `json:"error-codes"`
		Hostname   string   `json:"hostname"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Println("❌ ERROR al leer respuesta de Cloudflare:", err)
		return false
	}

	if !result.Success {
		log.Printf("🚫 Captcha RECHAZADO. Errores: %v | Hostname: %s", result.ErrorCodes, result.Hostname)
		return false
	}

	log.Println("✅ Captcha VALIDADO correctamente por Cloudflare")
	return true
}

var (
	ErrClaveActualIncorrecta = errors.New("la contraseña actual no es correcta")
	ErrClaveDebil            = errors.New("la nueva contraseña no cumple los requisitos")
	ErrDemasiadosIntentos    = errors.New("demasiados intentos, probá más tarde")
)

// claveFuerte aplica la misma regla que el frontend (isPassStrong), más el
// máximo de 72 bytes que admite bcrypt.
func claveFuerte(p string) bool {
	if len(p) < 8 || len(p) > 72 {
		return false
	}
	var upper, num, sym bool
	for _, c := range p {
		switch {
		case c >= 'A' && c <= 'Z':
			upper = true
		case c >= '0' && c <= '9':
			num = true
		case !(c >= 'a' && c <= 'z'):
			sym = true
		}
	}
	return upper && num && sym
}

// ChangePassword cambia la contraseña de la persona del token.
// Exige la contraseña actual y limita los intentos fallidos por persona.
func (s *Service) ChangePassword(personaID, actual, nueva string) error {
	// 1. La nueva clave tiene que ser fuerte y distinta de la actual
	if !claveFuerte(nueva) || nueva == actual {
		return ErrClaveDebil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// 2. Límite de intentos fallidos (5 en 15 minutos)
	key := "pwchange_fail:" + personaID
	if n, _ := s.rdb.Get(ctx, key).Int(); n >= 5 {
		return ErrDemasiadosIntentos
	}

	// 3. Verificar la contraseña actual con bcrypt
	hashActual, err := s.repo.GetPasswordHashByPersona(personaID)
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(hashActual), []byte(actual)) != nil {
		s.rdb.Incr(ctx, key)
		s.rdb.Expire(ctx, key, 15*time.Minute)
		return ErrClaveActualIncorrecta
	}
	s.rdb.Del(ctx, key)

	// 4. Cifrar y guardar la nueva
	nuevoHash, err := bcrypt.GenerateFromPassword([]byte(nueva), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.repo.UpdatePassword(personaID, string(nuevoHash))
}
