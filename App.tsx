
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NodeData, EdgeData, NodeType, Position, FlowchartData, AnnotationData } from './types';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import ContextMenu from './components/ContextMenu';
import PermissionModal from './components/PermissionModal';
import { StartIcon, ProcessIcon, DecisionIcon } from './components/Icons';

const defaultDimensions = {
    start: { width: 150, height: 60 },
    end: { width: 150, height: 60 },
    process: { width: 150, height: 70 },
    decision: { width: 160, height: 100 },
};

const nodeTypeTextMap: Record<NodeType, string> = {
    start: 'Início',
    process: 'Processo',
    decision: 'Decisão',
    end: 'Fim',
};

const sanitizeFlowchartData = (data: any): FlowchartData => {
    if (!data || typeof data !== 'object') {
        throw new Error('Formato de arquivo inválido.');
    }

    const seenNodeIds = new Set<string>();
    const sanitizedNodes = (Array.isArray(data.nodes) ? data.nodes : [])
        .map((n: any) => {
            if (!n || typeof n.id !== 'string' || !n.id.trim()) return null;
            if (seenNodeIds.has(n.id)) return null; 
            
            seenNodeIds.add(n.id);
            
            const position = n.position || {};
            const x = parseFloat(position.x);
            const y = parseFloat(position.y);
            if (!isFinite(x) || !isFinite(y)) return null;

            const width = n.width !== undefined ? parseFloat(n.width) : undefined;
            const height = n.height !== undefined ? parseFloat(n.height) : undefined;
            if ((width !== undefined && !isFinite(width)) || (height !== undefined && !isFinite(height))) return null;

            return {
                id: n.id,
                type: ['start', 'process', 'decision', 'end'].includes(n.type) ? n.type : 'process',
                text: typeof n.text === 'string' ? n.text : 'Node',
                position: { x, y },
                width: width,
                height: height,
                color: typeof n.color === 'string' ? n.color : undefined,
            };
        })
        .filter((n): n is NodeData => n !== null);

    const validNodeIds = new Set(sanitizedNodes.map(n => n.id));
    const seenEdgeIds = new Set<string>();
    const sanitizedEdges = (Array.isArray(data.edges) ? data.edges : [])
        .map((e: any) => {
            if (!e || typeof e.id !== 'string' || !e.id.trim()) return null;
            if (seenEdgeIds.has(e.id)) return null;

            if (typeof e.source !== 'string' || !e.source.trim() || typeof e.target !== 'string' || !e.target.trim()) return null;
            if (!validNodeIds.has(e.source) || !validNodeIds.has(e.target)) return null;
            
            seenEdgeIds.add(e.id);
            
            const sourceHandle = e.sourceHandle !== undefined ? parseInt(e.sourceHandle, 10) : undefined;
            const targetHandle = e.targetHandle !== undefined ? parseInt(e.targetHandle, 10) : undefined;
            if ((sourceHandle !== undefined && !isFinite(sourceHandle)) || (targetHandle !== undefined && !isFinite(targetHandle))) return null;

            return {
                id: e.id,
                source: e.source,
                target: e.target,
                label: typeof e.label === 'string' ? e.label : undefined,
                sourceHandle: sourceHandle,
                targetHandle: targetHandle,
            };
        })
        .filter((e): e is EdgeData => e !== null);
        
    const seenAnnotationIds = new Set<string>();
    const sanitizedAnnotations = (Array.isArray(data.annotations) ? data.annotations : [])
        .map((a: any) => {
            if (!a || typeof a.id !== 'string' || !a.id.trim()) return null;
            if (seenAnnotationIds.has(a.id)) return null;

            seenAnnotationIds.add(a.id);
            
            const position = a.position || {};
            const x = parseFloat(position.x);
            const y = parseFloat(position.y);
            if (!isFinite(x) || !isFinite(y)) return null;

            const width = parseFloat(a.width);
            const height = parseFloat(a.height);
            if (!isFinite(width) || !isFinite(height)) return null;

            return {
                id: a.id,
                text: typeof a.text === 'string' ? a.text : 'Anotação',
                position: { x, y },
                width: width,
                height: height,
            };
        })
        .filter((a): a is AnnotationData => a !== null);


    return { nodes: sanitizedNodes, edges: sanitizedEdges, annotations: sanitizedAnnotations };
};

