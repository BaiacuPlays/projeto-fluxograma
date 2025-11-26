
import React, { useState, useRef, useEffect, KeyboardEvent, useLayoutEffect } from 'react';
import { NodeData, Position, NodeType } from '../types';
import { TrashIcon } from './Icons';

interface NodeProps {
  data: NodeData;
  onPositionChange: (id: string, position: Position) => void;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onStartConnecting: (id: string, sourcePos: Position, label?: string, sourceHandle?: number) => void;
  onSizeChange: (id: string, dimensions: { width: number; height: number }) => void;
  onOpenContextMenu: (x: number, y: number, node: NodeData) => void;
  isConnecting: boolean;
  viewZoom: number;
  onInteractionStart: () => void;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  isSelected: boolean;
  fontsLoaded: boolean;
}

interface ResizingState {
    handle: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startNodeX: number;
    startNodeY: number;
}

interface ConnectionPoint {
  pos: Position;
  label?: string;
  index: number;
}

const MIN_DIMENSIONS: Record<NodeType, { width: number, height: number }> = {
    start: { width: 150, height: 60 },
    end: { width: 150, height: 60 },
    process: { width: 150, height: 70 },
    decision: { width: 160, height: 100 },
};

const MAX_WIDTH = 350;

const getShape = (type: NodeType, width: number, height: number): React.ReactElement => {
    switch (type) {
        case 'start':
        case 'end':
            return <rect x="0" y="0" width={width} height={height} rx={height / 2} ry={height / 2} />;
        case 'process':
            return <rect x="0" y="0" width={width} height={height} rx="8" ry="8"/>;
        case 'decision':
            return <path d={`M ${width / 2} 0 L ${width} ${height / 2} L ${width / 2} ${height} L 0 ${height / 2} Z`} />;
        default:
            return <rect x="0" y="0" width={width} height={height} />;
    }
};

const nodeClasses: Record<NodeType, string> = {
    start: 'node-start',
    process: 'node-process',
    decision: 'node-decision',
    end: 'node-end',
};

// Índices: 0: Top, 1: Right, 2: Bottom, 3: Left
const getConnectionPoints = (type: NodeType, width: number, height: number): ConnectionPoint[] => {
    if (type === 'decision') {
        return [
            { pos: { x: width / 2, y: 0 }, index: 0 },                  // Top (Entrada)
            { pos: { x: width, y: height / 2 }, label: 'Sim', index: 1 }, // Right (Saída)
            { pos: { x: width / 2, y: height }, label: 'Não', index: 2 }, // Bottom (Saída)
            { pos: { x: 0, y: height / 2 }, index: 3 },                  // Left (Extra)
        ];
    }
    return [
        { pos: { x: width / 2, y: 0 }, index: 0 },    // Top
        { pos: { x: width, y: height / 2 }, index: 1 }, // Right
        { pos: { x: width / 2, y: height }, index: 2 }, // Bottom
        { pos: { x: 0, y: height / 2 }, index: 3 },     // Left
    ];
};

