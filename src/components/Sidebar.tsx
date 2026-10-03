import { useEffect, useMemo, useRef, useState } from 'react'
import type { OcSession } from '../types/opencode'
import { folderDisplayName } from '../utils/sessionFolders'

/** Builds a tree structure from flat sessions based on parentID */
interface SessionTreeNode {
  session: OcSession
  children: SessionTreeNode[]
}

function buildSessionTree(sessions: OcSession[]): SessionTreeNode[] {
  const map = new Map<string, SessionTreeNode>()
  const roots: SessionTreeNode[] = []

  // First pass: create nodes
  for (const session of sessions) {
    map.set(session.id, { session, children: [] })
  }

  // Second pass: link children to parents
  for (const session of sessions) {
    const node = map.get(session.id)!
    if (session.parentID && map.has(session.parentID)) {
      map.get(session.parentID)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function sortTreeNodes(nodes: SessionTreeNode[]): SessionTreeNode[] {
  return [...nodes].sort((a, b) => b.session.time.updated - a.session.time.updated).map(node => ({
    ...node,
    children: sortTreeNodes(node.children)
  }))
}

interface SidebarProps {
  /** Sessions in the selected folder (sorted, filtered). */
  sessionsInFolder: OcSession[]
  directories: string[]
  selectedDirectory: string
  onSelectDirectory: (dir: string) => void | Promise<void>
  selectedSessionId: string
  onSelectSession: (id: string) => void
  onCreateSession: () => void | Promise<void>
  creatingSession?: boolean
  /** Calls OpenCode DELETE /session/:id — removes session from UI (server deletes data). */
  onArchiveSession?: (sessionId: string) => void | Promise<void>
  archivingSessionId?: string | null
  collapsed: boolean
  onToggle: () => void
  apiConnected: boolean
  onAddDirectory?: () => void
  onCloseDirectory?: (dir: string) => void
}

const RAIL_WIDTH = 44
type DirMenu = { x: number; y: number; dir: string }

export default function Sidebar({
  sessionsInFolder,
  directories,
  selectedDirectory,
  onSelectDirectory,
  selectedSessionId,
  onSelectSession,
  onCreateSession,
  creatingSession,
  onArchiveSession,
  archivingSessionId,
  collapsed,
  onToggle,
  apiConnected,
  onAddDirectory,
  onCloseDirectory,
}: SidebarProps) {
  const [hoverSessionId, setHoverSessionId] = useState<string | null>(null)
  const [dirMenu, setDirMenu] = useState<DirMenu | null>(null)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const dirMenuRef = useRef<HTMLDivElement>(null)

  // Build session tree
  const sessionTree = useMemo(() => {
    return sortTreeNodes(buildSessionTree(sessionsInFolder))
  }, [sessionsInFolder])

  const toggleExpanded = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  const isExpanded = (sessionId: string) => expandedSessions.has(sessionId)

  // Auto-expand parents of selected session
  useEffect(() => {
    const selectedSession = sessionsInFolder.find(s => s.id === selectedSessionId)
    if (selectedSession?.parentID) {
      setExpandedSessions(prev => {
        const next = new Set(prev)
        let parentId: string | undefined = selectedSession.parentID
        while (parentId) {
          next.add(parentId)
          const parent = sessionsInFolder.find(s => s.id === parentId)
          parentId = parent?.parentID
        }
        return next
      })
    }
  }, [selectedSessionId, sessionsInFolder])
  const titleName = useMemo(
    () => folderDisplayName(selectedDirectory),
    [selectedDirectory],
  )
  useEffect(() => {
    if (!dirMenu) return
    const onPointer = (e: MouseEvent) => {
      if (!dirMenuRef.current?.contains(e.target as Node)) {
        setDirMenu(null)
      }
    }
    const onScroll = () => setDirMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDirMenu(null)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [dirMenu])

  if (collapsed) {
    return (
      <div
        style={{
          width: 48,
          height: '100%',
          background: '#FFFFFF',
          borderRight: '1px solid #E8E8E8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 12,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onToggle}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
          title="Expand sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        flexShrink: 0,
      }}
    >
      {/* Folder rail */}
      <div
        style={{
          width: RAIL_WIDTH,
          background: '#FAFAFA',
          borderRight: '1px solid #E8E8E8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          paddingBottom: 8,
          gap: 6,
          overflowY: 'auto',
        }}
      >
        {onAddDirectory && (
          <button
            type="button"
            title="Add workspace directory"
            onClick={onAddDirectory}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #D8C2EB',
              background: 'linear-gradient(180deg, #FCF8FF 0%, #F3E9FB 100%)',
              cursor: 'pointer',
              color: '#6D35A1',
              fontSize: 18,
              fontWeight: 500,
              lineHeight: '28px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
            }}
          >
            +
          </button>
        )}
        {directories.map((dir) => {
          const active = dir === selectedDirectory
          const label = folderDisplayName(dir).slice(0, 2)
          return (
            <button
              key={dir || '__root__'}
              type="button"
              title={dir}
              onClick={() => onSelectDirectory(dir)}
              onContextMenu={(e) => {
                if (!onCloseDirectory) return
                e.preventDefault()
                setDirMenu({ x: e.clientX, y: e.clientY, dir })
              }}
              style={{
                width: 32,
                minHeight: 32,
                padding: '4px 2px',
                borderRadius: 8,
                border: active ? '1px solid #8445BC' : '1px solid transparent',
                background: active ? '#F0E6FA' : 'transparent',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                color: active ? '#5B2D82' : '#525252',
                lineHeight: 1.15,
                wordBreak: 'break-all',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Session list */}
      <div
        style={{
          width: 240,
          height: '100%',
          background: '#FFFFFF',
          borderRight: '1px solid #E8E8E8',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: 48,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #E8E8E8',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span
              title={selectedDirectory || 'Active workspace'}
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: '#171717',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {titleName}
            </span>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: apiConnected ? '#0ABE00' : '#FF3B30',
                flexShrink: 0,
              }}
              title={apiConnected ? 'OpenCode connected' : 'Not connected'}
            />
          </div>
          <button
            onClick={onToggle}
            style={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Collapse sidebar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8F8F8F" strokeWidth="2">
              <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '8px 12px' }}>
          <button
            type="button"
            disabled={creatingSession}
            onClick={() => void onCreateSession()}
            style={{
              width: '100%',
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: creatingSession ? '#ECECEC' : '#8445BC',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: creatingSession ? 'wait' : 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {creatingSession ? 'Creating…' : 'New session'}
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '4px 0',
          }}
        >
          {sessionTree.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12, color: '#8F8F8F', lineHeight: 1.5 }}>
              No sessions in this folder yet. Use &quot;New session&quot; to start.
            </div>
          ) : (
            <SessionTreeRenderer
              nodes={sessionTree}
              selectedSessionId={selectedSessionId}
              expandedSessions={expandedSessions}
              hoverSessionId={hoverSessionId}
              archivingSessionId={archivingSessionId}
              onSelectSession={onSelectSession}
              onArchiveSession={onArchiveSession}
              onToggleExpand={toggleExpanded}
              onMouseEnter={setHoverSessionId}
              onMouseLeave={() => setHoverSessionId(null)}
              depth={0}
            />
          )}
        </div>
      </div>
      {dirMenu && onCloseDirectory && (
        <div
          ref={dirMenuRef}
          style={{
            position: 'fixed',
            top: dirMenu.y,
            left: dirMenu.x,
            zIndex: 2000,
            minWidth: 148,
            background: '#FFFFFF',
            border: '1px solid #E7E7E7',
            borderRadius: 8,
            boxShadow: '0 6px 24px rgba(0,0,0,0.14)',
            padding: 4,
          }}
        >
          <button
            type="button"
            onClick={() => {
              onCloseDirectory(dirMenu.dir)
              setDirMenu(null)
            }}
            style={{
              width: '100%',
              height: 30,
              border: 'none',
              borderRadius: 6,
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              padding: '0 10px',
              fontSize: 12,
              color: '#B42318',
            }}
          >
            Close Workspace
          </button>
        </div>
      )}
    </div>
  )
}

/** Recursive renderer for session tree */
interface SessionTreeRendererProps {
  nodes: SessionTreeNode[]
  selectedSessionId: string
  expandedSessions: Set<string>
  hoverSessionId: string | null
  archivingSessionId: string | null | undefined
  onSelectSession: (id: string) => void
  onArchiveSession?: (id: string) => void | Promise<void>
  onToggleExpand: (id: string) => void
  onMouseEnter: (id: string | null) => void
  onMouseLeave: () => void
  depth: number
}

function SessionTreeRenderer({
  nodes,
  selectedSessionId,
  expandedSessions,
  hoverSessionId,
  archivingSessionId,
  onSelectSession,
  onArchiveSession,
  onToggleExpand,
  onMouseEnter,
  onMouseLeave,
  depth,
}: SessionTreeRendererProps) {
  return (
    <>
      {nodes.map((node) => {
        const { session } = node
        const hasChildren = node.children.length > 0
        const expanded = expandedSessions.has(session.id)
        const isSelected = session.id === selectedSessionId
        const indentPadding = 12 + depth * 16

        return (
          <div key={session.id}>
            <div
              onMouseEnter={() => onMouseEnter(session.id)}
              onMouseLeave={onMouseLeave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: `4px 8px 4px ${indentPadding}px`,
                background: isSelected ? '#F0E6FA' : 'transparent',
                borderRadius: 6,
              }}
            >
              {/* Expand/collapse button for parent sessions */}
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleExpand(session.id)
                  }}
                  style={{
                    width: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                    color: '#6B6B6B',
                  }}
                  title={expanded ? 'Collapse' : 'Expand'}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    style={{
                      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s',
                    }}
                  >
                    <path d="M3 1 L7 5 L3 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              ) : (
                <div style={{ width: 16, flexShrink: 0 }} />
              )}

              {/* Agent icon */}
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isSelected ? '#8445BC' : depth === 0 ? '#C7C7C7' : '#D4B8E8',
                  flexShrink: 0,
                }}
                title={session.agent || 'unknown'}
              />

              <button
                type="button"
                onClick={() => onSelectSession(session.id)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '4px 0',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {session.agent && depth > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      color: '#8F8F8F',
                      background: '#F0F0F0',
                      padding: '1px 4px',
                      borderRadius: 3,
                      flexShrink: 0,
                    }}
                  >
                    {session.agent}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: depth === 0 ? 500 : 400,
                    color: '#171717',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {session.title || 'Untitled'}
                </span>
              </button>

              {onArchiveSession && (
                <button
                  type="button"
                  title="Delete session (removes from server)"
                  disabled={archivingSessionId === session.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    void onArchiveSession(session.id)
                  }}
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: archivingSessionId === session.id ? 'wait' : 'pointer',
                    opacity: hoverSessionId === session.id ? 1 : 0.35,
                    color: '#737373',
                  }}
                >
                  {archivingSessionId === session.id ? (
                    <span style={{ fontSize: 11 }}>…</span>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 8v13H3V8M1 3h22v5H1V3zM10 12h4" />
                    </svg>
                  )}
                </button>
              )}
            </div>

            {/* Render children if expanded */}
            {hasChildren && expanded && (
              <SessionTreeRenderer
                nodes={node.children}
                selectedSessionId={selectedSessionId}
                expandedSessions={expandedSessions}
                hoverSessionId={hoverSessionId}
                archivingSessionId={archivingSessionId}
                onSelectSession={onSelectSession}
                onArchiveSession={onArchiveSession}
                onToggleExpand={onToggleExpand}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                depth={depth + 1}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
