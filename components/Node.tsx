import React, { useState, useRef, useEffect, KeyboardEvent, useLayoutEffect } from 'react';
import { NodeData, Position, NodeType } from '../types';
import { TrashIcon } from './Icons';

interface NodeProps {
  data: NodeData;
  onPositionChange: (id: string, position: Position) => void;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onStartConnecting: (id: string, sourcePos: Position) => void;
  onFinishConnecting: (id: string) => void;
  onSizeChange: (id: string, dimensions: { width: number; height: number }) => void;
  onOpenContextMenu: (x: number, y: number, node: NodeData) => void;
  isConnecting: boolean;
  viewZoom: number;
  onInteractionStart: () => void;
  onDragStart: (id: string) => void;
  onDrag: (id: string, position: Position) => void;
  onDragEnd: (id: string) => void;
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
            return <path d={`M${width / 2} 0 L${width} ${height / 2} L${width / 2} ${height} L0 ${height / 2} Z`} />;
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

const getConnectionPoints = (type: NodeType, width: number, height: number): Position[] => {
    return [
        { x: width / 2, y: 0 },    // Top
        { x: width, y: height / 2 }, // Right
        { x: width / 2, y: height }, // Bottom
        { x: 0, y: height / 2 },     // Left
    ];
};

const Node: React.FC<NodeProps> = ({ 
    data, onPositionChange, onTextChange, onDelete, onStartConnecting, 
    onFinishConnecting, onSizeChange, onOpenContextMenu, isConnecting, viewZoom, 
    onInteractionStart, onDragStart, onDrag, onDragEnd, fontsLoaded
}) => {
    const [isDragging, setIsDragging] = useState(false);
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
        // Aguarda as fontes carregarem e verifica se o modo automático está ativo.
        if (!autoSizeModeRef.current || isEditing || !textRef.current || resizingState || !fontsLoaded) {
            return;
        }
    
        const textEl = textRef.current;
        const paddingX = data.type === 'decision' ? 40 : 20;
        const paddingY = data.type === 'decision' ? 30 : 20;
    
        // --- Iniciar Medição ---
        textEl.style.width = 'auto'; // Deixa o texto fluir para encontrar a largura ideal
        const naturalWidth = textEl.scrollWidth;
        const requiredWidthForText = Math.max(minWidth, naturalWidth + paddingX);
        
        // Limita a largura a um valor máximo
        const calculatedWidth = Math.min(MAX_WIDTH, requiredWidthForText);
        
        // Agora, verifica a altura com a largura calculada (após considerar o padding)
        const contentWidth = calculatedWidth - paddingX;
        textEl.style.width = `${contentWidth}px`;
        
        const wrappedHeight = textEl.scrollHeight;
        
        let calculatedHeight;
        if (data.type === 'decision') {
            // Losangos precisam de mais espaço vertical
            const requiredDiamondHeight = (wrappedHeight * 1.5) + (paddingY * 2);
            calculatedHeight = Math.max(minHeight, requiredDiamondHeight);
        } else {
            calculatedHeight = Math.max(minHeight, wrappedHeight + paddingY);
        }
        
        textEl.style.width = ''; // Reseta o estilo para a renderização
        // --- Fim da Medição ---
    
        // Se o tamanho calculado for diferente do atual, atualiza.
        if (calculatedWidth !== width || calculatedHeight !== height) {
            onSizeChange(data.id, { width: calculatedWidth, height: calculatedHeight });
        }
    }, [data.text, data.id, onSizeChange, isEditing, width, height, data.type, minWidth, minHeight, resizingState, fontsLoaded]);

    const connectionPoints = getConnectionPoints(data.type, width, height);
    
    const shapeComponent = getShape(data.type, width, height);
    const shapeProps: React.SVGProps<any> = {};

    if (data.color) {
        shapeProps.stroke = data.color;
        shapeProps.fill = data.color;
        shapeProps.fillOpacity = "0.3";
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
            e.button === 2 // right-click
            ) {
            return;
        }
        e.stopPropagation();
        onInteractionStart();
        setIsDragging(true);
        onDragStart(data.id);
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

    const handleMouseUp = () => {
        if (!isConnecting) return;
        onFinishConnecting(data.id);
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

    const handleConnectorMouseDown = (e: React.MouseEvent, point: Position) => {
        e.stopPropagation();
        onInteractionStart();
        const absolutePos = {
            x: data.position.x + point.x,
            y: data.position.y + point.y,
        };
        onStartConnecting(data.id, absolutePos);
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
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const newPosition = {
                    x: data.position.x + e.movementX / viewZoom,
                    y: data.position.y + e.movementY / viewZoom,
                };
                onDrag(data.id, newPosition);
            }
        };
        const handleMouseUpGlobal = () => {
            if (isDragging) {
                setIsDragging(false);
                onDragEnd(data.id);
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUpGlobal);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUpGlobal);
        };
    }, [isDragging, data.id, data.position, onDrag, viewZoom, onDragEnd]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);
    
     const resizeHandles = [
        { id: 'top-left', x: -5, y: -5, cursor: 'nwse-resize' },
        { id: 'top-right', x: width - 5, y: -5, cursor: 'nesw-resize' },
        { id: 'bottom-left', x: -5, y: height - 5, cursor: 'nesw-resize' },
        { id: 'bottom-right', x: width - 5, y: height - 5, cursor: 'nwse-resize' },
    ];

    return (
        <g 
            transform={`translate(${data.position.x}, ${data.position.y})`} 
            className={`group ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${resizingState ? 'cursor-[var(--cursor)]' : ''} transition-transform duration-200 ease-out`}
            style={{'--cursor': resizingState ? resizeHandles.find(h => h.id.startsWith(resizingState.handle))?.cursor : 'default'} as React.CSSProperties}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
        >
            <g className={`node-shape ${!data.color ? nodeClasses[data.type] : ''} ${isConnecting ? 'hover:stroke-cyan-200 hover:stroke-[3px]' : ''}`}>
                {styledShape}
            </g>

            {isEditing ? (
                 <foreignObject x="0" y="0" width={width} height={height}>
                    <div className="w-full h-full flex items-center justify-center p-2 box-border">
                        <textarea
                            ref={textareaRef}
                            value={editText}
                            onChange={handleTextChange}
                            onBlur={handleTextBlur}
                            onKeyDown={handleKeyDown}
                            className="w-full h-full bg-transparent text-white text-center font-medium text-sm p-1 m-0 border border-cyan-400 rounded-md focus:ring-0 resize-none overflow-y-auto"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        />
                    </div>
                 </foreignObject>
            ) : (
                <foreignObject x="0" y="0" width={width} height={height} className="pointer-events-none">
                     <div className="w-full h-full flex items-center justify-center text-center text-white font-medium text-sm break-all p-2 box-border">
                        <div 
                            ref={textRef} 
                            style={{ maxWidth: data.type === 'decision' ? `${width * 0.7}px` : undefined }}
                        >
                            {data.text}
                        </div>
                     </div>
                </foreignObject>
            )}

            {!isEditing && (
                <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {connectionPoints.map((point, index) => (
                       <g
                            key={index}
                            className="cursor-crosshair group/connector"
                            onMouseDown={(e) => handleConnectorMouseDown(e, point)}
                        >
                            <circle cx={point.x} cy={point.y} r="12" fill="transparent"/> {/* Hit area */}
                             <circle
                                cx={point.x}
                                cy={point.y}
                                r="7"
                                className="fill-gray-900 stroke-cyan-400 stroke-2 group-hover/connector:stroke-white transition-all duration-200"
                            />
                            <circle
                                cx={point.x}
                                cy={point.y}
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
                            fill="#22D3EE"
                            stroke="#1F2937"
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