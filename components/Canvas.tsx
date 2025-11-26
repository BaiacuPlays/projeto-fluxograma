
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NodeData, EdgeData, Position, AnnotationData } from '../types';
import Node from './Node';
import Edge, { getClosestConnection, getCurvePath, getConnectionPoints } from './Edge';
import Annotation from './Annotation';

type SnapTarget = {
    edgeId: string;
    sourceNodeId: string;
    targetNodeId: string;
};

type DisplacedNodeInfo = {
    nodeId: string;
    originalPosition: Position;
}

type SnapHandle = {
    nodeId: string;
    handleIndex: number;
    position: Position;
};

const CROWDED_THRESHOLD = 250; 
const SNAP_DISTANCE = 30; // Distância em pixels para ativar o "ímã" da conexão

const defaultDimensions = {
    start: { width: 150, height: 60 },
    end: { width: 150, height: 60 },
    process: { width: 150, height: 70 },
    decision: { width: 160, height: 100 },
};

interface CanvasProps {
  nodes: NodeData[];
  edges: EdgeData[];
  annotations: AnnotationData[];
  setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
  setEdges: React.Dispatch<React.SetStateAction<EdgeData[]>>;
  setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>>;
  updateNodePosition: (id: string, position: Position) => void;
  updateNodeText: (id: string, text: string) => void;
  updateNodeDimensions: (id: string, dimensions: { width: number; height: number }) => void;
  deleteNode: (id: string) => void;
  updateAnnotationPosition: (id: string, position: Position) => void;
  updateAnnotationText: (id: string, text: string) => void;
  updateAnnotationDimensions: (id: string, dimensions: { width: number; height: number }) => void;
  deleteAnnotation: (id: string) => void;
  autoConnect: boolean;
  onOpenContextMenu: (x: number, y: number, node: NodeData) => void;
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
  deleteEdge: (id: string) => void;
  updateEdgeLabel: (id: string, label: string) => void;
  fontsLoaded: boolean;
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedAnnotationIds: Set<string>;
  setSelectedAnnotationIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  snapToGrid: boolean;
}

