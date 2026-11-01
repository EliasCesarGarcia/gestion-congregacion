/**
 * ARCHIVO: personas_escritura.go
 * UBICACIÓN: backend/internal/service/personas_escritura.go
 * DESCRIPCIÓN: Reglas de escritura del módulo de personas (tramo 2B): crear,
 * editar datos y cambiar situaciones.
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Un encargado solo escribe en su congregación; el superadmin elige una.
 *  - Una persona de otra congregación responde igual que una inexistente.
 *  - Apellido en MAYÚSCULAS y nombre en tipo título, aplicado acá (no en el navegador).
 *  - Nunca se inventan fechas: una fecha desconocida queda vacía.
 *  - El rol (coordinador, secretario, servicio) NO se toca acá: es solo del superadmin.
 */

package service

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

var (
	// ErrPersonaDatos: algún dato no es válido (400). El mensaje dice cuál.
	ErrPersonaDatos = errors.New("datos de la persona no válidos")
	// ErrPersonaSinCambio: lo pedido ya estaba así (409).
	ErrPersonaSinCambio = errors.New("no hay nada que cambiar")
)

const (
	personasLargoNombre    = 100
	personasLargoContacto  = 100
	personasLargoDetalles  = 300
	personasLargoDireccion = 200
	personasLargoPostal    = 12
	personasLargoUbicacion = 100 // país, provincia/estado, ciudad y partido
)

// Palabras que quedan en minúscula dentro de un nombre ("María de los Ángeles").
var conectoresNombrePersona = map[string]bool{
	"de": true, "del": true, "la": true, "las": true, "los": true, "y": true,
	"e": true, "da": true, "do": true, "dos": true, "das": true,
	"van": true, "von": true, "der": true,
}

// EntradaPersona: lo que manda la pantalla al crear o editar. Al editar se
// manda TODO el formulario: lo que llega vacío queda sin dato (NULL).
// CongregacionID solo lo usa el superadmin al crear. Las tres situaciones
// solo se usan al crear (después se cambian con CambiarSituacionPersona).
type EntradaPersona struct {
	CongregacionID  string `json:"congregacion_id"`
	Apellido        string `json:"apellido"`
	Nombre          string `json:"nombre"`
	Contacto        string `json:"contacto"`
	Detalles        string `json:"detalles"`
	Grupo           *int   `json:"grupo"`
	Condicion       string `json:"condicion"`
	FechaAlta       string `json:"fecha_alta"`
	Situacion1      string `json:"situacion_1"`
	Situacion2      string `json:"situacion_2"`
	Situacion3      string `json:"situacion_3"`
	Direccion       string `json:"direccion"`
	CodigoPostal    string `json:"codigo_postal"`
	Pais            string `json:"pais"`
	ProvinciaEstado string `json:"provincia_estado"`
	Ciudad          string `json:"ciudad"`
	Partido         string `json:"partido"`
}

func errDatosPersona(format string, a ...interface{}) error {
	return fmt.Errorf("%w: %s", ErrPersonaDatos, fmt.Sprintf(format, a...))
}

// textoPersona recorta, rechaza caracteres de control y controla el largo.
// Un texto de una línea junta los espacios repetidos; multilinea deja los saltos.
func textoPersona(valor, campo string, max int, obligatorio, multilinea bool) (string, error) {
	v := strings.TrimSpace(valor)
	if !utf8.ValidString(v) {
		return "", errDatosPersona("%s tiene caracteres no válidos", campo)
	}
	for _, r := range v {
		if unicode.IsControl(r) && !(multilinea && (r == '\n' || r == '\r')) {
			return "", errDatosPersona("%s tiene caracteres no válidos", campo)
		}
	}
	if !multilinea {
		v = strings.Join(strings.Fields(v), " ")
	}
	if v == "" {
		if obligatorio {
			return "", errDatosPersona("%s es obligatorio", campo)
		}
		return "", nil
	}
	if utf8.RuneCountInString(v) > max {
		return "", errDatosPersona("%s admite máximo %d caracteres", campo, max)
	}
	return v, nil
}

// nombrePropioPersona: texto obligatorio que solo admite letras, espacios,
// guion, apóstrofo y punto (sin números ni signos raros).
func nombrePropioPersona(valor, campo string) (string, error) {
	v, err := textoPersona(valor, campo, personasLargoNombre, true, false)
	if err != nil {
		return "", err
	}
	for _, r := range v {
		if !(unicode.IsLetter(r) || r == ' ' || r == '-' || r == '\'' || r == '’' || r == '.') {
			return "", errDatosPersona("%s solo admite letras, espacios, guion, apóstrofo y punto", campo)
		}
	}
	return v, nil
}

// capitalizarPalabraPersona: "jean-pierre" → "Jean-Pierre", "d'angelo" → "D'Angelo".
func capitalizarPalabraPersona(p string) string {
	runas := []rune(p)
	subir := true
	for i, r := range runas {
		switch {
		case subir && unicode.IsLetter(r):
			runas[i] = unicode.ToUpper(r)
			subir = false
		case r == '-' || r == '\'' || r == '’' || r == '.':
			subir = true
		default:
			subir = false
		}
	}
	return string(runas)
}

