import React, { useState, useEffect, useRef } from 'react';
import { EdgeData, NodeData, Position } from '../types';
import { TrashIcon } from './Icons';

interface EdgeProps {
  edge: EdgeData;
  nodes: NodeData[];
  autoConnect: boolean;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
  isSnapTarget: boolean;
  isHidden: boolean;
}

const defaultDimensions = {
    start: { width: 150, height: 60 },
    end: { width: 150, height: 60 },
    process: { width: 150, height: 70 },
    decision: { width: 160, height: 100 },
};


export const getConnectionPoints = (node: NodeData): Position[] => {
    const { type, position } = node;
    const { width, height } = node.width && node.height 
        ? { width: node.width, height: node.height } 
        : defaultDimensions[type];

    const points: Position[] = [
        { x: width / 2, y: 0 },    // Top
        { x: width, y: height / 2 }, // Right
        { x: width / 2, y: height }, // Bottom
        { x: 0, y: height / 2 },     // Left
    ];

    return points.map(p => ({ x: p.x + position.x, y: p.y + position.y }));
};

export const getClosestConnection = (sourceNode: NodeData, targetNode: NodeData) => {
    const sourcePoints = getConnectionPoints(sourceNode);
    const targetPoints = getConnectionPoints(targetNode);

    let minDistance = Infinity;
    let closestPair = {
        source: sourcePoints[0],
        target: targetPoints[0],
        sourceIndex: 0,
        targetIndex: 0,
    };

    sourcePoints.forEach((sp, si) => {
        targetPoints.forEach((tp, ti) => {
            if (sourceNode.id === targetNode.id) return;
            
            const dx = sp.x - tp.x;
            const dy = sp.y - tp.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                minDistance = distance;
                closestPair = { source: sp, target: tp, sourceIndex: si, targetIndex: ti };
            }
        });
    });
    return closestPair;
};


export const getCurvePath = (sourcePos: Position, sourceIndex: number, targetPos: Position, targetIndex: number) => {
    const { x: sx, y: sy } = sourcePos;
    const { x: tx, y: ty } = targetPos;

    const dx = tx - sx;
    const dy = ty - sy;
    const offset = Math.min(100, Math.sqrt(dx*dx + dy*dy) * 0.5);

    let c1x = sx, c1y = sy;
    let c2x = tx, c2y = ty;

    // Control point for source
    if (sourceIndex === 0) c1y -= offset; // Top
    if (sourceIndex === 1) c1x += offset; // Right
    if (sourceIndex === 2) c1y += offset; // Bottom
    if (sourceIndex === 3) c1x -= offset; // Left

    // Control point for target
    if (targetIndex === 0) c2y -= offset; // Top
    if (targetIndex === 1) c2x += offset; // Right
    if (targetIndex === 2) c2y += offset; // Bottom
    if (targetIndex === 3) c2x -= offset; // Left

    const path = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
    
    // Approximate midpoint of Bezier curve for label positioning
    const midX = (0.125 * sx) + (0.375 * c1x) + (0.375 * c2x) + (0.125 * tx);
    const midY = (0.125 * sy) + (0.375 * c1y) + (0.375 * c2y) + (0.125 * ty);

    return { path, labelPos: { x: midX, y: midY } };
};


const Edge: React.FC<EdgeProps> = ({ edge, nodes, autoConnect, isSelected, onSelect, onDelete, onUpdateLabel, isSnapTarget, isHidden }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [labelText, setLabelText] = useState(edge.label || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
    }
  }, [isEditing]);
  
  if (isHidden) return null;

  const sourceNode = nodes.find((node) => node.id === edge.source);
  const targetNode = nodes.find((node) => node.id === edge.target);

  if (!sourceNode || !targetNode) {
    return null;
  }
  
  let finalSourcePos: Position, finalTargetPos: Position, finalSourceIndex: number, finalTargetIndex: number;

  if (autoConnect || edge.sourceHandle === undefined || edge.targetHandle === undefined) {
      const closest = getClosestConnection(sourceNode, targetNode);
      finalSourcePos = closest.source;
      finalTargetPos = closest.target;
      finalSourceIndex = closest.sourceIndex;
      finalTargetIndex = closest.targetIndex;
  } else {
      const sourcePoints = getConnectionPoints(sourceNode);
      const targetPoints = getConnectionPoints(targetNode);
      
      finalSourceIndex = edge.sourceHandle;
      finalTargetIndex = edge.targetHandle;
      
      if (finalSourceIndex >= sourcePoints.length) finalSourceIndex = 0;
      if (finalTargetIndex >= targetPoints.length) finalTargetIndex = 0;

      finalSourcePos = sourcePoints[finalSourceIndex];
      finalTargetPos = targetPoints[finalTargetIndex];
  }

  const { path, labelPos } = getCurvePath(finalSourcePos, finalSourceIndex, finalTargetPos, finalTargetIndex);

  const handleLabelSave = () => {
    onUpdateLabel(edge.id, labelText.trim());
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLabelSave();
    if (e.key === 'Escape') {
      setLabelText(edge.label || '');
      setIsEditing(false);
    }
  };

  const strokeColor = isSelected || isSnapTarget ? 'var(--color-accent)' : '#9CA3AF';
  const strokeWidth = isSelected || isSnapTarget ? 3 : 2;

  return (
    <g 
        className="group-edge"
        onClick={(e) => { e.stopPropagation(); onSelect(edge.id); }}
        onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
    >
      <path d={path} className="edge-hitbox" />
      <path
        d={path}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill="none"
        markerEnd={`url(#arrowhead-${edge.id})`}
        className={`edge-path pointer-events-none transition-all duration-150`}
      />
       <defs>
        <marker
          id={`arrowhead-${edge.id}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 1 2 L 7 5 L 1 8" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" className="transition-all duration-150" />
        </marker>
      </defs>

      {isSelected && !isEditing && (
         <foreignObject x={labelPos.x - 12} y={labelPos.y - 12} width="24" height="24" className="overflow-visible pointer-events-auto">
             <button
                 onClick={(e) => { e.stopPropagation(); onDelete(edge.id); }}
                 className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs transition-opacity focus:outline-none p-1 transform hover:scale-110"
             >
                 <TrashIcon />
             </button>
         </foreignObject>
      )}

      {isEditing ? (
        <foreignObject x={labelPos.x - 60} y={labelPos.y - 16} width="120" height="32" className="pointer-events-auto">
            <input
                ref={inputRef}
                type="text"
                value={labelText}
                onChange={(e) => setLabelText(e.target.value)}
                onBlur={handleLabelSave}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-full px-2 py-1 text-center bg-[#111827] text-white border border-cyan-400 rounded-md text-sm"
            />
        </foreignObject>
      ) : (
        edge.label && (
            <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-gray-300 text-xs font-sans font-medium pointer-events-none"
                paintOrder="stroke"
                stroke="#1F2937"
                strokeWidth="4px"
                strokeLinejoin="round"
            >
                {edge.label}
            </text>
        )
      )}
    </g>
  );
};

export default Edge;