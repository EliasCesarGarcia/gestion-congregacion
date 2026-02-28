/**
 * ARCHIVO: hub.go
 * UBICACIÓN: Backend/internal/ws/hub.go
 * DESCRIPCIÓN: Gestiona las conexiones activas de WebSockets.
 * Permite enviar notificaciones 'Push' desde el servidor al cliente.
 */

package ws

import (
	"github.com/gorilla/websocket"
	"net/http"
	"sync"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // Permitir React
}

// Clients guarda los punteros a las conexiones activas
var clients = make(map[*websocket.Conn]bool)
var mutex = &sync.Mutex{}

// WsHandler eleva la conexión HTTP a WebSocket
func WsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	
	mutex.Lock()
	clients[conn] = true
	mutex.Unlock()
}

// Broadcast envía un mensaje a todos los usuarios conectados
func Broadcast(message interface{}) {
	mutex.Lock()
	defer mutex.Unlock()
	for client := range clients {
		err := client.WriteJSON(message)
		if err != nil {
			client.Close()
			delete(clients, client)
		}
	}
}