// nombreTituloPersona: primera letra de cada palabra en mayúscula; los
// conectores ("de", "del", "la"...) en minúscula salvo que abran el nombre.
func nombreTituloPersona(s string) string {
	palabras := strings.Fields(strings.ToLower(s))
	for i, p := range palabras {
		if i > 0 && conectoresNombrePersona[p] {
			continue
		}
		palabras[i] = capitalizarPalabraPersona(p)
	}
	return strings.Join(palabras, " ")
}

// fechaPersona valida AAAA-MM-DD. No puede ser futura (se tolera un día por
// el huso horario). Vacía solo se acepta si no es obligatoria.
func fechaPersona(valor string, obligatoria bool) (string, error) {
	v := strings.TrimSpace(valor)
	if v == "" {
		if obligatoria {
			return "", errDatosPersona("la fecha es obligatoria (AAAA-MM-DD)")
		}
		return "", nil
	}
	t, err := time.Parse("2006-01-02", v)
	if err != nil || t.Year() < 1900 {
		return "", errDatosPersona("fecha no válida: use AAAA-MM-DD")
	}
	limite := time.Now().UTC().Truncate(24 * time.Hour).AddDate(0, 0, 1)
	if t.After(limite) {
		return "", errDatosPersona("la fecha no puede ser futura")
	}
	return t.Format("2006-01-02"), nil
}

// situacionPersona devuelve el valor tal como figura en la lista, o "" si viene vacío.
func situacionPersona(valor string, validas []string, campo int) (string, error) {
	v := strings.TrimSpace(valor)
	if v == "" {
		return "", nil
	}
	for _, c := range validas {
		if strings.EqualFold(v, c) {
			return c, nil
		}
	}
	return "", errDatosPersona("valor no válido para la situación %d", campo)
}

// prepararDatosPersona valida y normaliza lo que se guarda al crear y al editar.
// La fecha de alta la resuelve cada operación.
func prepararDatosPersona(in EntradaPersona) (models.DatosPersona, error) {
	var d models.DatosPersona
	var err error

	apellido, err := nombrePropioPersona(in.Apellido, "el apellido")
	if err != nil {
		return d, err
	}
	nombre, err := nombrePropioPersona(in.Nombre, "el nombre")
	if err != nil {
		return d, err
	}
	d.Apellido = strings.ToUpper(apellido)
	d.Nombre = nombreTituloPersona(nombre)
	d.ApellidoNombre = d.Apellido + " " + d.Nombre

	if d.Contacto, err = textoPersona(in.Contacto, "el contacto", personasLargoContacto, false, false); err != nil {
		return d, err
	}
	if d.Detalles, err = textoPersona(in.Detalles, "los detalles", personasLargoDetalles, false, true); err != nil {
		return d, err
	}

	if in.Grupo != nil {
		if *in.Grupo < 1 || *in.Grupo > personasMaxGrupo {
			return d, errDatosPersona("el grupo debe ser un número de 1 a %d", personasMaxGrupo)
		}
		g := *in.Grupo
		d.Grupo = &g
	}

	d.Condicion = strings.ToUpper(strings.TrimSpace(in.Condicion))
	if d.Condicion != "" && d.Condicion != "A" && d.Condicion != "I" {
		return d, errDatosPersona("la condición debe ser A (activo) o I (inactivo)")
	}

	if d.Direccion, err = textoPersona(in.Direccion, "la dirección", personasLargoDireccion, false, false); err != nil {
		return d, err
	}
	if d.CodigoPostal, err = textoPersona(in.CodigoPostal, "el código postal", personasLargoPostal, false, false); err != nil {
		return d, err
	}
	if d.Pais, err = textoPersona(in.Pais, "el país", personasLargoUbicacion, false, false); err != nil {
		return d, err
	}
	if d.ProvinciaEstado, err = textoPersona(in.ProvinciaEstado, "la provincia/estado", personasLargoUbicacion, false, false); err != nil {
		return d, err
	}
	if d.Ciudad, err = textoPersona(in.Ciudad, "la ciudad", personasLargoUbicacion, false, false); err != nil {
		return d, err
	}
	if d.Partido, err = textoPersona(in.Partido, "el partido", personasLargoUbicacion, false, false); err != nil {
		return d, err
	}
	return d, nil
}

// fichaParaEscribir: la persona existe y es de la congregación del actor
// (el superadmin puede en cualquiera). Mismo error si no existe o es de otra.
func (s *Service) fichaParaEscribir(a *models.Actor, esSuper bool, personaID int, exigirAlta bool) (*models.PersonaFicha, error) {
	if personaID <= 0 {
		return nil, ErrPersonaIDInvalid
	}
	if err := s.destinoValido(a, esSuper, fmt.Sprintf("%d", personaID), exigirAlta); err != nil {
		return nil, err
	}
	f, err := s.repo.GetFichaPersona(personaID)
	if err != nil {
		return nil, err
	}
	if f == nil {
		return nil, ErrPersonaNoValida
	}
	return f, nil
}

