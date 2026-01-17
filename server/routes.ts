import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const clients = new Map<string, { ws: WebSocket; state: any }>();
  const bannedPlayers = new Map<string, number>();

  wss.on("connection", (ws) => {
    console.log("[WebSocket] New client connected");
    let playerId: string | null = null;
    let playerName: string | null = null;

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type !== "PLAYER_STATE") {
          console.log(`[WebSocket] Message received: ${message.type}`);
        }
        
        if (message.type === "PLAYER_STATE") {
          playerId = message.payload.id;
          playerName = message.payload.name;

          if (playerName) {
            const banExpiry = bannedPlayers.get(playerName.toLowerCase());
            if (banExpiry && Date.now() < banExpiry) {
              console.warn(`[Ban] Denied connection for banned player: ${playerName}`);
              ws.send(JSON.stringify({ type: "KICK_ALL", payload: { reason: "banned" } }));
              ws.close();
              return;
            } else if (banExpiry) {
              console.log(`[Ban] Ban expired for: ${playerName}`);
              bannedPlayers.delete(playerName.toLowerCase());
            }
          }

          clients.set(playerId!, { ws, state: message.payload });
          
          // Broadcast to everyone else
          const broadcastMsg = JSON.stringify({
            type: "PLAYER_STATE",
            payload: message.payload
          });
          
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(broadcastMsg);
            }
          });
        } else if (message.type === "CHAT_MESSAGE") {
          const chatMsg = JSON.stringify({
            type: "CHAT_MESSAGE",
            payload: message.payload
          });
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(chatMsg);
            }
          });
        } else if (message.type === "KICK_PLAYER") {
          const target = message.payload.target;
          const reason = message.payload.reason || 'kick';
          const kickMsg = JSON.stringify({ type: "KICK_ALL", payload: { reason } });

          if (target === "@everyone") {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(kickMsg);
              }
            });
          } else {
            // Find client by name (case-insensitive for better UX)
            const targetLower = target.toLowerCase();
            clients.forEach((c) => {
              if (c.state.name.toLowerCase() === targetLower) {
                if (c.ws.readyState === WebSocket.OPEN) {
                  c.ws.send(kickMsg);
                }
              }
            });
          }
        } else if (message.type === "UPDATE_RANK") {
          const target = message.payload.target;
          const newRank = message.payload.rank;
          const rankMsg = JSON.stringify({ type: "UPDATE_RANK", payload: { rank: newRank } });

          if (target === "@everyone") {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(rankMsg);
              }
            });
          } else {
            const targetLower = target.toLowerCase();
            clients.forEach((c) => {
              if (c.state.name.toLowerCase() === targetLower) {
                if (c.ws.readyState === WebSocket.OPEN) {
                  c.ws.send(rankMsg);
                }
              }
            });
          }
        } else if (message.type === "ANNOUNCE") {
          const { text } = message.payload;
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "ANNOUNCEMENT", payload: { text } }));
            }
          });
        } else if (message.type === "BOSS_SPAWN") {
          const bossData = message.payload;
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "BOSS_SPAWN", payload: bossData }));
            }
          });
        } else if (message.type === "ATTACK") {
          const { target, damage } = message.payload;
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "BOSS_HP_REDUCE", payload: { damage } }));
              // For player pvp simulation
              client.send(JSON.stringify({ type: "PLAYER_DAMAGE", payload: { target, damage } }));
            }
          });
        } else if (message.type === "REVIVE") {
          const { target } = message.payload;
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "PLAYER_STATE", payload: { name: target, hp: 100 } }));
            }
          });
        } else if (message.type === "BAN_PLAYER") {
          const target = message.payload.target;
          const banMsg = JSON.stringify({ type: "KICK_ALL", payload: { reason: "banned" } });
          const expiry = Date.now() + 60000; // 1 minute from now

          if (target === "@everyone") {
            clients.forEach((c) => {
              bannedPlayers.set(c.state.name.toLowerCase(), expiry);
            });
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(banMsg);
              }
            });
          } else {
            const targetLower = target.toLowerCase();
            bannedPlayers.set(targetLower, expiry);
            clients.forEach((c) => {
              if (c.state.name.toLowerCase() === targetLower) {
                if (c.ws.readyState === WebSocket.OPEN) {
                  c.ws.send(banMsg);
                }
              }
            });
          }
        } else if (message.type === "BOSS_HP_REDUCE") {
          const { damage } = message.payload;
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "BOSS_HP_REDUCE", payload: { damage } }));
            }
          });
        }
      } catch (e) {
        console.error("WebSocket message processing error:", e);
      }
    });

    ws.on("close", () => {
      if (playerId) {
        clients.delete(playerId);
        const leaveMsg = JSON.stringify({
          type: "PLAYER_LEAVE",
          payload: { id: playerId }
        });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(leaveMsg);
          }
        });
      }
    });
  });
  
  app.post(api.logs.create.path, async (req, res) => {
    try {
      const input = api.logs.create.input.parse(req.body);
      const log = await storage.logCommand(input);
      res.status(201).json(log);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid log data" });
        return;
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.logs.list.path, async (req, res) => {
    const logs = await storage.getCommandLogs();
    res.json(logs);
  });

  // Discord verification route
  app.get('/.well-known/discord', (_req, res) => {
    res.send('dh=ff8cad355982906988cadd29eb2f00a129df5191');
  });

  return httpServer;
}