const loadInitialData = (): FlowchartData => {
  try {
    const saved = window.localStorage.getItem('flowchart-autosave');
    if (saved) {
      return sanitizeFlowchartData(JSON.parse(saved));
    }
  } catch (error) {
    console.error("Falha ao carregar o fluxograma do armazenamento local.", error);
  }
  return { nodes: [], edges: [], annotations: [] };
};

const getInitialTheme = (): 'light' | 'dark' => {
  const savedTheme = window.localStorage.getItem('flowchart-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }
  // Remove a detecção de preferência do sistema para definir o escuro como padrão.
  return 'dark';
};


const App: React.FC = () => {
  const [initialFlowchartData] = useState(loadInitialData);
  const [nodes, setNodes] = useState<NodeData[]>(initialFlowchartData.nodes);
  const [edges, setEdges] = useState<EdgeData[]>(initialFlowchartData.edges);
  const [annotations, setAnnotations] = useState<AnnotationData[]>(initialFlowchartData.annotations || []);
  
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<Set<string>>(new Set());
  const [autoConnect, setAutoConnect] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: NodeData } | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  const [history, setHistory] = useState<FlowchartData[]>([initialFlowchartData]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isRestoring = useRef(false);
  const debounceTimeout = useRef<number | null>(null);

  useEffect(() => {
    document.fonts.ready.then(() => {
      setFontsLoaded(true);
    });
  }, []);
  
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    try {
      localStorage.setItem('flowchart-theme', theme);
    } catch (error) {
      console.error('Falha ao salvar o tema no localStorage.', error);
    }
  }, [theme]);
  
  useEffect(() => {
      if (isRestoring.current) {
        isRestoring.current = false;
        return;
      }

      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }

      debounceTimeout.current = window.setTimeout(() => {
        const currentState = { nodes, edges, annotations };
        const lastState = history[historyIndex];
        
        if (JSON.stringify(currentState) === JSON.stringify(lastState)) {
            return;
        }
        
        const newHistory = history.slice(0, historyIndex + 1);
        
        setHistory([...newHistory, currentState]);
        setHistoryIndex(newHistory.length);

        try {
            localStorage.setItem('flowchart-autosave', JSON.stringify(currentState));
        } catch (error) {
            console.error("Falha ao salvar o fluxograma no armazenamento local.", error);
        }
      }, 500);

      return () => {
        if (debounceTimeout.current) {
          clearTimeout(debounceTimeout.current);
        }
      };
    }, [nodes, edges, annotations, history, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
        isRestoring.current = true;
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const prevState = history[newIndex];
        setNodes(prevState.nodes);
        setEdges(prevState.edges);
        setAnnotations(prevState.annotations || []);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
        isRestoring.current = true;
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        const nextState = history[newIndex];
        setNodes(nextState.nodes);
        setEdges(nextState.edges);
        setAnnotations(nextState.annotations || []);
    }
  }, [history, historyIndex]);

  const addNode = useCallback((type: NodeType) => {
    const GRID_SIZE = 20;
    const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

    const initialPos = { x: Math.random() * 200 + 50, y: Math.random() * 100 + 50 };
    const finalPos = snapToGrid ? { x: snap(initialPos.x), y: snap(initialPos.y) } : initialPos;

    const newNode: NodeData = {
      id: `${type}-${Date.now()}${Math.round(Math.random() * 100)}`,
      type,
      text: nodeTypeTextMap[type],
      position: finalPos,
    };
    setNodes((nds) => [...nds, newNode]);
  }, [snapToGrid]);

  const addAnnotation = useCallback(() => {
    const GRID_SIZE = 20;
    const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

    const initialPos = { x: Math.random() * 200 + 50, y: Math.random() * 100 + 50 };
    const finalPos = snapToGrid ? { x: snap(initialPos.x), y: snap(initialPos.y) } : initialPos;
    
    const newAnnotation: AnnotationData = {
      id: `annotation-${Date.now()}`,
      text: 'Clique duas vezes para editar...',
      position: finalPos,
      width: 160,
      height: 120,
    };
    setAnnotations((anns) => [...anns, newAnnotation]);
  }, [snapToGrid]);

  const updateAnnotationPosition = useCallback((id: string, position: Position) => {
    setAnnotations((prev) => prev.map((ann) => ann.id === id ? { ...ann, position } : ann));
  }, []);

  const updateAnnotationText = useCallback((id: string, text: string) => {
    setAnnotations((prev) => prev.map((ann) => ann.id === id ? { ...ann, text } : ann));
  }, []);

  const updateAnnotationDimensions = useCallback((id: string, dimensions: { width: number; height: number }) => {
    setAnnotations((prev) => prev.map((ann) => ann.id === id ? { ...ann, ...dimensions } : ann));
  }, []);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((ann) => ann.id !== id));
  }, []);


  const updateNodePosition = useCallback((id: string, position: { x: number; y: number }) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === id ? { ...node, position } : node
      )
    );
  }, []);

  const updateNodeText = useCallback((id: string, text: string) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === id ? { ...node, text } : node
      )
    );
  }, []);

  const updateNodeDimensions = useCallback((id: string, dimensions: { width: number, height: number }) => {
    setNodes((prevNodes) =>
        prevNodes.map((node) =>
            node.id === id ? { ...node, ...dimensions } : node
        )
    );
  }, []);
  
  const deleteNode = useCallback((nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeIds(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
    });
    closeContextMenu();
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
    setSelectedEdgeId(null);
  }, []);
  
  const updateEdgeLabel = useCallback((edgeId: string, label: string) => {
    setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, label } : e));
  }, []);

  const removeNodeConnections = useCallback((nodeId: string) => {
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    closeContextMenu();
  }, []);

  const updateNodeType = useCallback((nodeId: string, type: NodeType) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, type, color: undefined } : n));
    closeContextMenu();
  }, []);
  
  const updateNodeColor = useCallback((nodeId: string, color?: string) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, color } : n));
    closeContextMenu();
  }, []);
  
  const resetNodeSize = useCallback((nodeId: string) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, width: undefined, height: undefined } : n));
    closeContextMenu();
  }, []);

  const handleAddChild = useCallback((parentNodeId: string) => {
    const parentNode = nodes.find(n => n.id === parentNodeId);
    if (!parentNode) return;

    const GRID_SIZE = 20;
    const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

    const parentHeight = parentNode.height ?? defaultDimensions[parentNode.type].height;

    const initialPos = { 
      x: parentNode.position.x, 
      y: parentNode.position.y + parentHeight + 80
    };
    const finalPos = snapToGrid ? { x: snap(initialPos.x), y: snap(initialPos.y) } : initialPos;

    const newNode: NodeData = {
      id: `${parentNode.type}-${Date.now()}${Math.round(Math.random() * 100)}`,
      type: parentNode.type,
      text: nodeTypeTextMap[parentNode.type],
      position: finalPos,
      color: parentNode.color,
    };

    const newEdge: EdgeData = {
      id: `e-${parentNode.id}-${newNode.id}-${Date.now()}`,
      source: parentNode.id,
      target: newNode.id,
    };
    
    setNodes(nds => [...nds, newNode]);
    setEdges(eds => [...eds, newEdge]);
    closeContextMenu();
  }, [nodes, snapToGrid]);

  const handleCopy = useCallback(() => {
    if (selectedNodeIds.size === 0) return;

    const selectedNodes = nodes.filter(n => selectedNodeIds.has(n.id));
    const selectedEdges = edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));
    
    const dataToCopy = {
        type: 'flowchart-copy-data',
        data: {
            nodes: selectedNodes,
            edges: selectedEdges,
        },
    };

    navigator.clipboard.writeText(JSON.stringify(dataToCopy))
        .catch(err => {
            console.error('Falha ao copiar para a área de transferência:', err);
            alert('Não foi possível copiar os blocos. Verifique as permissões do navegador.');
        });
  }, [nodes, edges, selectedNodeIds]);

  const handlePaste = useCallback(async () => {
    try {
        const permission = await navigator.permissions.query({ name: 'clipboard-read' as any });
        if (permission.state === 'denied') {
          setIsPermissionModalOpen(true);
          return;
        }

        const clipboardText = await navigator.clipboard.readText();
        const clipboardData = JSON.parse(clipboardText);

        if (clipboardData?.type !== 'flowchart-copy-data' || !clipboardData.data) {
            return;
        }

        const pastedFlowchart: FlowchartData = clipboardData.data;
        if (!Array.isArray(pastedFlowchart.nodes) || pastedFlowchart.nodes.length === 0) {
            return;
        }
        
        const idMap = new Map<string, string>();
        const newNodes: NodeData[] = [];
        const newEdges: EdgeData[] = [];

        pastedFlowchart.nodes.forEach(node => {
            const newId = `${node.type}-${Date.now()}${Math.round(Math.random() * 1000)}`;
            idMap.set(node.id, newId);
            newNodes.push({
                ...node,
                id: newId,
                position: {
                    x: node.position.x + 30,
                    y: node.position.y + 30,
                },
            });
        });
        
        if (Array.isArray(pastedFlowchart.edges)) {
            pastedFlowchart.edges.forEach(edge => {
                const newSourceId = idMap.get(edge.source);
                const newTargetId = idMap.get(edge.target);
                
                if (newSourceId && newTargetId) {
                    newEdges.push({
                        ...edge,
                        id: `e-${newSourceId}-${newTargetId}-${Date.now()}${Math.round(Math.random() * 1000)}`,
                        source: newSourceId,
                        target: newTargetId,
                    });
                }
            });
        }

        setNodes(nds => [...nds, ...newNodes]);
        setEdges(eds => [...eds, ...newEdges]);
        
        setSelectedNodeIds(new Set(newNodes.map(n => n.id)));
        setSelectedEdgeId(null);
        setSelectedAnnotationIds(new Set());
        
    } catch (err) {
        console.warn('Falha ao colar da área de transferência:', err);
    }
  }, [setNodes, setEdges, setSelectedNodeIds, setSelectedEdgeId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const activeEl = document.activeElement;
        const isTyping = activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName);

        if (isTyping) return;

        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const isCopy = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'c';
        const isPaste = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'v';
        const isDelete = e.key === 'Backspace' || e.key === 'Delete';
        const isUndo = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'z';
        const isRedo = (isMac ? e.metaKey : e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'));

        if (isUndo) {
            e.preventDefault();
            handleUndo();
            return;
        }

        if (isRedo) {
            e.preventDefault();
            handleRedo();
            return;
        }

        if (isCopy) {
            e.preventDefault();
            handleCopy();
            return;
        }

        if (isPaste) {
            e.preventDefault();
            handlePaste();
            return;
        }

        if (isDelete) {
            e.preventDefault();
            if (selectedEdgeId) {
                deleteEdge(selectedEdgeId);
            }
            if (selectedNodeIds.size > 0) {
                const nodeIdsToDelete = Array.from(selectedNodeIds);
                setNodes(nds => nds.filter(n => !nodeIdsToDelete.includes(n.id)));
                setEdges(eds => eds.filter(e => !nodeIdsToDelete.includes(e.source) && !nodeIdsToDelete.includes(e.target)));
                setSelectedNodeIds(new Set());
            }
             if (selectedAnnotationIds.size > 0) {
                const annotationIdsToDelete = Array.from(selectedAnnotationIds);
                setAnnotations(anns => anns.filter(a => !annotationIdsToDelete.includes(a.id)));
                setSelectedAnnotationIds(new Set());
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdgeId, deleteEdge, selectedNodeIds, selectedAnnotationIds, handleCopy, handlePaste, setNodes, setEdges, setAnnotations, handleUndo, handleRedo]);


  const openContextMenu = (x: number, y: number, node: NodeData) => {
    setContextMenu({ x, y, node });
  };
  
  const closeContextMenu = () => setContextMenu(null);

  const handleExportPNG = useCallback(async () => {
    let toPng;
    try {
        const module = await import('https://esm.sh/html-to-image@1.11.11');
        toPng = module.toPng || (module.default && module.default.toPng);
        if (typeof toPng !== 'function') {
           throw new Error('A função "toPng" não foi encontrada no módulo de exportação de imagem.');
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        alert(`Não foi possível carregar a biblioteca de exportação de imagens. Verifique sua conexão com a internet e desative bloqueadores de conteúdo. Erro: ${errorMessage}`);
        console.error('Falha ao carregar html-to-image:', error);
        return;
    }

    const svgElement = document.getElementById('flowchart-canvas');
    if (!svgElement) {
        alert('Elemento do canvas não encontrado.');
        return;
    }

    const gElement = svgElement.querySelector<SVGGElement>('#flowchart-group');
    if (!gElement) {
        alert('Elemento de grupo do fluxograma não encontrado para exportação.');
        return;
    }

    if (nodes.length === 0 && annotations.length === 0) {
        alert("Não há nada para exportar!");
        return;
    }

    const PADDING = 50;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        const nodeWidth = node.width ?? defaultDimensions[node.type].width;
        const nodeHeight = node.height ?? defaultDimensions[node.type].height;
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + nodeWidth);
        maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    annotations.forEach(ann => {
        minX = Math.min(minX, ann.position.x);
        minY = Math.min(minY, ann.position.y);
        maxX = Math.max(maxX, ann.position.x + ann.width);
        maxY = Math.max(maxY, ann.position.y + ann.height);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const exportWidth = contentWidth + PADDING * 2;
    const exportHeight = contentHeight + PADDING * 2;
    
    const originalBackground = svgElement.querySelector<SVGRectElement>('rect[fill^="url(#pattern-dots)"]');
    
    const originalTransform = gElement.getAttribute('transform');
    gElement.setAttribute('transform', `translate(${-minX + PADDING}, ${-minY + PADDING}) scale(1)`);

    svgElement.classList.add('exporting');
    if (originalBackground) originalBackground.style.display = 'none';

    try {
        const fontURL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
        const fontCSS = await fetch(fontURL).then(response => response.text());
        
        const dataUrl = await toPng(svgElement, {
            width: exportWidth,
            height: exportHeight,
            backgroundColor: theme === 'dark' ? '#111827' : '#F9FAFB',
            fontEmbedCSS: fontCSS,
        });
        
        const link = document.createElement('a');
        link.download = 'fluxograma.png';
        link.href = dataUrl;
        link.click();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Erro ao exportar para PNG:', error);
        alert(`Ocorreu um erro ao exportar o PNG: ${errorMessage}`);
    } finally {
        svgElement.classList.remove('exporting');
        if (originalBackground) originalBackground.style.display = '';
        if (originalTransform) {
            gElement.setAttribute('transform', originalTransform);
        } else {
            gElement.removeAttribute('transform');
        }
    }
}, [nodes, annotations, theme]);


  const handleExportJSON = useCallback(() => {
      const data = { nodes, edges, annotations };
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'fluxograma.json';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
  }, [nodes, edges, annotations]);

  const handleImportJSON = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const input = event.target;
      if (!file) return;

      const reader = new FileReader();
      
      reader.onload = (e) => {
          try {
              const result = e.target?.result;
              if (typeof result !== 'string') throw new Error('Falha ao ler o arquivo.');
              
              const parsedData = JSON.parse(result);
              const sanitizedData = sanitizeFlowchartData(parsedData);
              
              if (window.confirm('Isso substituirá o fluxograma atual. Deseja continuar?')) {
                  setNodes(sanitizedData.nodes);
                  setEdges(sanitizedData.edges);
                  setAnnotations(sanitizedData.annotations || []);
                  setHistory([sanitizedData]);
                  setHistoryIndex(0);
                  setSelectedNodeIds(new Set());
                  setSelectedEdgeId(null);
                  setSelectedAnnotationIds(new Set());
              }
          } catch (error) {
              alert(`Erro ao importar o arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          } finally {
              if (input) input.value = '';
          }
      };

      reader.onerror = () => {
        alert('Ocorreu um erro ao ler o arquivo.');
        if (input) input.value = '';
      };
      
      reader.readAsText(file);
  }, []);
  
  const handleClear = useCallback(() => {
    if (window.confirm('Tem certeza que deseja limpar o fluxograma? Todo o progresso salvo localmente será perdido.')) {
        const emptyState: FlowchartData = { nodes: [], edges: [], annotations: [] };
        setNodes(emptyState.nodes);
        setEdges(emptyState.edges);
        setAnnotations(emptyState.annotations || []);
        setHistory([emptyState]);
        setHistoryIndex(0);
        setSelectedEdgeId(null);
        setSelectedNodeIds(new Set());
        setSelectedAnnotationIds(new Set());
    }
  }, []);

  return (
    <div className="flex h-screen font-sans bg-[var(--color-bg)] text-[var(--color-text-primary)] overflow-hidden" onClick={closeContextMenu}>
      <div className="w-72 flex flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] shadow-lg">
          <header className="p-4 border-b border-[var(--color-border)]">
              <h1 className="text-2xl font-bold text-[var(--color-accent)]">Criador de Fluxogramas</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">Crie, visualize e edite seus processos.</p>
          </header>
          
          <Sidebar 
            addNode={addNode} 
            autoConnect={autoConnect}
            setAutoConnect={setAutoConnect}
            snapToGrid={snapToGrid}
            setSnapToGrid={setSnapToGrid}
            onExportPNG={handleExportPNG}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onClear={handleClear}
            onAddAnnotation={addAnnotation}
            theme={theme}
            setTheme={setTheme}
          />
          
      </div>
      <main className="flex-1 relative bg-[var(--color-bg)]">
        <Canvas
          nodes={nodes}
          edges={edges}
          annotations={annotations}
          setNodes={setNodes}
          setEdges={setEdges}
          setAnnotations={setAnnotations}
          updateNodePosition={updateNodePosition}
          updateNodeText={updateNodeText}
          updateNodeDimensions={updateNodeDimensions}
          deleteNode={deleteNode}
          updateAnnotationPosition={updateAnnotationPosition}
          updateAnnotationText={updateAnnotationText}
          updateAnnotationDimensions={updateAnnotationDimensions}
          deleteAnnotation={deleteAnnotation}
          autoConnect={autoConnect}
          onOpenContextMenu={openContextMenu}
          selectedEdgeId={selectedEdgeId}
          setSelectedEdgeId={setSelectedEdgeId}
          deleteEdge={deleteEdge}
          updateEdgeLabel={updateEdgeLabel}
          fontsLoaded={fontsLoaded}
          selectedNodeIds={selectedNodeIds}
          setSelectedNodeIds={setSelectedNodeIds}
          selectedAnnotationIds={selectedAnnotationIds}
          setSelectedAnnotationIds={setSelectedAnnotationIds}
          snapToGrid={snapToGrid}
        />
        <div className="absolute bottom-4 right-4 bg-[var(--color-bg-secondary)]/80 backdrop-blur-sm p-3 rounded-lg text-xs text-[var(--color-text-secondary)] shadow-lg flex items-center gap-6 border border-[var(--color-border)]">
            <div className="flex items-center gap-2"><StartIcon className="w-4 h-4 text-green-400"/> Início/Fim</div>
            <div className="flex items-center gap-2"><ProcessIcon className="w-4 h-4 text-blue-400"/> Processo</div>
            <div className="flex items-center gap-2"><DecisionIcon className="w-4 h-4 text-purple-400"/> Decisão</div>
        </div>
      </main>
      {contextMenu && createPortal(
        <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={contextMenu.node}
            onClose={closeContextMenu}
            onDelete={deleteNode}
            onRemoveConnections={removeNodeConnections}
            onChangeType={updateNodeType}
            onChangeColor={updateNodeColor}
            onResetSize={resetNodeSize}
            onAddChild={handleAddChild}
        />,
        document.body
      )}
      <PermissionModal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        onRetry={() => {
            setIsPermissionModalOpen(false);
            handlePaste();
        }}
      />
    </div>
  );
};

export default App;