// CrearPersona: nace en ALTA, sin correo ni datos de acceso y con rol
// publicador. Devuelve el id nuevo. El encargado crea en SU congregación (se
// ignora la que mande); el superadmin debe indicarla.
func (s *Service) CrearPersona(a *models.Actor, esSuper bool, in EntradaPersona) (int, error) {
	congID := a.CongregacionID
	if esSuper {
		if strings.TrimSpace(in.CongregacionID) == "" {
			return 0, errDatosPersona("falta la congregación")
		}
		id, err := normalizarIDCongregacion(in.CongregacionID)
		if err != nil {
			return 0, err
		}
		congID = id
	} else if congID == "" {
		return 0, ErrSinCongregacion
	}

	d, err := prepararDatosPersona(in)
	if err != nil {
		return 0, err
	}
	if d.Condicion == "" {
		d.Condicion = "A"
	}
	if d.FechaAlta, err = fechaPersona(in.FechaAlta, true); err != nil {
		return 0, err
	}

	s1, err := situacionPersona(in.Situacion1, situacionesLista1, 1)
	if err != nil {
		return 0, err
	}
	if s1 == "" {
		s1 = "Publicador"
	}
	s2, err := situacionPersona(in.Situacion2, situacionesLista2, 2)
	if err != nil {
		return 0, err
	}
	s3, err := situacionPersona(in.Situacion3, situacionesLista3, 3)
	if err != nil {
		return 0, err
	}

	id, err := s.repo.CrearPersona(models.NuevaPersona{
		DatosPersona:   d,
		CongregacionID: congID,
		Situacion1:     s1,
		Situacion2:     s2,
		Situacion3:     s3,
		ActorID:        a.PersonaID,
	})
	if err != nil {
		return 0, err
	}
	if id == 0 {
		return 0, ErrCongregacionNoExiste
	}
	return id, nil
}

// EditarPersona: reemplaza los datos editables con lo que manda el formulario.
// Se puede editar a alguien en BAJA (corregir un dato). Una persona antigua
// sin fecha de alta puede seguir sin ella; si ya la tiene, no se puede vaciar.
func (s *Service) EditarPersona(a *models.Actor, esSuper bool, personaID int, in EntradaPersona) error {
	ficha, err := s.fichaParaEscribir(a, esSuper, personaID, false)
	if err != nil {
		return err
	}
	d, err := prepararDatosPersona(in)
	if err != nil {
		return err
	}

	fecha, err := fechaPersona(in.FechaAlta, false)
	if err != nil {
		return err
	}
	if fecha == "" && ficha.FechaAlta != nil {
		return errDatosPersona("la persona ya tiene fecha de alta: no se puede dejar vacía")
	}
	if fecha != "" && ficha.Estado == "BAJA" && ficha.FechaBaja != nil && fecha > *ficha.FechaBaja {
		return errDatosPersona("la fecha de alta no puede ser posterior a la fecha de baja")
	}
	d.FechaAlta = fecha

	n, err := s.repo.EditarPersona(personaID, d)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrPersonaNoValida
	}
	return nil
}

// CambiarSituacionPersona: campo 1, 2 o 3. valor "" (o "sin") quita la situación
// 2 o 3; la 1 solo se reemplaza. Cierra la vigente con la fecha y abre la nueva.
// La persona debe estar en ALTA.
func (s *Service) CambiarSituacionPersona(a *models.Actor, esSuper bool, personaID, campo int, valor, fecha string) error {
	var validas []string
	switch campo {
	case 1:
		validas = situacionesLista1
	case 2:
		validas = situacionesLista2
	case 3:
		validas = situacionesLista3
	default:
		return errDatosPersona("el campo debe ser 1, 2 o 3")
	}

	valor = strings.TrimSpace(valor)
	if strings.EqualFold(valor, "sin") {
		valor = ""
	}
	if valor == "" && campo == 1 {
		return errDatosPersona("la situación 1 no se quita, solo se reemplaza")
	}
	nuevo, err := situacionPersona(valor, validas, campo)
	if err != nil {
		return err
	}

	f, err := fechaPersona(fecha, true)
	if err != nil {
		return err
	}

	ficha, err := s.fichaParaEscribir(a, esSuper, personaID, true)
	if err != nil {
		return err
	}
	if ficha.FechaAlta != nil && f < *ficha.FechaAlta {
		return errDatosPersona("la fecha es anterior a la fecha de alta de la persona")
	}

	cambio, err := s.repo.CambiarSituacionPersona(personaID, campo, nuevo, f, a.PersonaID)
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrFechaAnteriorInicio):
			return errDatosPersona("la fecha es anterior al inicio de la situación vigente")
		case errors.Is(err, repository.ErrPersonaInexistente):
			return ErrPersonaNoValida
		}
		return err
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}