const Node: React.FC<NodeProps> = ({ 
    data, onPositionChange, onTextChange, onDelete, onStartConnecting, 
    onSizeChange, onOpenContextMenu, isConnecting, viewZoom, 
    onInteractionStart, onMouseDown, isSelected, fontsLoaded
}) => {
    const [resizingState, setResizingState] = useState<ResizingState | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(data.text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    
    const autoSizeModeRef = useRef(data.width === undefined);

    useEffect(() => {
        if (data.width === undefined) {
            autoSizeModeRef.current = true;
        }
    }, [data.width]);

    const minWidth = MIN_DIMENSIONS[data.type].width;
    const minHeight = MIN_DIMENSIONS[data.type].height;

    const { width = minWidth, height = minHeight } = data;
    
    useLayoutEffect(() => {
        if (!autoSizeModeRef.current || isEditing || !textRef.current || resizingState || !fontsLoaded) {
            return;
        }
    
        const textEl = textRef.current;
        const paddingX = data.type === 'decision' ? 40 : 20;
        const paddingY = data.type === 'decision' ? 20 : 20;
    
        textEl.style.width = 'auto'; 
        const naturalWidth = textEl.scrollWidth;
        const requiredWidthForText = Math.max(minWidth, naturalWidth + paddingX);
        
        const calculatedWidth = Math.min(MAX_WIDTH, requiredWidthForText);
        
        const contentWidth = calculatedWidth - paddingX;
        textEl.style.width = `${contentWidth}px`;
        
        const wrappedHeight = textEl.scrollHeight;
        
        let calculatedHeight;
        if (data.type === 'decision') {
            calculatedHeight = Math.max(minHeight, wrappedHeight + paddingY);
        } else {
            calculatedHeight = Math.max(minHeight, wrappedHeight + paddingY);
        }
        
        textEl.style.width = ''; 
    
        if (calculatedWidth !== width || calculatedHeight !== height) {
            onSizeChange(data.id, { width: calculatedWidth, height: calculatedHeight });
        }
    }, [data.text, data.id, onSizeChange, isEditing, width, height, data.type, minWidth, minHeight, resizingState, fontsLoaded]);

    const connectionPoints = getConnectionPoints(data.type, width, height);
    
    // Mostra apenas os pontos com labels (Sim/Não) permanentemente para decisão, mas permite interagir com todos
    const alwaysVisibleConnectors = data.type === 'decision' ? connectionPoints.filter(p => p.label) : [];
    // No hover, mostra todos os pontos
    const hoverConnectors = data.type === 'decision' ? connectionPoints.filter(p => !p.label) : connectionPoints;

    const shapeComponent = getShape(data.type, width, height);
    const shapeProps: React.SVGProps<any> = {};

    if (data.color) {
        shapeProps.stroke = data.color;
        shapeProps.fill = data.color;
    } else {
        shapeProps.fill = `url(#grad-${data.type})`;
    }
    const styledShape = React.cloneElement(shapeComponent, { ...shapeProps });


    const handleMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName.toLowerCase() === 'circle' || 
            target.tagName.toLowerCase() === 'textarea' ||
            target.closest('.delete-button-wrapper') ||
            target.dataset.resizeHandle ||
            e.button === 2
            ) {
            return;
        }
        e.stopPropagation();
        onInteractionStart();
        onMouseDown(e, data.id);
    };

    const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
        e.stopPropagation();
        e.preventDefault();
        onInteractionStart();
        autoSizeModeRef.current = false;
        setResizingState({
            handle,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: width,
            startHeight: height,
            startNodeX: data.position.x,
            startNodeY: data.position.y,
        });
    };
    
    const handleDoubleClick = () => {
        setIsEditing(true);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditText(e.target.value);
    };

    const handleTextBlur = () => {
        onTextChange(data.id, editText);
        setIsEditing(false);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextBlur();
        }
        if (e.key === 'Escape') {
            setEditText(data.text);
            setIsEditing(false);
        }
    }

    const handleConnectorMouseDown = (e: React.MouseEvent, point: ConnectionPoint) => {
        e.stopPropagation();
        onInteractionStart();
        const absolutePos = {
            x: data.position.x + point.pos.x,
            y: data.position.y + point.pos.y,
        };
        // Passa o índice do handle explicitamente
        onStartConnecting(data.id, absolutePos, point.label, point.index);
    };
    
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenContextMenu(e.clientX, e.clientY, data);
    }

    useEffect(() => {
        if (!resizingState) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = (e.clientX - resizingState.startX) / viewZoom;
            const dy = (e.clientY - resizingState.startY) / viewZoom;
            
            let newWidth = resizingState.startWidth;
            let newHeight = resizingState.startHeight;
            let newX = resizingState.startNodeX;
            let newY = resizingState.startNodeY;

            if (resizingState.handle.includes('right')) newWidth = resizingState.startWidth + dx;
            if (resizingState.handle.includes('left')) {
                newWidth = resizingState.startWidth - dx;
                newX = resizingState.startNodeX + dx;
            }
            if (resizingState.handle.includes('bottom')) newHeight = resizingState.startHeight + dy;
            if (resizingState.handle.includes('top')) {
                newHeight = resizingState.startHeight - dy;
                newY = resizingState.startNodeY + dy;
            }
            
            const constrainedWidth = Math.min(MAX_WIDTH, Math.max(minWidth, newWidth));
            const constrainedHeight = Math.max(minHeight, newHeight);

            if (newWidth < minWidth && resizingState.handle.includes('left')) {
                newX = resizingState.startNodeX + (resizingState.startWidth - minWidth);
            }
             if (newWidth > MAX_WIDTH && resizingState.handle.includes('left')) {
                newX = resizingState.startNodeX + (resizingState.startWidth - MAX_WIDTH);
            }
            if (newHeight < minHeight && resizingState.handle.includes('top')) {
                newY = resizingState.startNodeY + (resizingState.startHeight - minHeight);
            }

            onSizeChange(data.id, { width: constrainedWidth, height: constrainedHeight });
            if (newX !== data.position.x || newY !== data.position.y) {
                 onPositionChange(data.id, { x: newX, y: newY });
            }
        };

        const handleMouseUp = () => setResizingState(null);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingState, onPositionChange, onSizeChange, data.id, data.position, viewZoom, minWidth, minHeight]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);
    
     const resizeHandles = (() => {
        if (data.type === 'start' || data.type === 'end') {
            const r = height / 2;
            const offset = r * (1 - Math.SQRT1_2);
            return [
                { id: 'top-left', x: offset - 5, y: offset - 5, cursor: 'nwse-resize' },
                { id: 'top-right', x: width - offset - 5, y: offset - 5, cursor: 'nesw-resize' },
                { id: 'bottom-left', x: offset - 5, y: height - offset - 5, cursor: 'nesw-resize' },
                { id: 'bottom-right', x: width - offset - 5, y: height - offset - 5, cursor: 'nwse-resize' },
            ];
        }
        return [
            { id: 'top-left', x: -5, y: -5, cursor: 'nwse-resize' },
            { id: 'top-right', x: width - 5, y: -5, cursor: 'nesw-resize' },
            { id: 'bottom-left', x: -5, y: height - 5, cursor: 'nesw-resize' },
            { id: 'bottom-right', x: width - 5, y: height - 5, cursor: 'nwse-resize' },
        ];
    })();

    return (
        <g 
            id={data.id}
            transform={`translate(${data.position.x}, ${data.position.y})`} 
            className={`group node-group ${resizingState ? 'cursor-[var(--cursor)]' : 'cursor-default'} transition-transform duration-200 ease-out`}
            style={{'--cursor': resizingState ? resizeHandles.find(h => h.id.startsWith(resizingState.handle))?.cursor : 'default'} as React.CSSProperties}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
        >
            <g className={`node-shape ${!data.color ? nodeClasses[data.type] : ''} ${isConnecting ? 'hover:stroke-cyan-200 hover:stroke-[3px]' : ''}`}>
                {styledShape}
            </g>

            {isSelected && (
                <rect
                    x={-4} y={-4}
                    width={width + 8}
                    height={height + 8}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                    rx={data.type === 'start' || data.type === 'end' ? (height + 8) / 2 : 12}
                    strokeDasharray="4 4"
                    className="pointer-events-none"
                />
            )}

            {isEditing ? (
                 <foreignObject x="0" y="0" width={width} height={height}>
                    <div className="w-full h-full flex items-center justify-center p-2 box-border">
                        <textarea
                            ref={textareaRef}
                            value={editText}
                            onChange={handleTextChange}
                            onBlur={handleTextBlur}
                            onKeyDown={handleKeyDown}
                            className="w-full h-full bg-transparent text-white text-center font-medium text-sm p-1 m-0 border border-[var(--color-accent)] rounded-md focus:ring-0 resize-none overflow-y-auto"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        />
                    </div>
                 </foreignObject>
            ) : (
                <foreignObject x="0" y="0" width={width} height={height} className="pointer-events-none">
                     <div className="w-full h-full flex items-center justify-center text-center text-white font-medium text-sm break-all p-2 box-border">
                        <div 
                            ref={textRef} 
                            style={{ maxWidth: data.type === 'decision' ? `${width - 40}px` : undefined }}
                        >
                            {data.text}
                        </div>
                     </div>
                </foreignObject>
            )}

            {!isEditing && (
                <g>
                    {alwaysVisibleConnectors.map((point) => (
                       <g
                            key={`always-${point.index}`}
                            className="cursor-crosshair group/connector"
                            onMouseDown={(e) => handleConnectorMouseDown(e, point)}
                        >
                            {/* Aumenta a área de clique invisível para facilitar a conexão */}
                            <circle cx={point.pos.x} cy={point.pos.y} r="16" fill="transparent"/>
                             <circle
                                cx={point.pos.x}
                                cy={point.pos.y}
                                r="7"
                                className="fill-gray-900 stroke-cyan-400 stroke-2 group-hover/connector:stroke-white transition-all duration-200"
                            />
                            <circle
                                cx={point.pos.x}
                                cy={point.pos.y}
                                r="3.5"
                                className="fill-cyan-400 group-hover/connector:fill-white transition-all duration-200"
                            />
                            {point.label && (
                                <text
                                    x={point.pos.x === width ? point.pos.x + 8 : point.pos.x}
                                    y={point.pos.y === height ? point.pos.y + 14 : point.pos.y}
                                    textAnchor={point.pos.x === width ? 'start' : 'middle'}
                                    dominantBaseline="middle"
                                    className="fill-gray-200 text-xs font-sans font-bold pointer-events-none"
                                    style={{ fontSize: 14 / viewZoom }}
                                    paintOrder="stroke"
                                    stroke="var(--color-bg-secondary)"
                                    strokeWidth={`${6 / viewZoom}px`}
                                    strokeLinejoin="round"
                                >
                                    {point.label}
                                </text>
                            )}
                        </g>
                    ))}
                </g>
            )}

            {!isEditing && (
                <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {hoverConnectors.map((point) => (
                       <g
                            key={`hover-${point.index}`}
                            className="cursor-crosshair group/connector"
                            onMouseDown={(e) => handleConnectorMouseDown(e, point)}
                        >
                             {/* Aumenta a área de clique invisível para facilitar a conexão */}
                            <circle cx={point.pos.x} cy={point.pos.y} r="16" fill="transparent"/>
                             <circle
                                cx={point.pos.x}
                                cy={point.pos.y}
                                r="7"
                                className="fill-gray-900 stroke-cyan-400 stroke-2 group-hover/connector:stroke-white transition-all duration-200"
                            />
                            <circle
                                cx={point.pos.x}
                                cy={point.pos.y}
                                r="3.5"
                                className="fill-cyan-400 group-hover/connector:fill-white transition-all duration-200"
                            />
                        </g>
                    ))}
                    {resizeHandles.map(handle => (
                         <rect
                            key={handle.id}
                            data-resize-handle={handle.id}
                            x={handle.x}
                            y={handle.y}
                            width="10"
                            height="10"
                            rx="2"
                            ry="2"
                            fill="var(--color-accent)"
                            stroke="var(--color-bg-secondary)"
                            strokeWidth="2"
                            className="cursor-[var(--cursor)] hover:fill-white transition-colors duration-200"
                            style={{ '--cursor': handle.cursor } as React.CSSProperties}
                            onMouseDown={(e) => handleResizeMouseDown(e, handle.id)}
                        />
                    ))}
                </g>
            )}
             
            <foreignObject x={width - 12} y={-12} width="24" height="24" className="overflow-visible">
                 <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(data.id); }}
                    className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none p-1 delete-button-wrapper transform hover:scale-110">
                     <TrashIcon />
                 </button>
            </foreignObject>
        </g>
    );
};

export default Node;
