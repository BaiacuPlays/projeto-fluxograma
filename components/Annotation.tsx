
import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { AnnotationData, Position } from '../types';
import { TrashIcon } from './Icons';

interface AnnotationProps {
  data: AnnotationData;
  onPositionChange: (id: string, position: Position) => void;
  onTextChange: (id: string, text: string) => void;
  onSizeChange: (id: string, dimensions: { width: number; height: number }) => void;
  onDelete: (id: string) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  isSelected: boolean;
  viewZoom: number;
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

const MIN_WIDTH = 100;
const MIN_HEIGHT = 80;

const Annotation: React.FC<AnnotationProps> = ({ 
    data, onPositionChange, onTextChange, onSizeChange, 
    onDelete, onMouseDown, isSelected, viewZoom
}) => {
    const [resizingState, setResizingState] = useState<ResizingState | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(data.text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { width, height } = data;

    const handleInternalMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName.toLowerCase() === 'textarea' ||
            target.closest('.delete-button-wrapper') ||
            target.dataset.resizeHandle ||
            e.button === 2
            ) {
            return;
        }
        e.stopPropagation();
        onMouseDown(e);
    };

    const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
        e.stopPropagation();
        e.preventDefault();
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
    
    const handleDoubleClick = () => setIsEditing(true);
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditText(e.target.value);
    const handleTextBlur = () => {
        onTextChange(data.id, editText);
        setIsEditing(false);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            setEditText(data.text);
            setIsEditing(false);
        }
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
            
            const constrainedWidth = Math.max(MIN_WIDTH, newWidth);
            const constrainedHeight = Math.max(MIN_HEIGHT, newHeight);

            if (newWidth < MIN_WIDTH && resizingState.handle.includes('left')) newX = resizingState.startNodeX + (resizingState.startWidth - MIN_WIDTH);
            if (newHeight < MIN_HEIGHT && resizingState.handle.includes('top')) newY = resizingState.startNodeY + (resizingState.startHeight - MIN_HEIGHT);

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
    }, [resizingState, onPositionChange, onSizeChange, data.id, data.position, viewZoom]);

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
            id={data.id}
            transform={`translate(${data.position.x}, ${data.position.y})`} 
            className="group annotation-group cursor-grab"
            onMouseDown={handleInternalMouseDown}
            onDoubleClick={handleDoubleClick}
        >
            <g transform="rotate(-2)" style={{ transformOrigin: 'center' }} filter="url(#annotation-shadow)">
                <rect 
                    x="0" y="0" 
                    width={width} height={height} 
                    fill="#FBBF24"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                />
            </g>

            {isSelected && (
                <rect
                    x={-4} y={-4}
                    width={width + 8}
                    height={height + 8}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="pointer-events-none"
                />
            )}

            {isEditing ? (
                 <foreignObject x="0" y="0" width={width} height={height}>
                    <div className="w-full h-full flex items-center justify-center p-3 box-border">
                        <textarea
                            ref={textareaRef}
                            value={editText}
                            onChange={handleTextChange}
                            onBlur={handleTextBlur}
                            onKeyDown={handleKeyDown}
                            className="w-full h-full bg-transparent text-gray-800 font-medium text-sm p-1 m-0 border border-amber-600 rounded-md focus:ring-0 resize-none overflow-y-auto"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        />
                    </div>
                 </foreignObject>
            ) : (
                <foreignObject x="0" y="0" width={width} height={height} className="pointer-events-none">
                     <div className="w-full h-full flex items-start justify-start text-left text-gray-800 font-medium text-sm p-4 box-border">
                        <div className="w-full h-full overflow-y-auto custom-scrollbar" style={{ scrollbarColor: '#ca8a04 #fde68a' }}>
                            {data.text.split('\\n').map((line, i) => <p key={i}>{line || ' '}</p>)}
                        </div>
                     </div>
                </foreignObject>
            )}

            {isSelected && !isEditing && (
                 <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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

export default Annotation;