const Canvas: React.FC<CanvasProps> = ({ 
    nodes, edges, annotations, setNodes, setEdges, setAnnotations,
    updateNodePosition, updateNodeText, updateNodeDimensions, deleteNode, 
    updateAnnotationPosition, updateAnnotationText, updateAnnotationDimensions, deleteAnnotation,
    autoConnect, onOpenContextMenu,
    selectedEdgeId, setSelectedEdgeId, deleteEdge, updateEdgeLabel,
    fontsLoaded, selectedNodeIds, setSelectedNodeIds, selectedAnnotationIds, setSelectedAnnotationIds, snapToGrid
}) => {
    const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePosition, setLastMousePosition] = useState<Position | null>(null);

    const [connecting, setConnecting] = useState<{ sourceId: string; sourcePos: Position; label?: string; sourceHandle?: number } | null>(null);
    const [reconnecting, setReconnecting] = useState<{ edgeId: string; handle: 'source' | 'target' } | null>(null);
    const [previewLine, setPreviewLine] = useState<{ start: Position; end: Position; startHandle?: number; endHandle?: number } | null>(null);
    const [snapHandle, setSnapHandle] = useState<SnapHandle | null>(null);
    
    const [selectionBox, setSelectionBox] = useState<{ start: Position; end: Position } | null>(null);
    const [dragInfo, setDragInfo] = useState<{
      startMousePos: Position;
      nodeStartPositions: Map<string, Position>;
      annotationStartPositions: Map<string, Position>;
      primaryDragId: string;
    } | null>(null);

    const [snapTarget, setSnapTarget] = useState<SnapTarget | null>(null);
    const [displacedNodeInfo, setDisplacedNodeInfo] = useState<DisplacedNodeInfo | null>(null);


    const canvasRef = useRef<SVGSVGElement>(null);
    const gRef = useRef<SVGGElement>(null);

    const getSVGPoint = useCallback((e: React.MouseEvent | React.WheelEvent) => {
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

    const handleItemMouseDown = (e: React.MouseEvent, id: string, type: 'node' | 'annotation') => {
        e.preventDefault();
        
        let newSelectedNodes: Set<string> = new Set(selectedNodeIds);
        let newSelectedAnnotations: Set<string> = new Set(selectedAnnotationIds);

        const itemIsSelected = type === 'node' ? newSelectedNodes.has(id) : newSelectedAnnotations.has(id);

        if (e.shiftKey) {
            if (type === 'node') {
                itemIsSelected ? newSelectedNodes.delete(id) : newSelectedNodes.add(id);
            } else {
                itemIsSelected ? newSelectedAnnotations.delete(id) : newSelectedAnnotations.add(id);
            }
        } else {
            if (!itemIsSelected) {
                newSelectedNodes = type === 'node' ? new Set([id]) : new Set<string>();
                newSelectedAnnotations = type === 'annotation' ? new Set([id]) : new Set<string>();
            }
        }
        
        setSelectedNodeIds(newSelectedNodes);
        setSelectedAnnotationIds(newSelectedAnnotations);
        setSelectedEdgeId(null);

        const nodeStartPositions = new Map<string, Position>();
        newSelectedNodes.forEach(nid => {
            const node = nodes.find(n => n.id === nid);
            if (node) nodeStartPositions.set(nid, node.position);
        });

        const annotationStartPositions = new Map<string, Position>();
        newSelectedAnnotations.forEach(aid => {
            const ann = annotations.find(a => a.id === aid);
            if (ann) annotationStartPositions.set(aid, ann.position);
        });
        
        setDragInfo({
            startMousePos: getSVGPoint(e),
            nodeStartPositions,
            annotationStartPositions,
            primaryDragId: id,
        });
    };

    const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        const target = e.target;
        if (!(target instanceof Element)) return;

        const isNodeTarget = target.closest('.node-group');
        const isAnnotationTarget = target.closest('.annotation-group');
        const isEdgeTarget = target.closest('.group-edge');

        // Pan action (middle mouse, alt-click, or right-click on background)
        if (e.button === 1 || e.altKey || (e.button === 2 && !isNodeTarget)) {
            setIsPanning(true);
            setLastMousePosition({ x: e.clientX, y: e.clientY });
            return;
        }
        
        // If click is on background (not on a node, annotation, or edge)
        if (!isNodeTarget && !isAnnotationTarget && !isEdgeTarget) {
            if (!e.shiftKey) {
                setSelectedNodeIds(new Set());
                setSelectedAnnotationIds(new Set());
            }
            setSelectedEdgeId(null);
            const startPos = getSVGPoint(e);
            setSelectionBox({ start: startPos, end: startPos });
        }
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (isPanning && lastMousePosition) {
            const dx = e.clientX - lastMousePosition.x;
            const dy = e.clientY - lastMousePosition.y;
            setView(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setLastMousePosition({ x: e.clientX, y: e.clientY });
            return;
        }

        const currentMousePos = getSVGPoint(e);

        if (connecting || reconnecting) {
            // Lógica de "ímã" (Snapping) para conexão
            let closestHandle: SnapHandle | null = null;
            let minDistance = SNAP_DISTANCE;

            // Ignora o nó de origem para não conectar nele mesmo (no caso de novo nó)
            const sourceId = connecting?.sourceId || 
                           (reconnecting?.handle === 'source' ? edges.find(ed => ed.id === reconnecting.edgeId)?.target : edges.find(ed => ed.id === reconnecting.edgeId)?.source);

            nodes.forEach(node => {
                if (node.id === sourceId) return; // Não conectar no próprio nó
                
                const points = getConnectionPoints(node);
                points.forEach((point, index) => {
                    const dist = Math.sqrt(Math.pow(point.x - currentMousePos.x, 2) + Math.pow(point.y - currentMousePos.y, 2));
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestHandle = { nodeId: node.id, handleIndex: index, position: point };
                    }
                });
            });

            setSnapHandle(closestHandle);

            const targetPos = closestHandle ? closestHandle.position : currentMousePos;

            if (connecting) {
                setPreviewLine({ 
                    start: connecting.sourcePos, 
                    end: targetPos,
                    startHandle: connecting.sourceHandle,
                    endHandle: closestHandle ? closestHandle.handleIndex : undefined
                });
            } else if (reconnecting) {
                const edge = edges.find(ed => ed.id === reconnecting.edgeId);
                if (edge) {
                    const isSourceHandle = reconnecting.handle === 'source';
                    const fixedNodeId = isSourceHandle ? edge.target : edge.source;
                    const fixedNode = nodes.find(n => n.id === fixedNodeId);
                    
                    if (fixedNode) {
                        const fixedPoints = getConnectionPoints(fixedNode);
                        const fixedIndex = isSourceHandle ? (edge.targetHandle ?? 0) : (edge.sourceHandle ?? 0);
                        const fixedPos = fixedPoints[fixedIndex] || fixedPoints[0];

                        setPreviewLine({
                            start: fixedPos,
                            end: targetPos,
                            startHandle: fixedIndex,
                            endHandle: closestHandle ? closestHandle.handleIndex : undefined
                        });
                    }
                }
            }

        } else if (dragInfo) {
            const dx = currentMousePos.x - dragInfo.startMousePos.x;
            const dy = currentMousePos.y - dragInfo.startMousePos.y;

            const totalSelectionSize = dragInfo.nodeStartPositions.size + dragInfo.annotationStartPositions.size;

            if (totalSelectionSize > 1) {
                const GRID_SIZE = 20;
                const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;
                
                const primaryNodeStartPos = dragInfo.nodeStartPositions.get(dragInfo.primaryDragId) || dragInfo.annotationStartPositions.get(dragInfo.primaryDragId);
                if (!primaryNodeStartPos) return;

                let finalDx = dx;
                let finalDy = dy;

                if (snapToGrid) {
                    const newPrimaryPosUnsnapped = { x: primaryNodeStartPos.x + dx, y: primaryNodeStartPos.y + dy };
                    const newPrimaryPosSnapped = { x: snap(newPrimaryPosUnsnapped.x), y: snap(newPrimaryPosUnsnapped.y) };
                    finalDx = newPrimaryPosSnapped.x - primaryNodeStartPos.x;
                    finalDy = newPrimaryPosSnapped.y - primaryNodeStartPos.y;
                }
                
                 setNodes(currentNodes => currentNodes.map(node => {
                    const startPos = dragInfo.nodeStartPositions.get(node.id);
                    if (startPos) return { ...node, position: { x: startPos.x + finalDx, y: startPos.y + finalDy } };
                    return node;
                 }));
                 setAnnotations(currentAnns => currentAnns.map(ann => {
                    const startPos = dragInfo.annotationStartPositions.get(ann.id);
                    if (startPos) return { ...ann, position: { x: startPos.x + finalDx, y: startPos.y + finalDy } };
                    return ann;
                 }));

                 if (snapTarget) setSnapTarget(null);
                 if (displacedNodeInfo) setDisplacedNodeInfo(null);
            } else { // Single item drag
                 const GRID_SIZE = 20;
                 const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;
                 const startPos = dragInfo.nodeStartPositions.get(dragInfo.primaryDragId) || dragInfo.annotationStartPositions.get(dragInfo.primaryDragId);
                 if (startPos) {
                    let newPosition = { x: startPos.x + dx, y: startPos.y + dy };
                    if (snapToGrid) {
                        newPosition = { x: snap(newPosition.x), y: snap(newPosition.y) };
                    }
                    if (dragInfo.nodeStartPositions.has(dragInfo.primaryDragId)) {
                        handleSingleNodeDrag(dragInfo.primaryDragId, newPosition);
                    } else {
                        updateAnnotationPosition(dragInfo.primaryDragId, newPosition);
                    }
                 }
            }
        } else if (selectionBox) {
             setSelectionBox(prev => prev ? { ...prev, end: currentMousePos } : null);
        }
    };
    
    const handleSingleNodeDragEnd = useCallback((nodeId: string) => {
        setDisplacedNodeInfo(null);
        if (snapTarget) {
            const draggedNode = nodes.find(n => n.id === nodeId);
            if (!draggedNode) return;
            
            setEdges(prevEdges => {
                const filteredEdges = prevEdges.filter(e => e.id !== snapTarget.edgeId);
                const newEdge1: EdgeData = {
                    id: `e-${snapTarget.sourceNodeId}-${draggedNode.id}-${Date.now()}`,
                    source: snapTarget.sourceNodeId,
                    target: draggedNode.id,
                };
                const newEdge2: EdgeData = {
                    id: `e-${draggedNode.id}-${snapTarget.targetNodeId}-${Date.now() + 1}`,
                    source: draggedNode.id,
                    target: snapTarget.targetNodeId,
                };
                return [...filteredEdges, newEdge1, newEdge2];
            });
        }
        setSnapTarget(null);
    }, [nodes, snapTarget, setEdges]);

    const endDrag = useCallback(() => {
        if (!dragInfo) return;
        
        const totalSelectionSize = dragInfo.nodeStartPositions.size + dragInfo.annotationStartPositions.size;

        if (totalSelectionSize === 1 && dragInfo.nodeStartPositions.has(dragInfo.primaryDragId)) {
            handleSingleNodeDragEnd(dragInfo.primaryDragId);
        } else {
            if (snapTarget) setSnapTarget(null);
        }
        setDragInfo(null);
    }, [dragInfo, handleSingleNodeDragEnd, snapTarget]);

    const finishConnecting = useCallback((targetId: string, targetHandleIndex?: number) => {
        if (connecting && connecting.sourceId !== targetId) {
            const sourceNode = nodes.find(n => n.id === connecting.sourceId);
            const targetNode = nodes.find(n => n.id === targetId);
            
            if (sourceNode && targetNode) {
                let sourceIndex = connecting.sourceHandle ?? 0;
                let targetIndex = targetHandleIndex ?? 0;

                // Se não houver handles definidos explicitamente (não snapou), calcula o mais próximo
                if (targetHandleIndex === undefined) {
                    const closest = getClosestConnection(sourceNode, targetNode);
                    if (connecting.sourceHandle === undefined) sourceIndex = closest.sourceIndex;
                    targetIndex = closest.targetIndex;
                }

                const newEdge: EdgeData = {
                    id: `e-${connecting.sourceId}-${targetId}-${Date.now()}`,
                    source: connecting.sourceId,
                    target: targetId,
                    sourceHandle: sourceIndex,
                    targetHandle: targetIndex,
                    label: connecting.label,
                };
                setEdges((eds) => [...eds, newEdge]);
            }
        }
        setConnecting(null);
        setPreviewLine(null);
        setSnapHandle(null);
    }, [connecting, setEdges, nodes]);

    const finishReconnecting = useCallback((targetNodeId: string, targetHandleIndex?: number) => {
        if (!reconnecting) return;

        setEdges(prevEdges => {
            const edgeToUpdate = prevEdges.find(e => e.id === reconnecting.edgeId);
            if (!edgeToUpdate) return prevEdges;

            const isSourceHandle = reconnecting.handle === 'source';
            const fixedNodeId = isSourceHandle ? edgeToUpdate.target : edgeToUpdate.source;

            if (fixedNodeId === targetNodeId) {
                return prevEdges; // Dropped on the same node
            }
            
            const sourceNode = nodes.find(n => n.id === (isSourceHandle ? targetNodeId : fixedNodeId));
            const targetNode = nodes.find(n => n.id === (isSourceHandle ? fixedNodeId : targetNodeId));

            if (!sourceNode || !targetNode) return prevEdges;
            
            let sourceIndex: number;
            let targetIndex: number;
            
            // Lógica para preservar o handle do lado fixo e atualizar o lado arrastado
            if (isSourceHandle) {
                targetIndex = edgeToUpdate.targetHandle ?? 0;
                sourceIndex = targetHandleIndex ?? getClosestConnection(sourceNode, targetNode).sourceIndex;
            } else {
                sourceIndex = edgeToUpdate.sourceHandle ?? 0;
                targetIndex = targetHandleIndex ?? getClosestConnection(sourceNode, targetNode).targetIndex;
            }

            return prevEdges.map(e => {
                if (e.id === reconnecting.edgeId) {
                    return {
                        ...e,
                        source: sourceNode.id,
                        target: targetNode.id,
                        sourceHandle: sourceIndex,
                        targetHandle: targetIndex,
                    };
                }
                return e;
            });
        });
        setReconnecting(null);
        setPreviewLine(null);
        setSnapHandle(null);
    }, [reconnecting, setEdges, nodes]);
    
    const handleEndInteraction = useCallback((targetNodeId: string | null) => {
        if (isPanning) {
            setIsPanning(false);
            setLastMousePosition(null);
        }
        
        endDrag();
        
        if (selectionBox) {
            const { start, end } = selectionBox;
            const x1 = Math.min(start.x, end.x);
            const y1 = Math.min(start.y, end.y);
            const x2 = Math.max(start.x, end.x);
            const y2 = Math.max(start.y, end.y);

            if (Math.abs(start.x - end.x) > 5 || Math.abs(start.y - end.y) > 5) {
                const newlySelectedNodes = new Set<string>(selectedNodeIds);
                nodes.forEach(node => {
                    const nodeWidth = node.width || defaultDimensions[node.type].width;
                    const nodeHeight = node.height || defaultDimensions[node.type].height;
                    if (node.position.x < x2 && node.position.x + nodeWidth > x1 &&
                        node.position.y < y2 && node.position.y + nodeHeight > y1) {
                        newlySelectedNodes.add(node.id);
                    }
                });
                setSelectedNodeIds(newlySelectedNodes);

                const newlySelectedAnns = new Set<string>(selectedAnnotationIds);
                annotations.forEach(ann => {
                    if (ann.position.x < x2 && ann.position.x + (ann.width || 100) > x1 &&
                        ann.position.y < y2 && ann.position.y + (ann.height || 80) > y1) {
                        newlySelectedAnns.add(ann.id);
                    }
                });
                setSelectedAnnotationIds(newlySelectedAnns);
            }
            setSelectionBox(null);
        }
        
        // Prioriza o snapHandle se ele existir, mesmo que o mouse não esteja exatamente sobre a caixa do nó
        if (snapHandle) {
             if (connecting) finishConnecting(snapHandle.nodeId, snapHandle.handleIndex);
             else if (reconnecting) finishReconnecting(snapHandle.nodeId, snapHandle.handleIndex);
        } else if (targetNodeId) {
            if (connecting) finishConnecting(targetNodeId);
            else if (reconnecting) finishReconnecting(targetNodeId);
        } else {
            setConnecting(null);
            setReconnecting(null);
            setPreviewLine(null);
            setSnapHandle(null);
        }
    }, [isPanning, endDrag, selectionBox, connecting, reconnecting, finishConnecting, finishReconnecting, nodes, annotations, selectedNodeIds, setSelectedNodeIds, selectedAnnotationIds, setSelectedAnnotationIds, snapHandle]);


    const getSVGPointFromEvent = useCallback((e: globalThis.MouseEvent): Position => {
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

    useEffect(() => {
        const isInteracting = !!connecting || !!reconnecting || !!dragInfo || !!selectionBox || isPanning;

        const handleGlobalMouseUp = (e: globalThis.MouseEvent) => {
            const point = getSVGPointFromEvent(e);
            let targetNodeId: string | null = null;
            
            // Iterate backwards to find the top-most node
            for (let i = nodes.length - 1; i >= 0; i--) {
                const node = nodes[i];
                const nodeWidth = node.width ?? defaultDimensions[node.type].width;
                const nodeHeight = node.height ?? defaultDimensions[node.type].height;
                
                if (
                    point.x >= node.position.x && point.x <= node.position.x + nodeWidth &&
                    point.y >= node.position.y && point.y <= node.position.y + nodeHeight
                ) {
                    targetNodeId = node.id;
                    break;
                }
            }
            
            handleEndInteraction(targetNodeId);
        };

        if (isInteracting) {
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }

        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [connecting, reconnecting, dragInfo, selectionBox, isPanning, nodes, getSVGPointFromEvent, handleEndInteraction]);


    const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const { x, y } = getSVGPoint(e);
        
        setView(prev => {
            const newZoom = e.deltaY < 0 ? prev.zoom * zoomFactor : prev.zoom / zoomFactor;
            const clampedZoom = Math.max(0.2, Math.min(newZoom, 3));
            const newX = x - (x - prev.x) * (clampedZoom / prev.zoom);
            const newY = y - (y - prev.y) * (clampedZoom / prev.zoom);
            return { zoom: clampedZoom, x: newX, y: newY };
        });
    };

    const startConnecting = useCallback((sourceId: string, sourcePos: Position, label?: string, sourceHandle?: number) => {
        setConnecting({ sourceId, sourcePos, label, sourceHandle });
    }, []);

    const startReconnecting = useCallback((edgeId: string, handle: 'source' | 'target') => {
        setReconnecting({ edgeId, handle });
        setSelectedEdgeId(edgeId);
    }, [setSelectedEdgeId]);
    
    

    // --- Snapping and single-node drag logic ---
    const handleSingleNodeDrag = useCallback((nodeId: string, newPosition: Position) => {
        updateNodePosition(nodeId, newPosition);

        const draggedNode = nodes.find(n => n.id === nodeId);
        if (!draggedNode) return;

        const nodeCenter = {
            x: newPosition.x + (draggedNode.width || 150) / 2,
            y: newPosition.y + (draggedNode.height || 70) / 2,
        };

        let intersectedEdge: EdgeData | null = null;
        let closestDistance = Infinity;

        for (const edge of edges) {
            if (edge.source === nodeId || edge.target === nodeId) continue;
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);

            if (!sourceNode || !targetNode) continue;

            const closest = getClosestConnection(sourceNode, targetNode);
            const { labelPos } = getCurvePath(closest.source, closest.sourceIndex, closest.target, closest.targetIndex);

            const distance = Math.sqrt(
                Math.pow(nodeCenter.x - labelPos.x, 2) + Math.pow(nodeCenter.y - labelPos.y, 2)
            );

            const SNAP_THRESHOLD = 35;
            if (distance < SNAP_THRESHOLD && distance < closestDistance) {
                intersectedEdge = edge;
                closestDistance = distance;
            }
        }

        if (intersectedEdge) {
            if (!snapTarget || snapTarget.edgeId !== intersectedEdge.id) {
                const sourceNode = nodes.find(n => n.id === intersectedEdge!.source);
                const targetNode = nodes.find(n => n.id === intersectedEdge!.target);

                if (sourceNode && targetNode) {
                    const dx = targetNode.position.x - sourceNode.position.x;
                    const dy = targetNode.position.y - sourceNode.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < CROWDED_THRESHOLD) {
                        const displacement = (draggedNode.width || 150) / 2 + 60;
                        const newTargetX = targetNode.position.x + (dx / dist) * displacement;
                        const newTargetY = targetNode.position.y + (dy / dist) * displacement;
                        
                        setDisplacedNodeInfo({ nodeId: targetNode.id, originalPosition: targetNode.position });
                        updateNodePosition(targetNode.id, { x: newTargetX, y: newTargetY });
                    }
                }
            }
            setSnapTarget({
                edgeId: intersectedEdge.id,
                sourceNodeId: intersectedEdge.source,
                targetNodeId: intersectedEdge.target,
            });

        } else {
            if (snapTarget && displacedNodeInfo) {
                updateNodePosition(displacedNodeInfo.nodeId, displacedNodeInfo.originalPosition);
                setDisplacedNodeInfo(null);
            }
            setSnapTarget(null);
        }
    }, [nodes, edges, updateNodePosition, snapTarget, displacedNodeInfo]);
    
    const renderSnapPreview = () => {
        if (!snapTarget || !dragInfo || (dragInfo.nodeStartPositions.size + dragInfo.annotationStartPositions.size) > 1) return null;

        const sourceNode = nodes.find(n => n.id === snapTarget.sourceNodeId);
        const targetNode = nodes.find(n => n.id === snapTarget.targetNodeId);
        const draggedNode = nodes.find(n => n.id === dragInfo.primaryDragId);

        if (!sourceNode || !targetNode || !draggedNode) return null;

        const closest1 = getClosestConnection(sourceNode, draggedNode);
        const path1 = getCurvePath(closest1.source, closest1.sourceIndex, closest1.target, closest1.targetIndex).path;

        const closest2 = getClosestConnection(draggedNode, targetNode);
        const path2 = getCurvePath(closest2.source, closest2.sourceIndex, closest2.target, closest2.targetIndex).path;
        
        return (
            <g className="pointer-events-none">
                <path d={path1} stroke="var(--color-accent)" strokeWidth="2" fill="none" strokeDasharray="6,6" />
                <path d={path2} stroke="var(--color-accent)" strokeWidth="2" fill="none" strokeDasharray="6,6" />
            </g>
        )
    }
    
    const selectedEdge = selectedEdgeId ? edges.find(e => e.id === selectedEdgeId) : null;
    const unselectedEdges = edges.filter(e => e.id !== selectedEdgeId);

    return (
        <svg
            ref={canvasRef}
            id="flowchart-canvas"
            width="100%"
            height="100%"
            className="select-none"
            style={{ cursor: isPanning || dragInfo ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onWheel={handleWheel}
            onContextMenu={(e) => {
                const target = e.target;
                if (!(target instanceof Element) || !target.closest('.node-group')) {
                    e.preventDefault();
                }
            }}
        >
            <defs>
                <pattern id="pattern-dots" x={view.x % (20 * view.zoom)} y={view.y % (20 * view.zoom)} width={20 * view.zoom} height={20 * view.zoom} patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="1" fill="var(--color-border)"></circle>
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
                <filter id="annotation-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="3" dy="5" stdDeviation="5" floodColor="var(--color-shadow)" floodOpacity="0.4" />
                </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#pattern-dots)" />

            <g ref={gRef} id="flowchart-group" transform={`translate(${view.x}, ${view.y}) scale(${view.zoom})`}>
                {/* Render unselected edges first */}
                {unselectedEdges.map((edge) => (
                    <Edge 
                        key={edge.id} 
                        edge={edge} 
                        nodes={nodes} 
                        autoConnect={autoConnect} 
                        isSelected={false}
                        onSelect={setSelectedEdgeId}
                        onDelete={deleteEdge}
                        onUpdateLabel={updateEdgeLabel}
                        isSnapTarget={snapTarget?.edgeId === edge.id}
                        isHidden={snapTarget?.edgeId === edge.id}
                        isReconnecting={reconnecting?.edgeId === edge.id}
                        onStartReconnecting={startReconnecting}
                    />
                ))}

                {annotations.map((ann) => (
                    <Annotation
                        key={ann.id}
                        data={ann}
                        onPositionChange={updateAnnotationPosition}
                        onTextChange={updateAnnotationText}
                        onSizeChange={updateAnnotationDimensions}
                        onDelete={deleteAnnotation}
                        onMouseDown={(e) => handleItemMouseDown(e, ann.id, 'annotation')}
                        isSelected={selectedAnnotationIds.has(ann.id)}
                        viewZoom={view.zoom}
                        fontsLoaded={fontsLoaded}
                    />
                ))}

                {/* Then render all nodes */}
                {nodes.map((node) => (
                    <Node
                        key={node.id}
                        data={node}
                        onPositionChange={updateNodePosition}
                        onTextChange={updateNodeText}
                        onDelete={deleteNode}
                        onStartConnecting={startConnecting}
                        onSizeChange={updateNodeDimensions}
                        onOpenContextMenu={onOpenContextMenu}
                        isConnecting={!!connecting || !!reconnecting}
                        viewZoom={view.zoom}
                        onInteractionStart={() => {
                            setSelectedEdgeId(null);
                            setSelectedAnnotationIds(new Set());
                        }}
                        onMouseDown={(e, id) => handleItemMouseDown(e, id, 'node')}
                        isSelected={selectedNodeIds.has(node.id)}
                        fontsLoaded={fontsLoaded}
                    />
                ))}

                {/* Then render the selected edge on top */}
                {selectedEdge && (
                    <Edge 
                        key={selectedEdge.id} 
                        edge={selectedEdge} 
                        nodes={nodes} 
                        autoConnect={autoConnect} 
                        isSelected={true}
                        onSelect={setSelectedEdgeId}
                        onDelete={deleteEdge}
                        onUpdateLabel={updateEdgeLabel}
                        isSnapTarget={snapTarget?.edgeId === selectedEdge.id}
                        isHidden={snapTarget?.edgeId === selectedEdge.id}
                        isReconnecting={reconnecting?.edgeId === selectedEdge.id}
                        onStartReconnecting={startReconnecting}
                    />
                )}
                
                {renderSnapPreview()}
                
                {/* Visualização da linha de conexão sendo criada/arrastada */}
                {previewLine && (
                    <>
                         <path
                            d={getCurvePath(previewLine.start, previewLine.startHandle ?? -1, previewLine.end, previewLine.endHandle ?? -1).path}
                            stroke="var(--color-accent)"
                            strokeWidth="2"
                            fill="none"
                            strokeDasharray="6,6"
                            className="pointer-events-none"
                        />
                        {/* Indicador visual de onde vai conectar (Snapping) */}
                        {snapHandle && (
                             <circle 
                                cx={snapHandle.position.x} 
                                cy={snapHandle.position.y} 
                                r={8} 
                                fill="none" 
                                stroke="var(--color-accent)" 
                                strokeWidth="2"
                                className="pointer-events-none animate-pulse"
                            />
                        )}
                    </>
                )}
                
                {selectionBox && (
                    <rect
                        x={Math.min(selectionBox.start.x, selectionBox.end.x)}
                        y={Math.min(selectionBox.start.y, selectionBox.end.y)}
                        width={Math.abs(selectionBox.start.x - selectionBox.end.x)}
                        height={Math.abs(selectionBox.start.y - selectionBox.end.y)}
                        fill="rgba(34, 211, 238, 0.2)"
                        stroke="var(--color-accent)"
                        strokeWidth={1 / view.zoom}
                        strokeDasharray={`${4 / view.zoom} ${2 / view.zoom}`}
                        className="pointer-events-none"
                    />
                )}
            </g>
        </svg>
    );
};

export default Canvas;
