import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NodeData, EdgeData, NodeType, Position, FlowchartData } from './types';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import ContextMenu from './components/ContextMenu';
import { StartIcon, ProcessIcon, DecisionIcon } from './components/Icons';

const defaultDimensions = {
    start: { width: 150, height: 60 },
    end: { width: 150, height: 60 },
    process: { width: 150, height: 70 },
    decision: { width: 160, height: 100 },
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

    return { nodes: sanitizedNodes, edges: sanitizedEdges };
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
  return { nodes: [], edges: [] };
};


const App: React.FC = () => {
  const [initialData] = useState(loadInitialData);
  const [nodes, setNodes] = useState<NodeData[]>(initialData.nodes);
  const [edges, setEdges] = useState<EdgeData[]>(initialData.edges);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [autoConnect, setAutoConnect] = useState<boolean>(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: NodeData } | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    document.fonts.ready.then(() => {
      setFontsLoaded(true);
    });
  }, []);

  useEffect(() => {
    try {
        const dataToSave = { nodes, edges };
        localStorage.setItem('flowchart-autosave', JSON.stringify(dataToSave));
    } catch (error) {
        console.error("Falha ao salvar o fluxograma no armazenamento local.", error);
    }
  }, [nodes, edges]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'Backspace' || e.key === 'Delete')) {
            const activeEl = document.activeElement;
            if (activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName)) {
                return;
            }
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
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdgeId, deleteEdge, selectedNodeIds, setNodes, setEdges]);


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

    if (nodes.length === 0) {
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
            backgroundColor: '#111827', // --color-bg
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
}, [nodes]);


  const handleExportJSON = useCallback(() => {
      const data = { nodes, edges };
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'fluxograma.json';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
  }, [nodes, edges]);

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
                  setSelectedNodeIds(new Set());
                  setSelectedEdgeId(null);
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
        setNodes([]);
        setEdges([]);
        setSelectedEdgeId(null);
        setSelectedNodeIds(new Set());
    }
  }, []);

  return (
    <div className="flex h-screen font-sans bg-[#111827] text-gray-100 overflow-hidden" onClick={closeContextMenu}>
      <div className="w-72 flex flex-col bg-[#1F2937] border-r border-[#374151] shadow-lg">
          <header className="p-4 border-b border-[#374151]">
              <h1 className="text-2xl font-bold text-[#22D3EE]">Criador de Fluxogramas</h1>
              <p className="text-sm text-gray-400 mt-1">Crie, visualize e edite seus processos.</p>
          </header>
          
          <Sidebar 
            setNodes={setNodes} 
            autoConnect={autoConnect}
            setAutoConnect={setAutoConnect}
            onExportPNG={handleExportPNG}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onClear={handleClear}
          />
          
      </div>
      <main className="flex-1 relative bg-[#111827]">
        <Canvas
          nodes={nodes}
          edges={edges}
          setNodes={setNodes}
          setEdges={setEdges}
          updateNodePosition={updateNodePosition}
          updateNodeText={updateNodeText}
          updateNodeDimensions={updateNodeDimensions}
          deleteNode={deleteNode}
          autoConnect={autoConnect}
          onOpenContextMenu={openContextMenu}
          selectedEdgeId={selectedEdgeId}
          setSelectedEdgeId={setSelectedEdgeId}
          deleteEdge={deleteEdge}
          updateEdgeLabel={updateEdgeLabel}
          fontsLoaded={fontsLoaded}
          selectedNodeIds={selectedNodeIds}
          setSelectedNodeIds={setSelectedNodeIds}
        />
        <div className="absolute bottom-4 right-4 bg-[#1F2937]/80 backdrop-blur-sm p-3 rounded-lg text-xs text-gray-300 shadow-lg flex items-center gap-6 border border-[#374151]">
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
        />,
        document.body
      )}
    </div>
  );
};

export default App;
