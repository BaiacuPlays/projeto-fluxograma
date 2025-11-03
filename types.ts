
export type NodeType = 'start' | 'process' | 'decision' | 'end';

export interface Position {
  x: number;
  y: number;
}

export interface NodeData {
  id: string;
  type: NodeType;
  text: string;
  position: Position;
  width?: number;
  height?: number;
  color?: string;
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourceHandle?: number;
  targetHandle?: number;
}

export interface AnnotationData {
  id: string;
  text: string;
  position: Position;
  width: number;
  height: number;
}

export interface FlowchartData {
  nodes: NodeData[];
  edges: EdgeData[];
  annotations?: AnnotationData[];
}
