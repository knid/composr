"use client"

import { useCallback } from "react"
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type Node, type Edge,
  BackgroundVariant,
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
  output: OutputNode,
  block: BlockNode,
  ifBoolean: IfBooleanNode,
  ifSwitch: IfSwitchNode,
  ifPercentage: IfPercentageNode,
  ifExpression: IfExpressionNode,
  merge: MergeNode,
}

interface FlowCanvasProps {
  initialNodes: Node[]
  initialEdges: Edge[]
  onGraphChange?: (nodes: Node[], edges: Edge[]) => void
}

export function FlowCanvas({ initialNodes, initialEdges, onGraphChange }: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds))
    },
    [setEdges]
  )

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-background"
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
