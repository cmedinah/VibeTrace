#!/usr/bin/env node
/**
 * Simple proxy server to handle question replies in OpenCode v2.
 * 
 * Usage:
 *   node replyProxy.js
 *   or
 *   npx ts-node replyProxy.ts
 * 
 * Then in VibeTrace, set: VITE_REPLY_PROXY=http://localhost:61831
 */

import http from 'http'
import { spawn } from 'child_process'

const PORT = 61831

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Handle POST /reply
  if (req.method === 'POST' && req.url === '/reply') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const { sessionId, answers } = JSON.parse(body)
        
        if (!sessionId || !answers) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Missing sessionId or answers' }))
          return
        }

        const escapedAnswers = answers.replace(/"/g, '\\"')
        const cmd = `opencode run -s ${sessionId} "${escapedAnswers}"`

        console.log(`[replyProxy] Executing: ${cmd}`)

        const result = await new Promise((resolve, reject) => {
          exec(cmd, (err, stdout, stderr) => {
            if (err) reject(err)
            else resolve({ stdout, stderr })
          })
        })

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, ...result }))
      } catch (err) {
        console.error('[replyProxy] Error:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: String(err) }))
      }
    })
    return
  }

  // Handle OPTIONS /reject
  if (req.method === 'POST' && req.url === '/reject') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const { sessionId } = JSON.parse(body)
        
        if (!sessionId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Missing sessionId' }))
          return
        }

        const cmd = `opencode run -s ${sessionId} ""`

        console.log(`[replyProxy] Executing reject: ${cmd}`)

        await new Promise((resolve, reject) => {
          exec(cmd, (err, stdout, stderr) => {
            if (err) reject(err)
            else resolve({ stdout, stderr })
          })
        })

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (err) {
        console.error('[replyProxy] Error:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: String(err) }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end()
})

const { exec } = await import('child_process')

server.listen(PORT, () => {
  console.log(`[replyProxy] Listening on http://localhost:${PORT}`)
  console.log(`[replyProxy] Set VITE_REPLY_PROXY=http://localhost:${PORT} in .env.local`)
})
