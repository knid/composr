"use client"

import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle, type DragEvent } from "react"
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow,
  type Connection, type Node, type Edge, type NodeChange,
  type EdgeChange,
  BackgroundVariant,
  ReactFlowProvider,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
import { StartNode } from "./nodes/start-node"
import { OutputNode } from "./nodes/output-node"
import { BlockNode } from "./nodes/block-node"
import { IfBooleanNode } from "./nodes/if-boolean-node"
import { IfSwitchNode } from "./nodes/if-switch-node"
import { IfPercentageNode } from "./nodes/if-percentage-node"
import { MergeNode } from "./nodes/merge-node"
import { IfExpressionNode } from "./nodes/if-expression-node"
import { CompositionRefNode } from "./nodes/composition-ref-node"

const nodeTypes = {
  start: StartNode,
  promptOutput: OutputNode,
  block: BlockNode,
  ifBoolean: IfBooleanNode,
  ifSwitch: IfSwitchNode,
  ifPercentage: IfPercentageNode,
  ifExpression: IfExpressionNode,
  merge: MergeNode,
  compositionRef: CompositionRefNode,
}

const IF_NODE_TYPES = new Set(["ifBoolean", "ifSwitch", "ifPercentage", "ifExpression"])

const PROTECTED_NODE_TYPES = new Set(["start", "promptOutput"])

const DEFAULT_NODE_DATA: Record<string, Record<string, unknown>> = {
  block: { blockId: "", label: "New Block", tokenCount: 0 },
  ifBoolean: { field: "fieldName" },
  ifSwitch: { field: "fieldName", cases: ["case1", "case2"] },
  ifPercentage: { variants: [{ name: "A", weight: 50 }, { name: "B", weight: 50 }] },
  ifExpression: { expression: "" },
  compositionRef: { compositionId: "", compositionName: "" },
  merge: { inputCount: 2 },
}

const MAX_HISTORY = 50

export interface FlowCanvasHandle {
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
  undo: () => void
  redo: () => void
  autoLayout: () => void
}

interface FlowCanvasProps {
  initialNodes: Node[]
  initialEdges: Edge[]
  onGraphChange?: (nodes: Node[], edges: Edge[]) => void
  onNodeSelect?: (node: Node | null) => void
}

interface HistoryEntry {
  nodes: Node[]
  edges: Edge[]
}

function getNodeDimensions(nodeType: string | undefined): { width: number; height: number } {
  if (IF_NODE_TYPES.has(nodeType ?? "")) return { width: 150, height: 100 }
  if (nodeType === "merge") return { width: 80, height: 50 }
  return { width: 200, height: 80 }
}

/* ── Inner component (needs ReactFlowProvider above it) ── */

