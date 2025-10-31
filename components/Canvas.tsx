import React, { useState, useRef, useCallback, MouseEvent } from 'react';
import { NodeData, EdgeData, Position } from '../types';
import Node from './Node';
import Edge, { getClosestConnection, getCurvePath } from './Edge';

interface CanvasProps {
  nodes: NodeData[];
  edges: EdgeData[];
  setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
  setEdges: React.Dispatch<React.SetStateAction<EdgeData[]>>;
  updateNodePosition: (id: string, position: Position) => void;
  updateNodeText: (id: string, text: string) => void;
  updateNodeDimensions: (id: string, dimensions: { width: number; height: number }) => void;
  deleteNode: (id: string) => void;
  autoConnect: boolean;
  onOpenContextMenu: (x: number, y: number, node: NodeData) => void;
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
  deleteEdge: (id: string) => void;
  updateEdgeLabel: (id: string, label: string) => void;
  onNodeDragStart: (id: string) => void;
  onNodeDrag: (id: string, position: Position) => void;
  onNodeDragEnd: (id: string) => void;
  snapTarget: { edgeId: string; sourceNodeId: string; targetNodeId: string; } | null;
  draggedNodeId: string | null;
  fontsLoaded: boolean;
}

const Canvas: React.FC<CanvasProps> = ({ 
    nodes, edges, setNodes, setEdges, updateNodePosition, updateNodeText, 
    updateNodeDimensions, deleteNode, autoConnect, onOpenContextMenu,
    selectedEdgeId, setSelectedEdgeId, deleteEdge, updateEdgeLabel,
    onNodeDragStart, onNodeDrag, onNodeDragEnd, snapTarget, draggedNodeId,
    fontsLoaded
}) => {
    const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePosition, setLastMousePosition] = useState<Position | null>(null);

    const [connecting, setConnecting] = useState<{ sourceId: string; sourcePos: Position } | null>(null);
    const [previewEdgePos, setPreviewEdgePos] = useState<Position | null>(null);

    const canvasRef = useRef<SVGSVGElement>(null);
    const gRef = useRef<SVGGElement>(null);

    const getSVGPoint = useCallback((e: MouseEvent) => {
        if (!canvasRef.current || !gRef.current) return { x: 0, y: 0 };
        const point = canvasRef.current.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;
        const screenCTM = gRef.current.getScreenCTM();
        if (screenCTM) {
            return point.matrixTransform(screenCTM.inverse());
        }
        return { x: 0, y: 0 };
    }, []);

    const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
        const target = e.target as SVGElement;
        
        const isNodeTarget = target.closest('g.group');
        const isBackground = target === canvasRef.current || target.parentNode === canvasRef.current;

        if (isBackground) {
             setSelectedEdgeId(null);
        }
        
        // Pan with middle mouse, alt+click, or right-click on background
        if (e.button === 1 || e.altKey || (e.button === 2 && !isNodeTarget)) {
            setIsPanning(true);
            setLastMousePosition({ x: e.clientX, y: e.clientY });
            (e.currentTarget as SVGSVGElement).style.cursor = 'grabbing';
        }
    };

    const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
        if (isPanning && lastMousePosition) {
            const dx = e.clientX - lastMousePosition.x;
            const dy = e.clientY - lastMousePosition.y;
            setView(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setLastMousePosition({ x: e.clientX, y: e.clientY });
        }
        if (connecting) {
            const { x, y } = getSVGPoint(e);
            setPreviewEdgePos({ x, y });
        }
    };
    
    const handleMouseUp = (e: MouseEvent<SVGSVGElement>) => {
        if (isPanning) {
            setIsPanning(false);
            setLastMousePosition(null);
             (e.currentTarget as SVGSVGElement).style.cursor = 'grab';
        }
        if (connecting) {
            setConnecting(null);
            setPreviewEdgePos(null);
        }
    };

    const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const { x, y } = getSVGPoint(e as unknown as MouseEvent);
        
        setView(prev => {
            const newZoom = e.deltaY < 0 ? prev.zoom * zoomFactor : prev.zoom / zoomFactor;
            const clampedZoom = Math.max(0.2, Math.min(newZoom, 3));
            const newX = x - (x - prev.x) * (clampedZoom / prev.zoom);
            const newY = y - (y - prev.y) * (clampedZoom / prev.zoom);
            return { zoom: clampedZoom, x: newX, y: newY };
        });
    };

    const startConnecting = useCallback((sourceId: string, sourcePos: Position) => {
        setConnecting({ sourceId, sourcePos });
    }, []);

    const finishConnecting = useCallback((targetId: string) => {
        if (connecting && connecting.sourceId !== targetId) {
            const sourceNode = nodes.find(n => n.id === connecting.sourceId);
            const targetNode = nodes.find(n => n.id === targetId);
            
            if (sourceNode && targetNode) {
                const { sourceIndex, targetIndex } = getClosestConnection(sourceNode, targetNode);
                const newEdge: EdgeData = {
                    id: `e-${connecting.sourceId}-${targetId}-${Date.now()}`,
                    source: connecting.sourceId,
                    target: targetId,
                    sourceHandle: sourceIndex,
                    targetHandle: targetIndex,
                };
                setEdges((eds) => [...eds, newEdge]);
            }
        }
        setConnecting(null);
        setPreviewEdgePos(null);
    }, [connecting, setEdges, nodes]);
    
    const renderSnapPreview = () => {
        if (!snapTarget || !draggedNodeId) return null;

        const sourceNode = nodes.find(n => n.id === snapTarget.sourceNodeId);
        const targetNode = nodes.find(n => n.id === snapTarget.targetNodeId);
        const draggedNode = nodes.find(n => n.id === draggedNodeId);

        if (!sourceNode || !targetNode || !draggedNode) return null;

        const closest1 = getClosestConnection(sourceNode, draggedNode);
        const path1 = getCurvePath(closest1.source, closest1.sourceIndex, closest1.target, closest1.targetIndex).path;

        const closest2 = getClosestConnection(draggedNode, targetNode);
        const path2 = getCurvePath(closest2.source, closest2.sourceIndex, closest2.target, closest2.targetIndex).path;
        
        return (
            <g className="pointer-events-none">
                <path d={path1} stroke="#22D3EE" strokeWidth="2" fill="none" strokeDasharray="6,6" />
                <path d={path2} stroke="#22D3EE" strokeWidth="2" fill="none" strokeDasharray="6,6" />
            </g>
        )
    }

    return (
        <svg
            ref={canvasRef}
            id="flowchart-canvas"
            width="100%"
            height="100%"
            className="cursor-grab select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp} 
            onWheel={handleWheel}
            onContextMenu={(e) => {
                const target = e.target as SVGElement;
                if (!target.closest('g.group')) {
                    e.preventDefault();
                }
            }}
        >
            <defs>
                <pattern id="pattern-dots" x={view.x % (20 * view.zoom)} y={view.y % (20 * view.zoom)} width={20 * view.zoom} height={20 * view.zoom} patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="1" fill="#374151"></circle>
                </pattern>
                <radialGradient id="grad-start">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#059669" />
                </radialGradient>
                <radialGradient id="grad-end">
                    <stop offset="0%" stopColor="#EF4444" />
                    <stop offset="100%" stopColor="#DC2626" />
                </radialGradient>
                 <linearGradient id="grad-process" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#2563EB" />
                </linearGradient>
                <linearGradient id="grad-decision" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
            </defs>

            <rect width="100%" height="100%" fill="url(#pattern-dots)" />

            <g ref={gRef} id="flowchart-group" transform={`translate(${view.x}, ${view.y}) scale(${view.zoom})`}>
                {edges.map((edge) => (
                    <Edge 
                        key={edge.id} 
                        edge={edge} 
                        nodes={nodes} 
                        autoConnect={autoConnect} 
                        isSelected={edge.id === selectedEdgeId}
                        onSelect={setSelectedEdgeId}
                        onDelete={deleteEdge}
                        onUpdateLabel={updateEdgeLabel}
                        isSnapTarget={snapTarget?.edgeId === edge.id}
                        isHidden={snapTarget?.edgeId === edge.id}
                    />
                ))}
                {renderSnapPreview()}
                {connecting && previewEdgePos && (
                    <line
                        x1={connecting.sourcePos.x}
                        y1={connecting.sourcePos.y}
                        x2={previewEdgePos.x}
                        y2={previewEdgePos.y}
                        stroke="#06b6d4"
                        strokeWidth="2"
                        strokeDasharray="6,6"
                    />
                )}
                {nodes.map((node) => (
                    <Node
                        key={node.id}
                        data={node}
                        onPositionChange={updateNodePosition}
                        onTextChange={updateNodeText}
                        onDelete={deleteNode}
                        onStartConnecting={startConnecting}
                        onFinishConnecting={finishConnecting}
                        onSizeChange={updateNodeDimensions}
                        onOpenContextMenu={onOpenContextMenu}
                        isConnecting={!!connecting}
                        viewZoom={view.zoom}
                        onInteractionStart={() => setSelectedEdgeId(null)}
                        onDragStart={onNodeDragStart}
                        onDrag={onNodeDrag}
                        onDragEnd={onNodeDragEnd}
                        fontsLoaded={fontsLoaded}
                    />
                ))}
            </g>
        </svg>
    );
};

export default Canvas;