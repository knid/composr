"use client"

import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle, type DragEvent } from "react"
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow,
  type Connection, type Node, type Edge,
  BackgroundVariant,
  ReactFlowProvider,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { StartNode } from "./nodes/start-node"
import { OutputNode } from "./nodes/output-node"
import { BlockNode } from "./nodes/block-node"
import { IfBooleanNode } from "./nodes/if-boolean-node"
import { IfSwitchNode } from "./nodes/if-switch-node"
import { IfPercentageNode } from "./nodes/if-percentage-node"
import { MergeNode } from "./nodes/merge-node"
import { IfExpressionNode } from "./nodes/if-expression-node"

const nodeTypes = {
  start: StartNode,
  promptOutput: OutputNode,
  block: BlockNode,
  ifBoolean: IfBooleanNode,
  ifSwitch: IfSwitchNode,
  ifPercentage: IfPercentageNode,
  ifExpression: IfExpressionNode,
  merge: MergeNode,
}

const IF_NODE_TYPES = new Set(["ifBoolean", "ifSwitch", "ifPercentage", "ifExpression"])

const DEFAULT_NODE_DATA: Record<string, Record<string, unknown>> = {
  block: { blockId: "", label: "New Block", tokenCount: 0 },
  ifBoolean: { field: "fieldName" },
  ifSwitch: { field: "fieldName", cases: ["case1", "case2"] },
  ifPercentage: { variants: [{ name: "A", weight: 50 }, { name: "B", weight: 50 }] },
  ifExpression: { expression: "" },
  merge: {},
}

export interface FlowCanvasHandle {
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
}

interface FlowCanvasProps {
  initialNodes: Node[]
  initialEdges: Edge[]
  onGraphChange?: (nodes: Node[], edges: Edge[]) => void
  onNodeSelect?: (node: Node | null) => void
}

/* ── Inner component (needs ReactFlowProvider above it) ── */

const FlowCanvasInner = forwardRef<FlowCanvasHandle, FlowCanvasProps>(
  function FlowCanvasInner({ initialNodes, initialEdges, onGraphChange, onNodeSelect }, ref) {
    const { screenToFlowPosition } = useReactFlow()
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

    useImperativeHandle(ref, () => ({ updateNodeData }), [updateNodeData])

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
        setEdges((eds) => addEdge(edge, eds))
      },
      [setEdges, getEdgeLabel]
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

        setNodes((nds) => [...nds, newNode])
      },
      [screenToFlowPosition, setNodes]
    )

    return (
      <div className="h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
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