const FlowCanvasInner = forwardRef<FlowCanvasHandle, FlowCanvasProps>(
  function FlowCanvasInner({ initialNodes, initialEdges, onGraphChange, onNodeSelect }, ref) {
    const { screenToFlowPosition, getNodes, fitView } = useReactFlow()
    const [nodes, setNodes, onNodesChange] = useNodesState(
      initialNodes.map((n) => n.type === "output" ? { ...n, type: "promptOutput" } : n)
    )
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

    const idCounter = useRef(
      Math.max(
        0,
        ...initialNodes.map((n) => {
          const num = parseInt(n.id.replace(/\D/g, ""), 10)
          return isNaN(num) ? 0 : num
        })
      ) + 1
    )

    /* ── History (undo/redo) ── */
    const history = useRef<HistoryEntry[]>([
      {
        nodes: initialNodes.map((n) => n.type === "output" ? { ...n, type: "promptOutput" } : n),
        edges: initialEdges,
      },
    ])
    const historyIndex = useRef(0)
    const isUndoRedoing = useRef(false)

    const pushHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
      if (isUndoRedoing.current) return
      // Truncate any forward history
      history.current = history.current.slice(0, historyIndex.current + 1)
      history.current.push({
        nodes: newNodes.map((n) => ({ ...n })),
        edges: newEdges.map((e) => ({ ...e })),
      })
      // Enforce max history
      if (history.current.length > MAX_HISTORY) {
        history.current = history.current.slice(history.current.length - MAX_HISTORY)
      }
      historyIndex.current = history.current.length - 1
    }, [])

    const undo = useCallback(() => {
      if (historyIndex.current <= 0) return
      historyIndex.current -= 1
      const entry = history.current[historyIndex.current]
      isUndoRedoing.current = true
      setNodes(entry.nodes.map((n) => ({ ...n })))
      setEdges(entry.edges.map((e) => ({ ...e })))
      // Defer resetting the flag so the state updates complete
      requestAnimationFrame(() => {
        isUndoRedoing.current = false
      })
    }, [setNodes, setEdges])

    const redo = useCallback(() => {
      if (historyIndex.current >= history.current.length - 1) return
      historyIndex.current += 1
      const entry = history.current[historyIndex.current]
      isUndoRedoing.current = true
      setNodes(entry.nodes.map((n) => ({ ...n })))
      setEdges(entry.edges.map((e) => ({ ...e })))
      requestAnimationFrame(() => {
        isUndoRedoing.current = false
      })
    }, [setNodes, setEdges])

    /* ── Copy/Paste ── */
    const copiedNodes = useRef<Node[]>([])

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const isModKey = e.metaKey || e.ctrlKey
        if (!isModKey) return

        if (e.key === "c") {
          const selected = getNodes().filter(
            (n) => n.selected && !PROTECTED_NODE_TYPES.has(n.type ?? "")
          )
          if (selected.length > 0) {
            copiedNodes.current = selected
          }
        }

        if (e.key === "v") {
          if (copiedNodes.current.length === 0) return
          e.preventDefault()
          const newNodes: Node[] = copiedNodes.current.map((n) => ({
            ...n,
            id: `node_${idCounter.current++}`,
            position: { x: n.position.x + 50, y: n.position.y + 50 },
            selected: false,
            data: { ...n.data },
          }))
          setNodes((nds) => {
            const updated = [...nds, ...newNodes]
            setEdges((eds) => {
              pushHistory(updated, eds)
              return eds
            })
            return updated
          })
        }

        if (e.key === "z") {
          e.preventDefault()
          if (e.shiftKey) {
            redo()
          } else {
            undo()
          }
        }
      }

      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }, [getNodes, setNodes, setEdges, pushHistory, undo, redo])

    /* Expose updateNodeData to parent via imperative handle */
    const updateNodeData = useCallback(
      (nodeId: string, newData: Record<string, unknown>) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
          )
        )
      },
      [setNodes]
    )

    /* ── Auto Layout ── */
    const autoLayout = useCallback(() => {
      const currentNodes = getNodes()
      const g = new dagre.graphlib.Graph()
      g.setDefaultEdgeLabel(() => ({}))
      g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 80 })

      currentNodes.forEach((node) => {
        const dims = getNodeDimensions(node.type)
        g.setNode(node.id, { width: dims.width, height: dims.height })
      })

      setEdges((currentEdges) => {
        currentEdges.forEach((edge) => {
          g.setEdge(edge.source, edge.target)
        })

        dagre.layout(g)

        setNodes((nds) => {
          const laid = nds.map((node) => {
            const nodeWithPosition = g.node(node.id)
            if (!nodeWithPosition) return node
            const dims = getNodeDimensions(node.type)
            return {
              ...node,
              position: {
                x: nodeWithPosition.x - dims.width / 2,
                y: nodeWithPosition.y - dims.height / 2,
              },
            }
          })
          pushHistory(laid, currentEdges)
          return laid
        })

        return currentEdges
      })

      // fitView after a short delay to let React render the new positions
      requestAnimationFrame(() => {
        fitView({ padding: 0.2 })
      })
    }, [getNodes, setNodes, setEdges, fitView, pushHistory])

    useImperativeHandle(ref, () => ({ updateNodeData, undo, redo, autoLayout }), [
      updateNodeData,
      undo,
      redo,
      autoLayout,
    ])

    /* Propagate graph changes to parent */
    useEffect(() => {
      onGraphChange?.(nodes, edges)
    }, [nodes, edges, onGraphChange])

    /* Edge label helper for IF nodes */
    const getEdgeLabel = useCallback(
      (sourceId: string, sourceHandle: string | null | undefined) => {
        const sourceNode = nodes.find((n) => n.id === sourceId)
        if (!sourceNode || !IF_NODE_TYPES.has(sourceNode.type ?? "") || !sourceHandle) {
          return {}
        }
        return {
          label: sourceHandle,
          labelStyle: { fill: "#a1a1aa", fontSize: 9, fontFamily: "monospace" },
          labelBgStyle: { fill: "#09090b", fillOpacity: 0.8 },
        }
      },
      [nodes]
    )

    /* Prevent invalid connections */
    const isValidConnection = useCallback(
      (connection: Connection) => {
        // No self-connections
        if (connection.source === connection.target) return false
        // No connecting to Start
        const targetNode = nodes.find((n) => n.id === connection.target)
        if (targetNode?.type === "start") return false
        // No connecting from Output
        const sourceNode = nodes.find((n) => n.id === connection.source)
        if (sourceNode?.type === "promptOutput") return false
        return true
      },
      [nodes]
    )

    /* Connect handler */
    const onConnect = useCallback(
      (connection: Connection) => {
        const labelProps = getEdgeLabel(connection.source, connection.sourceHandle)
        const edge: Edge = {
          id: `e-${connection.source}-${connection.sourceHandle ?? ""}-${connection.target}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#52525b", strokeWidth: 2 },
          ...labelProps,
        }
        setEdges((eds) => {
          const updated = addEdge(edge, eds)
          setNodes((nds) => {
            pushHistory(nds, updated)
            return nds
          })
          return updated
        })
      },
      [setEdges, setNodes, getEdgeLabel, pushHistory]
    )

    /* ── Node & Edge changes with history snapshots ── */
    const handleNodesChange = useCallback(
      (changes: NodeChange[]) => {
        // Filter out removals of protected nodes
        const filteredChanges = changes.filter((change) => {
          if (change.type === "remove") {
            const node = nodes.find((n) => n.id === change.id)
            if (node && PROTECTED_NODE_TYPES.has(node.type ?? "")) {
              return false
            }
          }
          return true
        })
        onNodesChange(filteredChanges)

        // Push history for non-position changes (position changes are handled on drag stop)
        const hasStructuralChange = filteredChanges.some(
          (c) => c.type === "remove" || c.type === "add"
        )
        if (hasStructuralChange) {
          // Defer to next tick so state is updated
          requestAnimationFrame(() => {
            const currentNodes = getNodes()
            setEdges((eds) => {
              pushHistory(currentNodes, eds)
              return eds
            })
          })
        }
      },
      [onNodesChange, nodes, getNodes, setEdges, pushHistory]
    )

    const handleEdgesChange = useCallback(
      (changes: EdgeChange[]) => {
        onEdgesChange(changes)
        const hasRemoveChange = changes.some((c) => c.type === "remove")
        if (hasRemoveChange) {
          requestAnimationFrame(() => {
            const currentNodes = getNodes()
            setEdges((eds) => {
              pushHistory(currentNodes, eds)
              return eds
            })
          })
        }
      },
      [onEdgesChange, getNodes, setEdges, pushHistory]
    )

    /* Snapshot on drag stop (debounced position change) */
    const handleNodeDragStop = useCallback(
      (_event: React.MouseEvent, _node: Node) => {
        const currentNodes = getNodes()
        setEdges((eds) => {
          pushHistory(currentNodes, eds)
          return eds
        })
      },
      [getNodes, setEdges, pushHistory]
    )

    /* Node deletion handler */
    const handleNodesDelete = useCallback(
      (deletedNodes: Node[]) => {
        // Filter out protected nodes - they should never be deleted
        const allowedDeletions = deletedNodes.filter(
          (n) => !PROTECTED_NODE_TYPES.has(n.type ?? "")
        )
        if (allowedDeletions.length === 0) return
        // The actual deletion is already handled by ReactFlow via onNodesChange
        // Just push history after deletion
        requestAnimationFrame(() => {
          const currentNodes = getNodes()
          setEdges((eds) => {
            pushHistory(currentNodes, eds)
            return eds
          })
        })
      },
      [getNodes, setEdges, pushHistory]
    )

    /* Edge deletion handler */
    const handleEdgesDelete = useCallback(
      (_deletedEdges: Edge[]) => {
        requestAnimationFrame(() => {
          const currentNodes = getNodes()
          setEdges((eds) => {
            pushHistory(currentNodes, eds)
            return eds
          })
        })
      },
      [getNodes, setEdges, pushHistory]
    )

    /* Node click / pane click */
    const handleNodeClick = useCallback(
      (_event: React.MouseEvent, node: Node) => {
        onNodeSelect?.(node)
      },
      [onNodeSelect]
    )

    const handlePaneClick = useCallback(() => {
      onNodeSelect?.(null)
    }, [onNodeSelect])

    /* Drag-and-drop from palette */
    const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = "move"
    }, [])

    const handleDrop = useCallback(
      (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        const nodeType = event.dataTransfer.getData("application/reactflow")
        if (!nodeType || !DEFAULT_NODE_DATA[nodeType]) return

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })

        const newNode: Node = {
          id: `node_${idCounter.current++}`,
          type: nodeType,
          position,
          data: { ...DEFAULT_NODE_DATA[nodeType] },
        }

        setNodes((nds) => {
          const updated = [...nds, newNode]
          setEdges((eds) => {
            pushHistory(updated, eds)
            return eds
          })
          return updated
        })
      },
      [screenToFlowPosition, setNodes, setEdges, pushHistory]
    )

    return (
      <div className="h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeDragStop={handleNodeDragStop}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          deleteKeyCode={["Delete", "Backspace"]}
          connectionMode="loose"
          fitView
          proOptions={{ hideAttribution: true }}
          className="bg-background"
          connectionLineStyle={{ stroke: "#3b82f6", strokeWidth: 2 }}
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: true,
            style: { stroke: "#52525b", strokeWidth: 2 },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#27272a" />
          <Controls className="!bg-card !border-border !rounded-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
          <MiniMap
            className="!bg-card !border-border !rounded-lg"
            nodeColor="#27272a"
            maskColor="rgba(0,0,0,0.7)"
          />
        </ReactFlow>
      </div>
    )
  }
)

/* ── Public component (wraps in ReactFlowProvider) ── */

export const FlowCanvas = forwardRef<FlowCanvasHandle, FlowCanvasProps>(
  function FlowCanvas(props, ref) {
    return (
      <ReactFlowProvider>
        <FlowCanvasInner ref={ref} {...props} />
      </ReactFlowProvider>
    )
  }
)
